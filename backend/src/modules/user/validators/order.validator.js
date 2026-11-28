import Joi from 'joi';

export const placeOrderSchema = Joi.object({
    items: Joi.array().items(
        Joi.object({
            productId: Joi.string().required(),
            quantity: Joi.number().integer().min(1).required(),
            price: Joi.number().optional(),
            proposalId: Joi.string().hex().length(24).optional(),
            variant: Joi.object().pattern(Joi.string(), Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean())).optional(),
        })
    ).min(1).required(),
    shippingAddress: Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        phone: Joi.string().required(),
        address: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().required(),
        country: Joi.string().required(),
    }).required(),
    paymentMethod: Joi.string().valid('card', 'cash', 'cod', 'wallet', 'mixed').required(),
    couponCode: Joi.string().optional().allow(''),
    shippingOption: Joi.string().valid('standard', 'express', 'bulk').default('standard'),
    loyaltyPointsToRedeem: Joi.number().integer().min(0).optional(),
    walletAmountToUse: Joi.number().min(0).optional(),
});

export const createReturnRequestSchema = Joi.object({
    reason: Joi.string().trim().min(5).max(500).required(),
    vendorId: Joi.string().optional(),
    items: Joi.array()
        .items(
            Joi.object({
                // orderItemId (Order.items[]._id) identifies the exact purchased line; productId alone is
                // still accepted for backward compatibility but is rejected server-side if ambiguous.
                orderItemId: Joi.string().hex().length(24).optional(),
                productId: Joi.string().optional(),
                quantity: Joi.number().integer().min(1).required(),
                reason: Joi.string().trim().max(300).allow('').optional(),
            }).or('orderItemId', 'productId')
        )
        .min(1)
        .optional(),
    images: Joi.array().items(Joi.string().uri()).max(6).optional(),
});
