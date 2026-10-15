import Settings from '../models/Settings.model.js';
import User from '../models/User.model.js';
import LoyaltyTransaction from '../models/LoyaltyTransaction.model.js';
import ApiError from '../utils/ApiError.js';
import {
    sendLoyaltyPointsEarnedEmail,
    sendLoyaltyPointsRedeemedEmail,
    sendLoyaltyPointsAdjustmentEmail,
    sendLoyaltyPointsRefundRestoredEmail,
    sendLoyaltyMilestoneEmail
} from './loyaltyMarketingNotification.service.js';

export const getLoyaltyConfig = async () => {
    const setting = await Settings.findOne({ key: 'loyalty' });
    const defaults = {
        enabled: true,
        purchaseToPointsRatio: 5,     // 5 Loyalty Points per unit spent ratio
        purchaseAmountUnit: 100,      // e.g. per ₹100 spent
        redemptionRatio: 0.2,         // 5 points = ₹1 Discount (1 point = ₹0.20)
        pointsToRupeeRatio: 5,
        maxRedemptionPercent: 50,     // Max 50% discount from loyalty points
        minRedeemPoints: 50,          // Minimum points to redeem
        pointExpiry: null,

        // B2B defaults
        b2bEnabled: true,
        b2bPurchaseToPointsRatio: 5,
        b2bPurchaseAmountUnit: 100,
        b2bPointsToRupeeRatio: 5,
        b2bRedemptionRatio: 0.2,
        b2bMaxRedemptionPercent: 50,
        b2bMinRedeemPoints: 50,
    };
    if (setting) {
        const merged = { ...defaults, ...setting.value };
        if (setting.value.pointsToRupeeRatio) {
            merged.redemptionRatio = 1 / setting.value.pointsToRupeeRatio;
        }
        if (setting.value.b2bPointsToRupeeRatio) {
            merged.b2bRedemptionRatio = 1 / setting.value.b2bPointsToRupeeRatio;
        }
        return merged;
    }
    return defaults;
};

export const calculateEarnablePoints = async (orderAmount, userRole = 'customer') => {
    const config = await getLoyaltyConfig();
    const isB2B = userRole === 'b2bAdmin' || userRole === 'b2bEmployee';
    const enabled = isB2B ? config.b2bEnabled : config.enabled;
    if (!enabled) return 0;
    
    const purchaseAmountUnit = isB2B ? (config.b2bPurchaseAmountUnit || 100) : (config.purchaseAmountUnit || 100);
    const purchaseToPointsRatio = isB2B ? (config.b2bPurchaseToPointsRatio || 5) : (config.purchaseToPointsRatio || 5);

    const multiplier = orderAmount / purchaseAmountUnit;
    const earned = Math.floor(multiplier * purchaseToPointsRatio);
    return Math.max(0, earned);
};

export const earnPoints = async (userId, orderId, amount, session = null) => {
    const user = await User.findById(userId).session(session);
    if (!user || !['customer', 'b2bAdmin', 'b2bEmployee'].includes(user.role)) return 0;

    const isB2B = user.role === 'b2bAdmin' || user.role === 'b2bEmployee';
    const config = await getLoyaltyConfig();
    const enabled = isB2B ? config.b2bEnabled : config.enabled;
    if (!enabled) return 0;

    // Check for duplicate credit
    const existingTransaction = await LoyaltyTransaction.findOne({
        userId,
        orderId,
        type: 'earn'
    }).session(session);

    if (existingTransaction) return 0; // Already credited

    const Order = (await import('../models/Order.model.js')).default;
    const order = await Order.findById(orderId).session(session);
    
    let pointsToEarn = order ? (order.loyaltyPointsEarned || 0) : 0;
    if (pointsToEarn <= 0) {
        pointsToEarn = await calculateEarnablePoints(amount, user.role);
    }
    if (pointsToEarn <= 0) return 0;

    user.loyaltyPointsBalance += pointsToEarn;
    user.lifetimeEarned += pointsToEarn;
    if (isB2B) {
        user.b2bLifetimeEarned = (user.b2bLifetimeEarned || 0) + pointsToEarn;
    } else {
        user.b2cLifetimeEarned = (user.b2cLifetimeEarned || 0) + pointsToEarn;
    }
    await user.save({ session });

    await LoyaltyTransaction.create([{
        userId,
        orderId,
        points: pointsToEarn,
        type: 'earn',
        description: `Points earned on purchase of Rs.${amount.toFixed(2)}`,
        orderType: isB2B ? 'B2B' : 'B2C',
        balanceAfterTransaction: user.loyaltyPointsBalance
    }], { session });

    // Non-blocking Loyalty Earn Notification (Items 230 & 233)
    sendLoyaltyPointsEarnedEmail({
        user,
        pointsEarned: pointsToEarn,
        totalBalance: user.loyaltyPointsBalance,
        orderId,
        orderAmount: amount
    }).catch(err => console.error('[LoyaltyNotification] Earn email error:', err.message));

    // Check for milestone threshold (Item 240)
    if (user.lifetimeEarned >= 1000 && (user.lifetimeEarned - pointsToEarn) < 1000) {
        sendLoyaltyMilestoneEmail({
            user,
            milestoneName: 'Gold Member',
            pointsThreshold: 1000,
            bonusPoints: 200,
            totalBalance: user.loyaltyPointsBalance
        }).catch(err => console.error('[LoyaltyNotification] Milestone email error:', err.message));
    }

    return pointsToEarn;
};

export const redeemPoints = async (userId, orderId, pointsToRedeem, session = null) => {
    if (pointsToRedeem <= 0) return 0;

    const user = await User.findById(userId).session(session);
    if (!user) throw new ApiError(404, 'User not found.');

    const isB2B = user.role === 'b2bAdmin' || user.role === 'b2bEmployee';
    const config = await getLoyaltyConfig();
    const enabled = isB2B ? config.b2bEnabled : config.enabled;
    if (!enabled) throw new ApiError(400, 'Loyalty program is currently disabled.');

    const minRedeemPoints = isB2B ? (config.b2bMinRedeemPoints ?? 50) : (config.minRedeemPoints ?? 50);
    if (pointsToRedeem < minRedeemPoints) {
        throw new ApiError(400, `Minimum redemption amount is ${minRedeemPoints} points.`);
    }

    if (user.loyaltyPointsBalance < pointsToRedeem) {
        throw new ApiError(400, `Insufficient loyalty points balance. Available: ${user.loyaltyPointsBalance}`);
    }

    const redemptionRatio = isB2B ? (1 / (config.b2bPointsToRupeeRatio ?? 5)) : (config.redemptionRatio ?? 0.2);
    const discountAmount = parseFloat((pointsToRedeem * redemptionRatio).toFixed(2));

    user.loyaltyPointsBalance = Math.max(0, user.loyaltyPointsBalance - pointsToRedeem);
    user.lifetimeRedeemed += pointsToRedeem;
    await user.save({ session });

    await LoyaltyTransaction.create([{
        userId,
        orderId,
        points: pointsToRedeem,
        type: 'redeem',
        description: `Redeemed points at checkout for Rs.${discountAmount} discount`,
        orderType: isB2B ? 'B2B' : 'B2C',
        balanceAfterTransaction: user.loyaltyPointsBalance
    }], { session });

    // Non-blocking Loyalty Redeem Notification (Item 234)
    sendLoyaltyPointsRedeemedEmail({
        user,
        pointsRedeemed: pointsToRedeem,
        discountAmount,
        totalBalance: user.loyaltyPointsBalance,
        orderId
    }).catch(err => console.error('[LoyaltyNotification] Redeem email error:', err.message));

    return discountAmount;
};

export const reverseEarnedPoints = async (userId, orderId, session = null) => {
    const user = await User.findById(userId).session(session);
    if (!user) return;

    const isB2B = user.role === 'b2bAdmin' || user.role === 'b2bEmployee';

    const earnTransaction = await LoyaltyTransaction.findOne({
        userId,
        orderId,
        type: 'earn'
    }).session(session);

    if (!earnTransaction) return;

    // Create refund adjustment / debit transaction
    const pointsToReverse = earnTransaction.points;
    user.loyaltyPointsBalance = Math.max(0, user.loyaltyPointsBalance - pointsToReverse);
    user.lifetimeEarned = Math.max(0, user.lifetimeEarned - pointsToReverse);
    if (isB2B) {
        user.b2bLifetimeEarned = Math.max(0, (user.b2bLifetimeEarned || 0) - pointsToReverse);
    } else {
        user.b2cLifetimeEarned = Math.max(0, (user.b2cLifetimeEarned || 0) - pointsToReverse);
    }
    await user.save({ session });

    await LoyaltyTransaction.create([{
        userId,
        orderId,
        points: pointsToReverse,
        type: 'refund_adjustment',
        description: `Reversal of earned points due to order cancellation/refund`,
        orderType: isB2B ? 'B2B' : 'B2C',
        balanceAfterTransaction: user.loyaltyPointsBalance
    }], { session });
};

export const restoreRedeemedPoints = async (userId, orderId, session = null) => {
    const user = await User.findById(userId).session(session);
    if (!user) return;

    const isB2B = user.role === 'b2bAdmin' || user.role === 'b2bEmployee';

    const redeemTransaction = await LoyaltyTransaction.findOne({
        userId,
        orderId,
        type: 'redeem'
    }).session(session);

    if (!redeemTransaction) return;

    const pointsToRestore = redeemTransaction.points;
    user.loyaltyPointsBalance += pointsToRestore;
    user.lifetimeRedeemed = Math.max(0, user.lifetimeRedeemed - pointsToRestore);
    await user.save({ session });

    await LoyaltyTransaction.create([{
        userId,
        orderId,
        points: pointsToRestore,
        type: 'reversal',
        description: `Restored redeemed points due to order cancellation/refund`,
        orderType: isB2B ? 'B2B' : 'B2C',
        balanceAfterTransaction: user.loyaltyPointsBalance
    }], { session });

    // Non-blocking Loyalty Restore Notification (Items 236 & 237)
    sendLoyaltyPointsRefundRestoredEmail({
        user,
        pointsRestored: pointsToRestore,
        triggerType: 'cancellation',
        orderId,
        totalBalance: user.loyaltyPointsBalance
    }).catch(err => console.error('[LoyaltyNotification] Restore email error:', err.message));
};

export const adminCreditPoints = async (userId, points, adminId, reason, session = null) => {
    const user = await User.findById(userId).session(session);
    if (!user) throw new ApiError(404, 'User not found');

    const isB2B = user.role === 'b2bAdmin' || user.role === 'b2bEmployee';

    user.loyaltyPointsBalance += points;
    user.lifetimeEarned += points;
    if (isB2B) {
        user.b2bLifetimeEarned = (user.b2bLifetimeEarned || 0) + points;
    } else {
        user.b2cLifetimeEarned = (user.b2cLifetimeEarned || 0) + points;
    }
    await user.save({ session });

    await LoyaltyTransaction.create([{
        userId,
        points,
        type: 'admin_credit',
        description: reason || `Admin Credit`,
        orderType: isB2B ? 'B2B' : 'B2C',
        balanceAfterTransaction: user.loyaltyPointsBalance
    }], { session });

    // Non-blocking Loyalty Adjustment Credit Notification (Item 235)
    sendLoyaltyPointsAdjustmentEmail({
        user,
        pointsAdjusted: points,
        adjustmentType: 'credit',
        reason,
        totalBalance: user.loyaltyPointsBalance
    }).catch(err => console.error('[LoyaltyNotification] Admin credit email error:', err.message));

    return user.loyaltyPointsBalance;
};

export const adminDebitPoints = async (userId, points, adminId, reason, session = null) => {
    const user = await User.findById(userId).session(session);
    if (!user) throw new ApiError(404, 'User not found');

    const isB2B = user.role === 'b2bAdmin' || user.role === 'b2bEmployee';

    if (user.loyaltyPointsBalance < points) {
        throw new ApiError(400, `User only has ${user.loyaltyPointsBalance} points.`);
    }

    user.loyaltyPointsBalance = Math.max(0, user.loyaltyPointsBalance - points);
    user.lifetimeRedeemed += points;
    await user.save({ session });

    await LoyaltyTransaction.create([{
        userId,
        points,
        type: 'admin_debit',
        description: reason || `Admin Debit`,
        orderType: isB2B ? 'B2B' : 'B2C',
        balanceAfterTransaction: user.loyaltyPointsBalance
    }], { session });

    // Non-blocking Loyalty Adjustment Debit Notification (Item 235)
    sendLoyaltyPointsAdjustmentEmail({
        user,
        pointsAdjusted: points,
        adjustmentType: 'debit',
        reason,
        totalBalance: user.loyaltyPointsBalance
    }).catch(err => console.error('[LoyaltyNotification] Admin debit email error:', err.message));

    return user.loyaltyPointsBalance;
}
