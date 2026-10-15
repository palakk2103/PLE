import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import Settings from '../../../models/Settings.model.js';
import { clearTransporterCache, testSmtpConnection } from '../../../services/email.service.js';

/**
 * @desc    Get specific settings by key
 * @route   GET /api/admin/settings/:key
 * @access  Private (Admin)
 */
export const getSettings = asyncHandler(async (req, res) => {
    const { key } = req.params;
    
    const setting = await Settings.findOne({ key }).lean();
    let value = setting ? setting.value : null;

    // Secure handling of secrets: mask SMTP password when returning to admin frontend
    if (key === 'email' && value && typeof value === 'object') {
        value = { ...value };
        if (value.smtpPassword) {
            value.smtpPassword = '••••••••';
            value.hasPassword = true;
        } else {
            value.hasPassword = false;
        }
    }
    
    res.status(200).json(new ApiResponse(200, value, `Settings for ${key} fetched successfully.`));
});

/**
 * @desc    Update or create settings by key
 * @route   PUT /api/admin/settings/:key
 * @access  Private (Admin)
 */
export const updateSettings = asyncHandler(async (req, res) => {
    const { key } = req.params;
    let value = req.body.value !== undefined ? req.body.value : req.body;
    
    let setting = await Settings.findOne({ key });
    
    if (key === 'email' && value && typeof value === 'object') {
        const existingVal = setting ? setting.value : {};
        // If password is submitted as mask or empty, preserve the existing DB password
        if (value.smtpPassword === '••••••••' || !value.smtpPassword) {
            value.smtpPassword = existingVal?.smtpPassword || process.env.SMTP_PASS || '';
        }
        delete value.hasPassword;
        // Invalidate transporter cache so updated credentials/host take effect immediately
        clearTransporterCache();
    }
    
    if (setting) {
        setting.value = value;
        await setting.save();
    } else {
        setting = await Settings.create({ key, value });
    }
    
    // Return sanitized response with password masked
    let returnVal = setting.value;
    if (key === 'email' && returnVal && typeof returnVal === 'object') {
        returnVal = { ...returnVal };
        if (returnVal.smtpPassword) {
            returnVal.smtpPassword = '••••••••';
            returnVal.hasPassword = true;
        }
    }
    
    res.status(200).json(new ApiResponse(200, returnVal, `Settings for ${key} updated successfully.`));
});

/**
 * @desc    Test SMTP email connection with provided or saved settings
 * @route   POST /api/admin/settings/email/test
 * @access  Private (Admin / Super Admin)
 */
export const testEmailSettings = asyncHandler(async (req, res) => {
    const { smtpHost, smtpPort, smtpUser, smtpPassword, testRecipient, fromEmail, fromName } = req.body;

    let resolvedPassword = smtpPassword;
    if (!resolvedPassword || resolvedPassword === '••••••••') {
        const existingSetting = await Settings.findOne({ key: 'email' }).lean();
        resolvedPassword = existingSetting?.value?.smtpPassword || process.env.SMTP_PASS || '';
    }

    const testConfig = {
        smtpHost: smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com',
        smtpPort: Number(smtpPort) || Number(process.env.SMTP_PORT) || 587,
        smtpUser: smtpUser || process.env.SMTP_USER || '',
        smtpPassword: resolvedPassword,
        fromEmail: fromEmail || process.env.FROM_EMAIL || smtpUser,
        fromName: fromName || process.env.FROM_NAME || 'Peoples League of Electronics',
        recipientEmail: testRecipient || req.user?.email || smtpUser || process.env.SMTP_USER,
    };

    try {
        const result = await testSmtpConnection(testConfig);
        res.status(200).json(new ApiResponse(200, result, 'SMTP configuration verified and test email dispatched successfully.'));
    } catch (testErr) {
        console.error('[SettingsController] SMTP Test Failed:', testErr.message);
        res.status(400).json(new ApiResponse(400, null, `SMTP Test Failed: ${testErr.message}`));
    }
});
