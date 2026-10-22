import express from 'express';
import { registerB2BUser, loginB2BUser, logoutB2BUser, uploadB2BAgreement, uploadB2BRegistrationDocument } from '../controllers/auth.controller.js';
import * as twoFactorController from '../../../controllers/twoFactor.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { uploadPDFSingle, uploadDocumentSingle } from '../../../middlewares/upload.js';

const router = express.Router();

router.post('/register', registerB2BUser);
router.post('/login', loginB2BUser);
router.post('/logout', authenticate, logoutB2BUser);
router.post('/upload-agreement', uploadPDFSingle('file'), uploadB2BAgreement);
router.post('/upload-document', uploadDocumentSingle('file'), uploadB2BRegistrationDocument);

// 2FA routes
router.get('/2fa/status', authenticate, twoFactorController.get2FAStatus);
router.post('/2fa/enable', authenticate, twoFactorController.initiateEnable2FA);
router.post('/2fa/verify-enable', authenticate, twoFactorController.verifyEnable2FA);
router.post('/2fa/disable', authenticate, twoFactorController.disable2FA);
router.post('/2fa/verify-login', twoFactorController.verifyLogin2FA);
router.post('/2fa/resend', twoFactorController.resendLogin2FAOtp);

export default router;

