/**
 * Order Status Constants & Lifecycle Mappings
 * Peoples League of Electronics (PLE)
 */

export const ORDER_STATUSES = {
    PENDING: 'pending',
    PROCESSING: 'processing',
    SHIPPED: 'shipped',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
    RETURNED: 'returned',
};

export const ORDER_STATUS_CONFIG = {
    [ORDER_STATUSES.PENDING]: {
        label: 'Order Confirmed',
        customerMessage: 'Your order has been confirmed and is being prepared.',
        emailSubject: (orderId) => `Your Order #${orderId} is Confirmed 🎉`,
        timelineStep: 1,
        color: 'amber',
        isTerminal: false,
    },
    [ORDER_STATUSES.PROCESSING]: {
        label: 'Order Packed',
        customerMessage: 'Your order has been packed and is ready for dispatch.',
        emailSubject: (orderId) => `Your Order #${orderId} has been Packed 📦`,
        timelineStep: 2,
        color: 'blue',
        isTerminal: false,
    },
    [ORDER_STATUSES.SHIPPED]: {
        label: 'Order Shipped',
        customerMessage: 'Your order has been shipped and is in transit.',
        emailSubject: (orderId) => `Your Order #${orderId} has been Shipped 🚚`,
        timelineStep: 3,
        color: 'indigo',
        isTerminal: false,
    },
    [ORDER_STATUSES.OUT_FOR_DELIVERY]: {
        label: 'Out for Delivery',
        customerMessage: 'Your order is out for delivery with our delivery partner.',
        emailSubject: (orderId) => `Your Order #${orderId} is Out for Delivery 🛵`,
        timelineStep: 4,
        color: 'purple',
        isTerminal: false,
    },
    [ORDER_STATUSES.DELIVERED]: {
        label: 'Order Delivered',
        customerMessage: 'Your order has been successfully delivered. Thank you for shopping with us!',
        emailSubject: (orderId) => `Your Order #${orderId} has been Delivered ✅`,
        timelineStep: 5,
        color: 'green',
        isTerminal: true,
    },
    [ORDER_STATUSES.CANCELLED]: {
        label: 'Order Cancelled',
        customerMessage: 'Your order has been cancelled.',
        emailSubject: (orderId) => `Your Order #${orderId} has been Cancelled`,
        timelineStep: null,
        color: 'red',
        isTerminal: true,
    },
    [ORDER_STATUSES.RETURNED]: {
        label: 'Order Returned',
        customerMessage: 'Your order return has been processed.',
        emailSubject: (orderId) => `Return Processed for Order #${orderId}`,
        timelineStep: null,
        color: 'gray',
        isTerminal: true,
    },
};

export const ALLOWED_STATUS_TRANSITIONS = {
    [ORDER_STATUSES.PENDING]: [ORDER_STATUSES.PROCESSING, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.PROCESSING]: [ORDER_STATUSES.SHIPPED, ORDER_STATUSES.CANCELLED],
    [ORDER_STATUSES.SHIPPED]: [ORDER_STATUSES.OUT_FOR_DELIVERY, ORDER_STATUSES.DELIVERED, ORDER_STATUSES.CANCELLED, ORDER_STATUSES.RETURNED],
    [ORDER_STATUSES.OUT_FOR_DELIVERY]: [ORDER_STATUSES.DELIVERED, ORDER_STATUSES.CANCELLED, ORDER_STATUSES.RETURNED],
    [ORDER_STATUSES.DELIVERED]: [ORDER_STATUSES.RETURNED],
    [ORDER_STATUSES.CANCELLED]: [],
    [ORDER_STATUSES.RETURNED]: [],
};

export const ORDER_TIMELINE_STEPS = [
    ORDER_STATUSES.PENDING,
    ORDER_STATUSES.PROCESSING,
    ORDER_STATUSES.SHIPPED,
    ORDER_STATUSES.OUT_FOR_DELIVERY,
    ORDER_STATUSES.DELIVERED,
];
