import express from 'express';
import {
    getAllB2BUsers,
    getB2BUserDetail,
    updateB2BUserStatus,
    deleteB2BUser,
    getB2BAnalytics
} from '../controllers/b2bUser.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize, enforceAccountStatus } from '../../../middlewares/authorize.js';
import { uploadPDFSingle } from '../../../middlewares/upload.js';
import { getTemplates, getTemplateConfigs, uploadTemplate, toggleTemplateStatus, deleteTemplate } from '../controllers/agreement.controller.js';

const router = express.Router();

// Apply admin protection to all routes in this file
router.use(authenticate, authorize('admin', 'superadmin', 'account_team'), enforceAccountStatus);

router.get('/agreement-templates/configs', getTemplateConfigs);
router.get('/agreement-templates', getTemplates);
router.post('/agreement-templates', uploadPDFSingle('file'), uploadTemplate);
router.patch('/agreement-templates/:id/status', toggleTemplateStatus);
router.delete('/agreement-templates/:id', deleteTemplate);

router.get('/analytics', getB2BAnalytics);
router.get('/', getAllB2BUsers);
router.get('/:id', getB2BUserDetail);
router.patch('/:id/status', updateB2BUserStatus);
router.delete('/:id', deleteB2BUser);

export default router;

