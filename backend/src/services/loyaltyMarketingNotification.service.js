import { sendEmail } from './email.service.js';
import {
    getMarketingTemplate,
    getAbandonedCartTemplate,
    getLoyaltyTemplate
} from '../utils/sourcingLoyaltyTemplates.js';
import User from '../models/User.model.js';

const CLIENT_URL = process.env.CLIENT_URL || 'https://ple.store';

const resolveUser = async (userOrId) => {
    if (!userOrId) return { email: null, name: 'Valued Customer', id: null };
    if (typeof userOrId === 'string') {
        if (userOrId.includes('@')) return { email: userOrId, name: 'Valued Customer', id: null };
        const user = await User.findById(userOrId).select('name email loyaltyPointsBalance').lean();
        return { email: user?.email, name: user?.name || 'Valued Customer', id: user?._id, balance: user?.loyaltyPointsBalance || 0 };
    }
    return {
        email: userOrId.email,
        name: userOrId.name || 'Valued Customer',
        id: userOrId._id || userOrId.id,
        balance: userOrId.loyaltyPointsBalance || 0
    };
};

// ══════════════════════════════════════════════════════════════════════════════
// 1. MARKETING NOTIFICATIONS (Items 220–229)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Item 220: Welcome campaign
 */
export const sendWelcomeCampaignEmail = async ({ user, promoCode = 'WELCOME10', discountText = '10% OFF YOUR FIRST ORDER' }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const html = getMarketingTemplate({
            headline: `Welcome to PLE Store, ${name}! 🎉`,
            subheadline: 'Your premium e-commerce & commercial procurement destination.',
            customerName: name,
            message: 'We are thrilled to have you as part of the PLE family. Explore curated electronics, commercial hardware, verified multi-vendor storefronts, and earn PLE Loyalty Points on every purchase.',
            promoCode,
            discountText,
            validUntil: 'Valid for 14 days',
            actionUrl: `${CLIENT_URL}/products`,
            actionText: 'Start Exploring'
        });

        return await sendEmail({
            to: email,
            subject: `Welcome to PLE Store! Here is your exclusive welcome gift 🎁`,
            html,
            recipientType: 'customer',
            template: 'marketing_welcome_campaign',
            idempotencyKey: `mkt_welc_${id || email}`,
            metadata: { userId: id, itemNumber: 220 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendWelcomeCampaignEmail error:', err.message);
    }
};

/**
 * Item 221: New products launch / showcase
 */
export const sendNewProductsEmail = async ({ user, products = [], categoryName = 'Featured Category' }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const html = getMarketingTemplate({
            headline: `Fresh Arrivals in ${categoryName} Just Landed!`,
            subheadline: 'Discover the latest additions to the PLE Store catalog.',
            customerName: name,
            message: 'We have just restocked brand new releases from verified manufacturers. Check out the top trending additions picked for you.',
            products,
            actionUrl: `${CLIENT_URL}/category/${encodeURIComponent(categoryName.toLowerCase())}`,
            actionText: `Browse All ${categoryName}`
        });

        return await sendEmail({
            to: email,
            subject: `New Arrivals in ${categoryName} - Just Added to PLE Store`,
            html,
            recipientType: 'customer',
            template: 'marketing_new_products',
            idempotencyKey: `mkt_newprod_${id || email}_${Date.now().toString().slice(0, 6)}`,
            metadata: { userId: id, category: categoryName, itemNumber: 221 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendNewProductsEmail error:', err.message);
    }
};

/**
 * Item 222: Offers
 */
export const sendOffersEmail = async ({ user, title, description, promoCode, discountText, validUntil, products = [] }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const html = getMarketingTemplate({
            headline: title || 'Special Member Offer Just for You',
            subheadline: 'Limited-time exclusive pricing on top tech.',
            customerName: name,
            message: description || 'Take advantage of our exclusive member pricing for verified shoppers.',
            promoCode,
            discountText,
            validUntil,
            products,
            actionUrl: `${CLIENT_URL}/offers`,
            actionText: 'Claim Your Offer'
        });

        return await sendEmail({
            to: email,
            subject: title || `Exclusive PLE Store Offer - Save Big Today`,
            html,
            recipientType: 'customer',
            template: 'marketing_offers',
            idempotencyKey: `mkt_offer_${id || email}_${promoCode || Date.now().toString().slice(0, 6)}`,
            metadata: { userId: id, promoCode, itemNumber: 222 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendOffersEmail error:', err.message);
    }
};

/**
 * Item 223: Promotions
 */
export const sendPromotionsEmail = async ({ user, promotionName, description, discountText, promoCode, bannerUrl, actionUrl }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const html = getMarketingTemplate({
            headline: promotionName || 'Exclusive Seasonal Promotion',
            subheadline: 'Biggest savings of the season across all categories.',
            customerName: name,
            message: description || 'Do not miss our storewide seasonal promotion. Up to 40% off on premium hardware, components, and electronics.',
            promoCode,
            discountText: discountText || 'UP TO 40% OFF',
            actionUrl: actionUrl || `${CLIENT_URL}/promotions`,
            actionText: 'View Promotional Deals'
        });

        return await sendEmail({
            to: email,
            subject: `🔥 ${promotionName || 'Special Promotion'}: Unmissable Savings at PLE Store`,
            html,
            recipientType: 'customer',
            template: 'marketing_promotions',
            idempotencyKey: `mkt_promo_${id || email}_${Date.now().toString().slice(0, 6)}`,
            metadata: { userId: id, itemNumber: 223 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendPromotionsEmail error:', err.message);
    }
};

/**
 * Item 224: Festival campaigns
 */
export const sendFestivalCampaignEmail = async ({ user, festivalName = 'Diwali', title, message, promoCode = 'FESTIVE25', saleEndsAt }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const html = getMarketingTemplate({
            headline: title || `Celebrate ${festivalName} with Grand Savings! ✨`,
            subheadline: `Special ${festivalName} Festive Collection & Mega Deals.`,
            customerName: name,
            message: message || `Wishing you prosperity and joy this festive season! Celebrate with exceptional discounts and double loyalty points on festive purchases.`,
            promoCode,
            discountText: `FESTIVE MEGA DEALS`,
            validUntil: saleEndsAt || 'While festive stocks last',
            actionUrl: `${CLIENT_URL}/festival-sale`,
            actionText: `Shop ${festivalName} Sale`
        });

        return await sendEmail({
            to: email,
            subject: `✨ Celebrate ${festivalName} with PLE Store - Festive Mega Deals Inside!`,
            html,
            recipientType: 'customer',
            template: 'marketing_festival_campaign',
            idempotencyKey: `mkt_fest_${festivalName.toLowerCase()}_${id || email}`,
            metadata: { userId: id, festivalName, itemNumber: 224 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendFestivalCampaignEmail error:', err.message);
    }
};

/**
 * Item 225: Personalized recommendations
 */
export const sendPersonalizedRecommendationsEmail = async ({ user, recommendations = [] }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const html = getMarketingTemplate({
            headline: `Handpicked For You, ${name}`,
            subheadline: 'Based on your browsing and procurement preferences.',
            customerName: name,
            message: 'Our recommendation engine identified these top-rated items matching your recent activity and wishlist.',
            products: recommendations,
            actionUrl: `${CLIENT_URL}/recommendations`,
            actionText: 'Explore Your Personalized Picks'
        });

        return await sendEmail({
            to: email,
            subject: `Curated Picks Just for You - Top Recommendations at PLE Store`,
            html,
            recipientType: 'customer',
            template: 'marketing_recommendations',
            idempotencyKey: `mkt_rec_${id || email}_${Date.now().toString().slice(0, 6)}`,
            metadata: { userId: id, count: recommendations.length, itemNumber: 225 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendPersonalizedRecommendationsEmail error:', err.message);
    }
};

/**
 * Item 226: Abandoned cart
 */
export const sendAbandonedCartEmail = async ({ user, items = [], totalAmount, recoveryUrl, discountOffer }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const html = getAbandonedCartTemplate({
            isCheckout: false,
            customerName: name,
            items,
            totalAmount,
            recoveryUrl: recoveryUrl || `${CLIENT_URL}/cart`,
            discountOffer
        });

        return await sendEmail({
            to: email,
            subject: `🛒 You left items in your cart! Complete your purchase today`,
            html,
            recipientType: 'customer',
            template: 'marketing_abandoned_cart',
            idempotencyKey: `mkt_cart_${id || email}_${Date.now().toString().slice(0, 6)}`,
            metadata: { userId: id, itemCount: items.length, totalAmount, itemNumber: 226 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendAbandonedCartEmail error:', err.message);
    }
};

/**
 * Item 227: Abandoned checkout
 */
export const sendAbandonedCheckoutEmail = async ({ user, items = [], totalAmount, checkoutUrl }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const html = getAbandonedCartTemplate({
            isCheckout: true,
            customerName: name,
            items,
            totalAmount,
            recoveryUrl: checkoutUrl || `${CLIENT_URL}/checkout`,
            discountOffer: { code: 'SAVEEXTRA5', text: '5% extra discount' }
        });

        return await sendEmail({
            to: email,
            subject: `⚡ You were so close! Finish your PLE Store checkout now`,
            html,
            recipientType: 'customer',
            template: 'marketing_abandoned_checkout',
            idempotencyKey: `mkt_chk_${id || email}_${Date.now().toString().slice(0, 6)}`,
            metadata: { userId: id, itemCount: items.length, totalAmount, itemNumber: 227 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendAbandonedCheckoutEmail error:', err.message);
    }
};

/**
 * Item 228: Back in stock
 */
export const sendBackInStockEmail = async ({ user, product }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const html = getMarketingTemplate({
            headline: `Good News: ${product.name} Is Back In Stock!`,
            subheadline: 'An item on your radar is available to order again.',
            customerName: name,
            message: `The item "${product.name}" you were watching is back on the shelves. Hurry before units sell out again!`,
            products: [{
                name: product.name,
                price: product.price,
                image: product.thumbnail || product.images?.[0],
                url: `${CLIENT_URL}/product/${product.slug || product._id}`
            }],
            actionUrl: `${CLIENT_URL}/product/${product.slug || product._id}`,
            actionText: 'Buy Now'
        });

        return await sendEmail({
            to: email,
            subject: `🎉 Back In Stock: ${product.name} is available now!`,
            html,
            recipientType: 'customer',
            template: 'marketing_back_in_stock',
            idempotencyKey: `mkt_stock_${id || email}_${product._id}`,
            metadata: { userId: id, productId: product._id, itemNumber: 228 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendBackInStockEmail error:', err.message);
    }
};

/**
 * Item 229: Price drop
 */
export const sendPriceDropEmail = async ({ user, product, oldPrice, newPrice }) => {
    try {
        const { email, name, id } = await resolveUser(user);
        if (!email) return;

        const savings = (oldPrice && newPrice) ? (oldPrice - newPrice) : null;
        const html = getMarketingTemplate({
            headline: `Price Drop Alert: Save on ${product.name}!`,
            subheadline: `Price reduced from ₹${oldPrice} to ₹${newPrice}`,
            customerName: name,
            message: `An item you have had your eye on just had a price drop! ${savings ? `Save ₹${savings} instantly.` : ''}`,
            discountText: savings ? `SAVE ₹${savings}` : 'PRICE REDUCED',
            products: [{
                name: product.name,
                price: newPrice,
                image: product.thumbnail || product.images?.[0],
                url: `${CLIENT_URL}/product/${product.slug || product._id}`
            }],
            actionUrl: `${CLIENT_URL}/product/${product.slug || product._id}`,
            actionText: 'Grab This Deal'
        });

        return await sendEmail({
            to: email,
            subject: `📉 Price Drop: ${product.name} is now ₹${newPrice}!`,
            html,
            recipientType: 'customer',
            template: 'marketing_price_drop',
            idempotencyKey: `mkt_pdrop_${id || email}_${product._id}_${newPrice}`,
            metadata: { userId: id, productId: product._id, oldPrice, newPrice, itemNumber: 229 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendPriceDropEmail error:', err.message);
    }
};


// ══════════════════════════════════════════════════════════════════════════════
// 2. LOYALTY / PLE POINTS (Items 230–240)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Item 230 & 233: Points earned
 */
export const sendLoyaltyPointsEarnedEmail = async ({ user, pointsEarned, totalBalance, orderId, orderNumber, orderAmount }) => {
    try {
        const { email, name, id, balance } = await resolveUser(user);
        if (!email) return;

        const finalBalance = totalBalance !== undefined ? totalBalance : balance;
        const rupeeValue = (finalBalance * 0.2).toFixed(2); // 5 points = ₹1
        const html = getLoyaltyTemplate({
            title: `You Just Earned +${pointsEarned} PLE Points!`,
            subtitle: 'Thank you for your purchase on PLE Store.',
            customerName: name,
            pointsDelta: pointsEarned,
            isDebit: false,
            balance: finalBalance,
            rupeeValue,
            orderNumber: orderNumber || orderId,
            reason: `You earned ${pointsEarned} loyalty points on your recent order${orderAmount ? ` of ₹${orderAmount}` : ''}. Use them on your next purchase for instant discounts!`,
            actionUrl: `${CLIENT_URL}/account/loyalty`,
            actionText: 'View My Rewards'
        });

        return await sendEmail({
            to: email,
            subject: `+${pointsEarned} PLE Points Earned! Your New Balance: ${finalBalance} pts`,
            html,
            recipientType: 'customer',
            template: 'loyalty_points_earned',
            idempotencyKey: `loy_earn_${id || email}_${orderId || Date.now().toString().slice(0, 8)}`,
            metadata: { userId: id, pointsEarned, orderId, itemNumber: 233 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendLoyaltyPointsEarnedEmail error:', err.message);
    }
};

/**
 * Item 231 & 238: Points expiring / reminder
 */
export const sendLoyaltyPointsExpiringEmail = async ({ user, expiringPoints, expiryDate, currentBalance, isReminder = false }) => {
    try {
        const { email, name, id, balance } = await resolveUser(user);
        if (!email) return;

        const finalBalance = currentBalance !== undefined ? currentBalance : balance;
        const expiryStr = expiryDate ? new Date(expiryDate).toLocaleDateString('en-IN') : 'in 7 days';
        const html = getLoyaltyTemplate({
            title: isReminder ? 'Friendly Reminder: PLE Points Expiring Soon' : 'Your PLE Points Are Expiring Soon',
            subtitle: `Use ${expiringPoints} points before ${expiryStr} so you do not miss out.`,
            customerName: name,
            pointsDelta: expiringPoints,
            isDebit: false,
            balance: finalBalance,
            rupeeValue: (finalBalance * 0.2).toFixed(2),
            expiryDate: expiryStr,
            reason: `You have ${expiringPoints} PLE points set to expire on ${expiryStr}. Apply them at checkout towards any electronics or components to save instantly!`,
            actionUrl: `${CLIENT_URL}/products`,
            actionText: 'Shop & Redeem Points'
        });

        return await sendEmail({
            to: email,
            subject: `⚠️ Reminder: ${expiringPoints} PLE Points Expiring on ${expiryStr}`,
            html,
            recipientType: 'customer',
            template: 'loyalty_points_expiring',
            idempotencyKey: `loy_exp_rem_${id || email}_${expiryStr}`,
            metadata: { userId: id, expiringPoints, expiryDate, itemNumber: isReminder ? 238 : 231 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendLoyaltyPointsExpiringEmail error:', err.message);
    }
};

/**
 * Item 232: Referral rewards
 */
export const sendReferralRewardEmail = async ({ user, refereeName = 'A friend', rewardPoints = 100, currentBalance }) => {
    try {
        const { email, name, id, balance } = await resolveUser(user);
        if (!email) return;

        const finalBalance = currentBalance !== undefined ? currentBalance : balance;
        const html = getLoyaltyTemplate({
            title: `Referral Reward: +${rewardPoints} Bonus Points!`,
            subtitle: `${refereeName} just completed their first order on your invitation.`,
            customerName: name,
            pointsDelta: rewardPoints,
            isDebit: false,
            balance: finalBalance,
            rupeeValue: (finalBalance * 0.2).toFixed(2),
            reason: `Thank you for spreading the word about PLE Store! Because ${refereeName} placed their first order, we've credited ${rewardPoints} bonus points to your wallet.`,
            actionUrl: `${CLIENT_URL}/account/referral`,
            actionText: 'Invite More Friends'
        });

        return await sendEmail({
            to: email,
            subject: `🎁 Referral Bonus: +${rewardPoints} Points credited to your account!`,
            html,
            recipientType: 'customer',
            template: 'loyalty_referral_reward',
            idempotencyKey: `loy_ref_${id || email}_${Date.now().toString().slice(0, 6)}`,
            metadata: { userId: id, rewardPoints, refereeName, itemNumber: 232 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendReferralRewardEmail error:', err.message);
    }
};

/**
 * Item 234: Points redeemed
 */
export const sendLoyaltyPointsRedeemedEmail = async ({ user, pointsRedeemed, discountAmount, totalBalance, orderId, orderNumber }) => {
    try {
        const { email, name, id, balance } = await resolveUser(user);
        if (!email) return;

        const finalBalance = totalBalance !== undefined ? totalBalance : balance;
        const html = getLoyaltyTemplate({
            title: `Redeemed ${pointsRedeemed} PLE Points`,
            subtitle: `You saved ₹${discountAmount} on your purchase!`,
            customerName: name,
            pointsDelta: pointsRedeemed,
            isDebit: true,
            balance: finalBalance,
            rupeeValue: (finalBalance * 0.2).toFixed(2),
            orderNumber: orderNumber || orderId,
            reason: `You successfully redeemed ${pointsRedeemed} loyalty points for a ₹${discountAmount} discount on order #${orderNumber || orderId}.`,
            actionUrl: `${CLIENT_URL}/account/loyalty`,
            actionText: 'View Loyalty History'
        });

        return await sendEmail({
            to: email,
            subject: `Points Redeemed: Saved ₹${discountAmount} on Order #${orderNumber || orderId}`,
            html,
            recipientType: 'customer',
            template: 'loyalty_points_redeemed',
            idempotencyKey: `loy_red_${id || email}_${orderId || Date.now().toString().slice(0, 8)}`,
            metadata: { userId: id, pointsRedeemed, discountAmount, orderId, itemNumber: 234 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendLoyaltyPointsRedeemedEmail error:', err.message);
    }
};

/**
 * Item 235: Points adjustment (Admin Credit / Debit)
 */
export const sendLoyaltyPointsAdjustmentEmail = async ({ user, pointsAdjusted, adjustmentType = 'credit', reason, totalBalance }) => {
    try {
        const { email, name, id, balance } = await resolveUser(user);
        if (!email) return;

        const isDebit = adjustmentType === 'debit';
        const finalBalance = totalBalance !== undefined ? totalBalance : balance;
        const sign = isDebit ? '-' : '+';
        const html = getLoyaltyTemplate({
            title: `Points Adjustment: ${sign}${pointsAdjusted} Points`,
            subtitle: `Account balance adjustment from PLE Support.`,
            customerName: name,
            pointsDelta: pointsAdjusted,
            isDebit,
            balance: finalBalance,
            rupeeValue: (finalBalance * 0.2).toFixed(2),
            reason: reason || `Your points balance was adjusted by customer operations (${isDebit ? 'debit' : 'credit'}).`,
            actionUrl: `${CLIENT_URL}/account/loyalty`,
            actionText: 'View Balance'
        });

        return await sendEmail({
            to: email,
            subject: `Points Balance Adjusted: ${sign}${pointsAdjusted} Points`,
            html,
            recipientType: 'customer',
            template: 'loyalty_points_adjustment',
            idempotencyKey: `loy_adj_${id || email}_${Date.now().toString().slice(0, 8)}`,
            metadata: { userId: id, pointsAdjusted, adjustmentType, itemNumber: 235 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendLoyaltyPointsAdjustmentEmail error:', err.message);
    }
};

/**
 * Item 236 & 237: Points refunded / restored after cancellation or return
 */
export const sendLoyaltyPointsRefundRestoredEmail = async ({ user, pointsRestored, triggerType = 'cancellation', orderId, orderNumber, totalBalance }) => {
    try {
        const { email, name, id, balance } = await resolveUser(user);
        if (!email) return;

        const isReturn = triggerType === 'return';
        const itemNumber = isReturn ? 237 : 236;
        const finalBalance = totalBalance !== undefined ? totalBalance : balance;
        const html = getLoyaltyTemplate({
            title: `+${pointsRestored} Points Restored to Your Wallet`,
            subtitle: `Points refunded following order ${isReturn ? 'return' : 'cancellation'}.`,
            customerName: name,
            pointsDelta: pointsRestored,
            isDebit: false,
            balance: finalBalance,
            rupeeValue: (finalBalance * 0.2).toFixed(2),
            orderNumber: orderNumber || orderId,
            reason: `Because order #${orderNumber || orderId} was ${isReturn ? 'returned and refunded' : 'cancelled'}, the ${pointsRestored} points redeemed on that order have been credited back to your balance in full.`,
            actionUrl: `${CLIENT_URL}/account/loyalty`,
            actionText: 'Check Loyalty Wallet'
        });

        return await sendEmail({
            to: email,
            subject: `+${pointsRestored} Points Restored from Order #${orderNumber || orderId}`,
            html,
            recipientType: 'customer',
            template: 'loyalty_points_restored',
            idempotencyKey: `loy_rest_${id || email}_${orderId}_${triggerType}`,
            metadata: { userId: id, pointsRestored, triggerType, orderId, itemNumber }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendLoyaltyPointsRefundRestoredEmail error:', err.message);
    }
};

/**
 * Item 239: Points expired
 */
export const sendLoyaltyPointsExpiredEmail = async ({ user, pointsExpired, remainingBalance }) => {
    try {
        const { email, name, id, balance } = await resolveUser(user);
        if (!email) return;

        const finalBalance = remainingBalance !== undefined ? remainingBalance : balance;
        const html = getLoyaltyTemplate({
            title: 'Notice: Unused Loyalty Points Expired',
            subtitle: 'Points that passed their validity window have lapsed.',
            customerName: name,
            pointsDelta: pointsExpired,
            isDebit: true,
            balance: finalBalance,
            rupeeValue: (finalBalance * 0.2).toFixed(2),
            reason: `Your ${pointsExpired} unredeemed loyalty points have lapsed according to the annual rewards validity policy. Your remaining balance is ${finalBalance} points.`,
            actionUrl: `${CLIENT_URL}/products`,
            actionText: 'Shop New Deals'
        });

        return await sendEmail({
            to: email,
            subject: `Notice: ${pointsExpired} Unused Loyalty Points Have Expired`,
            html,
            recipientType: 'customer',
            template: 'loyalty_points_expired',
            idempotencyKey: `loy_exp_notif_${id || email}_${Date.now().toString().slice(0, 6)}`,
            metadata: { userId: id, pointsExpired, remainingBalance: finalBalance, itemNumber: 239 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendLoyaltyPointsExpiredEmail error:', err.message);
    }
};

/**
 * Item 240: Loyalty milestone reached
 */
export const sendLoyaltyMilestoneEmail = async ({ user, milestoneName = 'Gold Member', pointsThreshold = 1000, bonusPoints = 250, benefits = [], totalBalance }) => {
    try {
        const { email, name, id, balance } = await resolveUser(user);
        if (!email) return;

        const defaultBenefits = [
            'Priority 24/7 dedicated customer service',
            'Exclusive early access to flash sales & festival deals',
            '1.5x points multiplier on select electronics',
            'Free express shipping vouchers'
        ];

        const finalBalance = totalBalance !== undefined ? totalBalance : balance;
        const html = getLoyaltyTemplate({
            title: `🏆 Milestone Unlocked: Welcome to ${milestoneName}!`,
            subtitle: `You crossed ${pointsThreshold} lifetime points!`,
            customerName: name,
            pointsDelta: bonusPoints || 0,
            isDebit: false,
            balance: finalBalance,
            rupeeValue: (finalBalance * 0.2).toFixed(2),
            milestoneName,
            benefits: benefits.length > 0 ? benefits : defaultBenefits,
            reason: `Congratulations on achieving ${milestoneName} status in the PLE Loyalty Club! As a token of our appreciation, we have awarded you ${bonusPoints} bonus points and unlocked VIP perks.`,
            actionUrl: `${CLIENT_URL}/account/loyalty`,
            actionText: 'Explore VIP Benefits'
        });

        return await sendEmail({
            to: email,
            subject: `🏆 You've Reached ${milestoneName} Status at PLE Store!`,
            html,
            recipientType: 'customer',
            template: 'loyalty_milestone_reached',
            idempotencyKey: `loy_mile_${id || email}_${milestoneName.toLowerCase().replace(/\s+/g, '_')}`,
            metadata: { userId: id, milestoneName, bonusPoints, itemNumber: 240 }
        });
    } catch (err) {
        console.error('[LoyaltyMarketingNotification] sendLoyaltyMilestoneEmail error:', err.message);
    }
};
