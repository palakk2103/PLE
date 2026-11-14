import Joi from 'joi';

const objectId = Joi.string().hex().length(24);
const price = Joi.number().positive().max(100000000);
const qty = Joi.number().integer().min(1).max(1000000);
const text = Joi.string().trim().max(2000).allow('', null);

export const createConsumerRfqSchema = Joi.object({
    productId: objectId.required(),
    quantity: qty.required(),
    expectedPrice: price.allow(null, ''),
    message: text,
});

export const quoteSchema = Joi.object({ price: price.required(), quantity: qty, message: text });
export const counterSchema = quoteSchema;
export const messageSchema = Joi.object({ message: Joi.string().trim().min(1).max(2000).required() });
export const noteSchema = Joi.object({ message: text });
export const acceptSchema = Joi.object({ offerVersion: Joi.number().integer().min(0), shippingAddressId: objectId });
export const idParamSchema = Joi.object({ id: objectId.required() });
export const listQuerySchema = Joi.object({
    status: Joi.string().max(40),
    scope: Joi.string().valid('admin', 'vendor'),
    search: Joi.string().max(60).allow(''),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
});
