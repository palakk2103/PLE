// Fixed test OTPs (such as 123456) let a developer skip email on their own machine.
// They must be switched on deliberately: a server with NODE_ENV left at "development" must not
// accept them. They are never accepted when NODE_ENV is "production".
export const isDevOtpAllowed = () =>
    process.env.ALLOW_DEV_OTP === 'true' && process.env.NODE_ENV !== 'production';
