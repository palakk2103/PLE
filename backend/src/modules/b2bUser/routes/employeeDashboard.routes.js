import express from 'express';
import * as walletRequest from '../controllers/walletRequest.controller.js';
import * as directRfqController from '../controllers/directRfq.controller.js';
import { authenticate } from '../../../middlewares/authenticate.js';
import { authorize } from '../../../middlewares/authorize.js';

const router = express.Router();

router.use(authenticate, authorize('b2bEmployee', 'b2bAdmin'));

router.post('/direct-rfq', directRfqController.createDirectRFQ);
router.get('/direct-rfq', directRfqController.getEmployeeDirectRFQs);
router.get('/direct-rfq/:id', directRfqController.getDirectRFQDetail);

// Wallet top-up requests to the company admin
router.post('/wallet-requests', walletRequest.createWalletRequest);
router.get('/wallet-requests', walletRequest.getMyWalletRequests);
router.post('/wallet-requests/:id/cancel', walletRequest.cancelWalletRequest);
router.post('/direct-rfq/:id/message', directRfqController.sendDirectMessage);

export default router;
