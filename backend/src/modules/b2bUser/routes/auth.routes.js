import express from 'express';
import { registerB2BUser, loginB2BUser, logoutB2BUser, uploadB2BAgreement, uploadB2BRegistrationDocument, uploadB2BRegistrationDoc } from '../controllers/auth.controller.js';
import { saveDraft, requestDraftOtp, verifyDraftOtp, loadDraft, discardDraft } from '../controllers/registrationDraft.controller.js';
import * as twoFactorController from '../../../controllers/twoFactor.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { otpLimiter } from '../../../middlewares/rateLimiter.js';
import { uploadPDFSingle, uploadDocumentSingle, uploadRegistrationDocSingle } from '../../../middlewares/upload.js';

const router = express.Router();

router.post('/register', registerB2BUser);
router.post('/login', loginB2BUser);
router.post('/logout', authenticate, logoutB2BUser);
router.post('/upload-agreement', uploadPDFSingle('file'), uploadB2BAgreement);
router.post('/upload-document', uploadDocumentSingle('file'), uploadB2BRegistrationDocument);
router.post('/upload-registration-doc', uploadRegistrationDocSingle('file'), uploadB2BRegistrationDoc);

// Registration drafts (email-verified resume)
router.post('/draft/save', saveDraft);
router.post('/draft/request-otp', otpLimiter, requestDraftOtp);
router.post('/draft/verify-otp', verifyDraftOtp);
router.post('/draft/load', loadDraft);
router.post('/draft/discard', discardDraft);

// 2FA routes
router.get('/2fa/status', authenticate, twoFactorController.get2FAStatus);
router.post('/2fa/enable', authenticate, twoFactorController.initiateEnable2FA);
router.post('/2fa/verify-enable', authenticate, twoFactorController.verifyEnable2FA);
router.post('/2fa/disable', authenticate, twoFactorController.disable2FA);
router.post('/2fa/verify-login', twoFactorController.verifyLogin2FA);
router.post('/2fa/resend', twoFactorController.resendLogin2FAOtp);

export default router;
