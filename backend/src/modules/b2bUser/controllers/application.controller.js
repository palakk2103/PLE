import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import User from '../../../models/User.model.js';
import Admin from '../../../models/Admin.model.js';
import Notification from '../../../models/Notification.model.js';
import { verifyApplicationToken, cleanApplicationMessage } from '../../../services/b2bApplication.service.js';

const MAX_MESSAGES = 200;

export const requireApplicationToken = asyncHandler(async (req, res, next) => {
    const token = String(req.header('x-application-token') || '').trim();
    if (!token) throw new ApiError(401, 'Please sign in to view your application.');
    const { userId, companyId } = verifyApplicationToken(token);

    const applicant = await User.findOne({ _id: userId, companyId, role: 'b2bAdmin' }).select('name email').lean();
    const company = applicant ? await B2BCompany.findById(companyId) : null;
    if (!company) throw new ApiError(404, 'Application not found.');

    req.applicant = applicant;
    req.company = company;
    next();
});

const DOCUMENTS = [
    ['companyRegistrationProof', 'Company registration proof'],
    ['acceptanceExecutionDocument', 'Signed Acceptance & Execution Agreement'],
    ['gstCertificate', 'GST registration certificate'],
    ['addressProof', 'Address proof'],
    ['cancelledCheque', 'Cancelled cheque'],
    ['bankStatement', 'Bank statement'],
    ['authorisedSignatory.identityDocument', 'Signatory identity document'],
    ['authorisedSignatory.authorisationDocument', 'Signatory authorisation document'],
];

const lastFour = (value) => (value ? `****${String(value).slice(-4)}` : '');

// What the applicant is allowed to see about their own application.
const toApplicationView = (company, applicant) => {
    const status = company.status === 'Inactive' ? 'Deactivated' : company.verificationStatus;
    const needsCorrection = new Set(company.verificationStatus === 'Resubmission Required' ? company.resubmitRequestedDocs : []);
    const documents = DOCUMENTS
        .map(([key, label]) => ({ key, label, doc: company.get(key) }))
        .filter((d) => d.doc?.url || needsCorrection.has(d.key))
        .map(({ key, label, doc }) => ({
            key,
            label,
            fileName: doc?.fileName || '',
            state: needsCorrection.has(key) ? 'needs_correction' : (status === 'Approved' ? 'accepted' : 'received'),
        }));

    return {
        status,
        reason: status === 'Deactivated' ? company.deactivationReason
            : status === 'Rejected' ? company.rejectionReason
                : status === 'Resubmission Required' ? company.documentResubmitNotes : '',
        submittedAt: company.registrationInfo?.submittedAt || company.createdAt,
        applicant: { name: applicant.name, email: applicant.email },
        details: {
            companyName: company.companyName,
            companyType: company.companyType,
            companyRegistrationNumber: company.companyRegistrationNumber || '',
            gstNumber: company.gstNumber || '',
            businessEmail: company.businessEmail,
            businessPhone: company.businessPhone,
            companyAddress: company.companyAddress,
            website: company.website || '',
            signatory: [company.authorisedSignatory?.fullName, company.authorisedSignatory?.designation].filter(Boolean).join(', '),
            bank: [company.bankDetails?.bankName, lastFour(company.bankDetails?.accountNumber)].filter(Boolean).join(' '),
        },
        documents,
        messages: company.applicationMessages || [],
    };
};

// GET /api/b2b-user/auth/application
export const getApplication = asyncHandler(async (req, res) => {
    res.status(200).json(new ApiResponse(200, toApplicationView(req.company, req.applicant), 'Application fetched.'));
});

// POST /api/b2b-user/auth/application/messages
export const postApplicantMessage = asyncHandler(async (req, res) => {
    const message = cleanApplicationMessage(req.body?.message);
    if ((req.company.applicationMessages || []).length >= MAX_MESSAGES) {
        throw new ApiError(429, 'This conversation is full. Please contact support.');
    }
    const company = await B2BCompany.findByIdAndUpdate(
        req.company._id,
        { $push: { applicationMessages: { senderType: 'applicant', senderName: req.applicant.name, message } } },
        { new: true }
    );

    try {
        const admins = await Admin.find({ isActive: true }).select('_id').lean();
        await Notification.insertMany(admins.map((a) => ({
            recipientId: a._id,
            recipientType: 'admin',
            type: 'system',
            title: 'B2B applicant sent a message',
            message: `${company.companyName}: ${message.slice(0, 120)}`,
            data: { relatedId: String(company._id), onModel: 'B2BCompany' },
        })));
    } catch (err) {
        console.warn('Could not notify admins about an application message:', err.message);
    }

    res.status(201).json(new ApiResponse(201, company.applicationMessages, 'Message sent.'));
});
