import Joi from 'joi';

export const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string().pattern(/^[0-9]{10}$/).optional(),
});

export const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

export const otpSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
});

export const resendOtpSchema = Joi.object({
    email: Joi.string().email().required(),
});

export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required(),
});

export const logoutSchema = Joi.object({
    refreshToken: Joi.string().allow('').optional(),
});

export const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
});

export const verifyResetOtpSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
});

export const resetPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
        'any.only': 'Confirm password must match password.',
    }),
});

export const updateProfileSchema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    // Accept formatted input (+91, spaces, dashes); the controller normalizes to the last 10 digits.
    email: Joi.string().trim().email({ tlds: { allow: false } }).allow('').optional(),
    phone: Joi.string().trim().max(20).allow('', null).optional()
        .custom((value, helpers) => {
            if (!value) return value;
            const digits = String(value).replace(/\D/g, '').slice(-10);
            if (!/^[6-9][0-9]{9}$/.test(digits)) return helpers.message('Please enter a valid 10-digit phone number');
            return value;
        }),
    gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say', '').allow(null).optional(),
    dob: Joi.string().allow('', null).optional(),
});

export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required(),
});
