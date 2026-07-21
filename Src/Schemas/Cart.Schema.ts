import Joi from 'joi';

// ─── Cart item add / update (Customer) ─────────────────────────────────────

export const addCartItemSchema = Joi.object({
  product_id: Joi.string().uuid().required(),
  quantity: Joi.number().integer().min(1).optional().default(1),
});

export const updateCartItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
}).messages({
  'any.required': 'quantity is required',
});
