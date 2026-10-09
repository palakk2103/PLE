import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Notification from '../../../models/Notification.model.js';
import User from '../../../models/User.model.js';
import { Vendor } from '../../../models/Vendor.model.js';
import DeliveryBoy from '../../../models/DeliveryBoy.model.js';
import { sendPushNotification } from '../../../services/firebaseAdmin.js';

// GET /api/admin/notifications
export const getAdminNotifications = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;
    const skip = (page - 1) * limit;

    const filter = {
        $or: [
            { recipientType: 'admin' },
            { recipientId: req.user._id, recipientType: 'admin' }
        ]
    };

    if (type) {
        filter.type = type;
    }

    const notifications = await Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));

    const total = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({ ...filter, isRead: false });

    res.status(200).json(new ApiResponse(200, {
        notifications,
        total,
        unreadCount,
        page: Number(page),
        pages: Math.ceil(total / limit)
    }, 'Notifications fetched.'));
});

// PUT /api/admin/notifications/:id/read
export const markAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const notification = await Notification.findByIdAndUpdate(
        id,
        { isRead: true },
        { new: true }
    );

    if (!notification) {
        throw new ApiError(404, 'Notification not found.');
    }

    res.status(200).json(new ApiResponse(200, notification, 'Notification marked as read.'));
});

// PUT /api/admin/notifications/read-all
export const markAllAsRead = asyncHandler(async (req, res) => {
    const filter = {
        $or: [
            { recipientType: 'admin' },
            { recipientId: req.user._id, recipientType: 'admin' }
        ],
        isRead: false
    };

    await Notification.updateMany(filter, { isRead: true });

    res.status(200).json(new ApiResponse(200, null, 'All notifications marked as read.'));
});

// POST /api/admin/notifications/broadcast
export const sendBroadcastNotification = asyncHandler(async (req, res) => {
    const { 
        title, 
        message, 
        target = 'all', 
        actionUrl = '', 
        imageUrl = '', 
        type = 'promotion' 
    } = req.body;

    if (!title?.trim() || !message?.trim()) {
        throw new ApiError(400, 'Title and Message are required.');
    }

    const validTargets = ['all', 'customers', 'vendors', 'delivery'];
    if (!validTargets.includes(target)) {
        throw new ApiError(400, `Target must be one of: ${validTargets.join(', ')}`);
    }

    // 10-second debounce / duplicate protection (prevents double submissions)
    const recentDuplicate = await Notification.findOne({
        recipientType: 'admin',
        'data.isBroadcastAudit': 'true',
        title: `Broadcast: ${title}`,
        createdAt: { $gte: new Date(Date.now() - 10000) }
    });
    if (recentDuplicate) {
        throw new ApiError(429, 'This broadcast notification was just sent. Please wait 10 seconds before sending again.');
    }

    // Helper to safely pick only the single latest active token per user to prevent duplicate push
    const pickLatestToken = (webTokens = [], mobileTokens = []) => {
        const all = [
            ...(Array.isArray(webTokens) ? webTokens : []),
            ...(Array.isArray(mobileTokens) ? mobileTokens : [])
        ].filter(Boolean);
        if (all.length === 0) return [];
        return [all[all.length - 1]];
    };

    const rawAudience = []; // Array of { id, recipientType, tokens }

    // 1. Fetch Customers
    if (target === 'all' || target === 'customers') {
        const users = await User.find(
            { isBlocked: { $ne: true } }, 
            '_id fcmTokens fcmTokenMobile'
        ).lean();

        for (const u of users) {
            rawAudience.push({
                id: u._id,
                recipientType: 'user',
                tokens: pickLatestToken(u.fcmTokens, u.fcmTokenMobile)
            });
        }
    }

    // 2. Fetch Vendors
    if (target === 'all' || target === 'vendors') {
        const vendors = await Vendor.find(
            { status: { $in: ['approved', 'active'] } },
            '_id fcmTokens fcmTokenMobile'
        ).lean();

        for (const v of vendors) {
            rawAudience.push({
                id: v._id,
                recipientType: 'vendor',
                tokens: pickLatestToken(v.fcmTokens, v.fcmTokenMobile)
            });
        }
    }

    // 3. Fetch Delivery Personnel
    if (target === 'all' || target === 'delivery') {
        const deliveryBoys = await DeliveryBoy.find(
            { applicationStatus: { $in: ['approved', 'active'] } },
            '_id fcmTokens fcmTokenMobile'
        ).lean();

        for (const d of deliveryBoys) {
            rawAudience.push({
                id: d._id,
                recipientType: 'delivery',
                tokens: pickLatestToken(d.fcmTokens, d.fcmTokenMobile)
            });
        }
    }

    // Strict deduplication of audience by recipientType + ID
    const seenAudience = new Set();
    const targetAudience = [];
    for (const item of rawAudience) {
        const key = `${item.recipientType}:${item.id}`;
        if (!seenAudience.has(key)) {
            seenAudience.add(key);
            targetAudience.push(item);
        }
    }

    // Collect all unique FCM tokens across all recipients
    const allTokens = [];
    for (const item of targetAudience) {
        allTokens.push(...item.tokens);
    }
    const uniqueTokens = [...new Set(allTokens.filter(Boolean))];

    // Send FCM Push Multicast
    let pushResult = { successCount: 0, failureCount: 0, totalTokens: uniqueTokens.length };
    if (uniqueTokens.length > 0) {
        pushResult = await sendPushNotification(uniqueTokens, {
            title,
            body: message,
            imageUrl: imageUrl || undefined,
            data: {
                type,
                target,
                actionUrl: actionUrl || '',
                link: actionUrl || '',
                createdAt: new Date().toISOString()
            }
        });
    }

    // Create In-App Notification Records in MongoDB (Bulk Insert)
    const inAppData = {
        actionUrl: actionUrl || '',
        imageUrl: imageUrl || '',
        sentBy: req.user?._id?.toString() || 'admin'
    };

    const notificationDocs = targetAudience.map(recipient => ({
        recipientId: recipient.id,
        recipientType: recipient.recipientType,
        title,
        message,
        type: type || 'promotion',
        isRead: false,
        data: inAppData
    }));

    if (notificationDocs.length > 0) {
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < notificationDocs.length; i += CHUNK_SIZE) {
            try {
                await Notification.insertMany(notificationDocs.slice(i, i + CHUNK_SIZE), { ordered: false });
            } catch (err) {
                console.warn('[Broadcast Notification] Partial insert notice:', err?.message);
            }
        }
    }

    // Store an admin audit record of this broadcast for history tracking
    await Notification.create({
        recipientType: 'admin',
        title: `Broadcast: ${title}`,
        message,
        type: 'promotion',
        isRead: true,
        data: {
            isBroadcastAudit: 'true',
            target,
            actionUrl: actionUrl || '',
            imageUrl: imageUrl || '',
            recipientsCount: String(targetAudience.length),
            tokensCount: String(uniqueTokens.length),
            pushSuccessCount: String(pushResult.successCount || 0),
            pushFailureCount: String(pushResult.failureCount || 0)
        }
    });

    res.status(200).json(new ApiResponse(200, {
        recipientsTargeted: targetAudience.length,
        devicesTargeted: uniqueTokens.length,
        pushSuccessCount: pushResult.successCount || 0,
        pushFailureCount: pushResult.failureCount || 0,
        pushWarning: pushResult.warning || null
    }, 'Broadcast notification sent successfully.'));
});

// GET /api/admin/notifications/broadcast-history
export const getBroadcastHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const filter = {
        recipientType: 'admin',
        'data.isBroadcastAudit': 'true'
    };

    const [items, total] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        Notification.countDocuments(filter)
    ]);

    res.status(200).json(new ApiResponse(200, {
        history: items,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
    }, 'Broadcast history fetched.'));
});

