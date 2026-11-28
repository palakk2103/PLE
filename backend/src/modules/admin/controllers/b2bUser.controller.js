import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import User from '../../../models/User.model.js';
import Order from '../../../models/Order.model.js';
import ReturnRequest from '../../../models/ReturnRequest.model.js';
import mongoose from 'mongoose';
import RFQ from '../../../models/RFQ.model.js';
import PurchaseOrder from '../../../models/PurchaseOrder.model.js';
import { sendEmail } from '../../../services/email.service.js';
import B2BRegistrationDraft from '../../../models/B2BRegistrationDraft.model.js';
import { cleanApplicationMessage, escapeHtml } from '../../../services/b2bApplication.service.js';

// Full bank account numbers are only visible to roles that handle finance; others see the last 4 digits.
const FULL_BANK_ACCESS_ROLES = ['superadmin', 'account_team'];
const maskBankForRole = (company, role) => {
    if (!company?.bankDetails?.accountNumber || FULL_BANK_ACCESS_ROLES.includes(role)) return company;
    const n = String(company.bankDetails.accountNumber);
    return { ...company, bankDetails: { ...company.bankDetails, accountNumber: `${'*'.repeat(Math.max(n.length - 4, 0))}${n.slice(-4)}`, masked: true } };
};

// GET /api/admin/b2b-users/drafts  - in-progress (unsubmitted) registrations, for visibility only
export const getB2BDrafts = asyncHandler(async (req, res) => {
    const drafts = await B2BRegistrationDraft.find({ status: 'Draft' })
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean();
    const rows = drafts.map((d) => ({
        email: d.email,
        companyName: d.data?.form?.companyName || '',
        currentStep: d.currentStep,
        completedSteps: d.completedSteps,
        updatedAt: d.updatedAt,
        expiresAt: d.expiresAt
    }));
    res.status(200).json(new ApiResponse(200, rows, 'B2B registration drafts fetched.'));
});

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/b2b-users
export const getAllB2BUsers = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20, search } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;
    const filter = {};

    if (status && status !== 'all') {
        if (status === 'pending') filter.verificationStatus = { $in: ['Pending Verification', 'Resubmission Required'] };
        else if (status === 'approved') filter.verificationStatus = 'Approved';
        else if (status === 'rejected') filter.verificationStatus = 'Rejected';
        else if (status === 'resubmission_required') filter.verificationStatus = 'Resubmission Required';
    }

    const trimmedSearch = String(search || '').trim();
    if (trimmedSearch) {
        const safeRegex = new RegExp(escapeRegex(trimmedSearch), 'i');
        filter.$or = [{ companyName: safeRegex }, { businessEmail: safeRegex }, { gstNumber: safeRegex }];
    }

    const b2bCompanies = await B2BCompany.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .lean();
        
    const total = await B2BCompany.countDocuments(filter);
    
    // Enrich with Admin and Employees count
    const enrichedCompanies = await Promise.all(b2bCompanies.map(async (company) => {
        const admin = await User.findOne({ companyId: company._id, role: 'b2bAdmin' }).lean();
        if (admin) {
            admin.adminName = admin.name;
            admin.adminEmail = admin.email;
        }
        const employeeCount = await User.countDocuments({ companyId: company._id, role: 'b2bEmployee' });
        return {
            ...maskBankForRole(company, req.user?.role),
            admin,
            employeeCount
        };
    }));

    res.status(200).json(
        new ApiResponse(200, {
            b2bUsers: enrichedCompanies,
            total,
            page: numericPage,
            pages: Math.ceil(total / numericLimit)
        }, 'B2B Users fetched.')
    );
});

// GET /api/admin/b2b-users/:id
export const getB2BUserDetail = asyncHandler(async (req, res) => {
    const company = await B2BCompany.findById(req.params.id).lean();
    if (!company) throw new ApiError(404, 'B2B Company not found.');

    const admin = await User.findOne({ companyId: company._id, role: 'b2bAdmin' })
        .select('-password -otp -otpExpiry -resetOtp -resetOtpExpiry -refreshTokenHash -refreshTokenExpiresAt')
        .lean();
    if (admin) {
        admin.adminName = admin.name;
        admin.adminEmail = admin.email;
    }
    const employees = await User.find({ companyId: company._id, role: 'b2bEmployee' })
        .select('-password')
        .lean();

    res.status(200).json(new ApiResponse(200, { company: maskBankForRole(company, req.user?.role), admin, employees }, 'B2B User detail fetched.'));
});

// GET /api/admin/b2b-users/:id/orders
// Company-level order history for the super admin: the company is the buyer.
// Employee-wise breakdowns are intentionally not exposed here (that view belongs to the B2B Admin).
export const getB2BCompanyOrders = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid company id.');
    const company = await B2BCompany.findById(req.params.id).select('companyName').lean();
    if (!company) throw new ApiError(404, 'B2B Company not found.');

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const companyId = company._id;

    const filter = { companyId, isDeleted: { $ne: true } };
    if (req.query.status && req.query.status !== 'all') filter.status = req.query.status;

    const SETTLED = ['paid', 'captured', 'success', 'authorized', 'refunded'];
    const [orders, total, orderStats, returnStats] = await Promise.all([
        Order.find(filter)
            .select('orderId status paymentMethod paymentStatus total walletAmountUsed items.name items.quantity createdAt orderType')
            .sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        Order.countDocuments(filter),
        Order.aggregate([
            { $match: { companyId, isDeleted: { $ne: true } } },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                    grossSpent: {
                        $sum: {
                            $cond: [
                                { $and: [{ $ne: ['$status', 'cancelled'] }, { $or: [{ $in: ['$paymentStatus', SETTLED] }, { $in: ['$paymentMethod', ['cod', 'cash']] }] }] },
                                '$total', 0,
                            ],
                        },
                    },
                    lastOrderAt: { $max: '$createdAt' },
                },
            },
        ]),
        ReturnRequest.aggregate([
            { $match: { companyId } },
            {
                $group: {
                    _id: null,
                    totalReturns: { $sum: 1 },
                    refundedAmount: { $sum: { $cond: [{ $eq: ['$refundStatus', 'processed'] }, { $ifNull: ['$refundAmount', 0] }, 0] } },
                },
            },
        ]),
    ]);

    const round = (n) => Math.round((n || 0) * 100) / 100;
    const o = orderStats[0] || {};
    const r = returnStats[0] || {};
    const stats = {
        totalOrders: o.totalOrders || 0,
        cancelledOrders: o.cancelledOrders || 0,
        grossSpent: round(o.grossSpent),
        totalReturns: r.totalReturns || 0,
        refundedAmount: round(r.refundedAmount),
        netSpent: round((o.grossSpent || 0) - (r.refundedAmount || 0)),
        lastOrderAt: o.lastOrderAt || null,
    };

    res.status(200).json(new ApiResponse(200, {
        company, stats, orders, total, page, limit, pages: Math.ceil(total / limit),
    }, 'Company orders fetched.'));
});

const sendCompanyAccessEmail = async (company, status, reason) => {
    const admin = await User.findOne({ companyId: company._id, role: 'b2bAdmin' }).select('email name').lean();
    const html = status === 'Inactive'
        ? `<p>Dear ${escapeHtml(admin?.name || company.companyName)},</p>
           <p>The business account for <strong>${escapeHtml(company.companyName)}</strong> has been deactivated.</p>
           ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
           <p>To ask for reconsideration, sign in with your registered email and password and send us a message from the application status page.</p>`
        : `<p>Dear ${escapeHtml(admin?.name || company.companyName)},</p>
           <p>The business account for <strong>${escapeHtml(company.companyName)}</strong> is active again.</p>`;
    try {
        await sendEmail({
            to: admin?.email || company.businessEmail,
            subject: status === 'Inactive' ? 'Your business account has been deactivated' : 'Your business account is active again',
            text: html.replace(/<[^>]+>/g, ''),
            html,
        });
    } catch (err) {
        console.warn(`B2B company access email failed: ${err.message}`);
    }
};

// POST /api/admin/b2b-users/:id/messages
export const postAdminApplicationMessage = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(400, 'Invalid company id.');
    const message = cleanApplicationMessage(req.body?.message);
    const company = await B2BCompany.findByIdAndUpdate(
        req.params.id,
        { $push: { applicationMessages: { senderType: 'admin', senderName: 'PLE Admin Team', message } } },
        { new: true }
    );
    if (!company) throw new ApiError(404, 'B2B Company not found.');

    const admin = await User.findOne({ companyId: company._id, role: 'b2bAdmin' }).select('email').lean();
    try {
        await sendEmail({
            to: admin?.email || company.businessEmail,
            subject: 'New message about your business application',
            text: `${message}\n\nSign in with your registered email and password to reply from the application status page.`,
            html: `<p>${escapeHtml(message)}</p><p>Sign in with your registered email and password to reply from the application status page.</p>`,
        });
    } catch (err) {
        console.warn(`B2B application message email failed: ${err.message}`);
    }
    res.status(201).json(new ApiResponse(201, company.applicationMessages, 'Message sent.'));
});

// PATCH /api/admin/b2b-users/:id/status
export const updateB2BUserStatus = asyncHandler(async (req, res) => {
    const { status, reason } = req.body;
    const normalized = String(status || '').trim().toLowerCase();

    // Check if this is an active/inactive toggle
    if (['active', 'inactive', 'deactivated'].includes(normalized)) {
        const nextStatus = normalized === 'active' ? 'Active' : 'Inactive';
        const note = String(reason || '').trim();
        const company = await B2BCompany.findByIdAndUpdate(
            req.params.id,
            { status: nextStatus, deactivationReason: nextStatus === 'Inactive' ? note : '' },
            { new: true }
        );
        if (!company) throw new ApiError(404, 'B2B Company not found.');
        await sendCompanyAccessEmail(company, nextStatus, note);
        return res.status(200).json(new ApiResponse(200, company, `Company status updated to ${nextStatus}.`));
    }
    
    // Check if status is resubmission_required
    if (['resubmission_required', 'request_resubmit', 'resubmit'].includes(normalized)) {
        return requestDocumentResubmission(req, res);
    }
    
    let dbStatus;
    if (normalized === 'approved') dbStatus = 'Approved';
    else if (normalized === 'rejected') dbStatus = 'Rejected';
    else throw new ApiError(400, `Status must be one of: approved, rejected, resubmission_required, active, inactive`);

    // Fetch current company first to check if already rejected
    const currentCompany = await B2BCompany.findById(req.params.id);
    if (!currentCompany) throw new ApiError(404, 'B2B Company not found.');

    if (currentCompany.verificationStatus === 'Rejected') {
        throw new ApiError(400, 'Cannot update status of a permanently rejected B2B User.');
    }

    const company = await B2BCompany.findByIdAndUpdate(
        req.params.id, 
        { verificationStatus: dbStatus, rejectionReason: dbStatus === 'Rejected' ? String(reason || '').trim() : '' }, 
        { new: true }
    );
    
    const admin = await User.findOne({ companyId: company._id, role: 'b2bAdmin' });

    let emailSubject = '';
    let emailMessage = '';

    if (dbStatus === 'Approved') {
        emailSubject = 'B2B Account Approved - Ready for Login';
        emailMessage = `
            <h2>Congratulations!</h2>
            <p>Dear ${company.companyName},</p>
            <p>Your B2B account has been successfully verified and approved by the administrator.</p>
            <p><strong>You are now able to login</strong> to your account using your registered Admin email (${admin ? admin.email : company.businessEmail}) and password.</p>
            <br/>
            <p>Thank you for partnering with us.</p>
        `;
    } else if (dbStatus === 'Rejected') {
        emailSubject = 'B2B Account Registration Update';
        emailMessage = `
            <h2>Account Update</h2>
            <p>Dear ${company.companyName},</p>
            <p>Unfortunately, your B2B account registration could not be approved at this time.</p>
            ${reason ? `<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>` : ''}
            <br/>
            <p>To ask for reconsideration, sign in with your registered email and password. The application status page shows your details and lets you message our team.</p>
        `;
    }

    if (emailSubject) {
        try {
            const targetEmail = admin ? admin.email : company.businessEmail;

            await sendEmail({
                to: targetEmail, // Send only to Admin email
                subject: emailSubject,
                text: emailMessage.replace(/<[^>]+>/g, ''), // Strip HTML for text version
                html: emailMessage,
            });
        } catch (err) {
            console.warn(`B2B User status email failed: ${err.message}`);
        }
    }

    res.status(200).json(new ApiResponse(200, company, `B2B User ${status} successfully.`));
});

// POST /api/admin/b2b-users/:id/request-resubmit
export const requestDocumentResubmission = asyncHandler(async (req, res) => {
    const { reason, requestedDocs = [] } = req.body;
    if (!reason || !reason.trim()) {
        throw new ApiError(400, 'Please provide a reason or note specifying why documents need to be re-uploaded.');
    }

    const currentCompany = await B2BCompany.findById(req.params.id);
    if (!currentCompany) throw new ApiError(404, 'B2B Company not found.');

    if (currentCompany.verificationStatus === 'Rejected') {
        throw new ApiError(400, 'Cannot request re-upload for a permanently rejected B2B User.');
    }

    const company = await B2BCompany.findByIdAndUpdate(
        req.params.id,
        {
            verificationStatus: 'Resubmission Required',
            documentResubmitNotes: reason.trim(),
            documentResubmitRequestedAt: new Date(),
            resubmitRequestedDocs: Array.isArray(requestedDocs) ? requestedDocs : []
        },
        { new: true }
    );

    const admin = await User.findOne({ companyId: company._id, role: 'b2bAdmin' });
    const targetEmail = admin ? admin.email : company.businessEmail;
    const targetName = admin ? admin.name : company.companyName;

    // Build document list for email
    const docLabels = {
        acceptanceExecutionDocument: 'Signed Acceptance & Execution Agreement',
        gstCertificate: 'GST Registration Certificate',
        companyRegistrationProof: 'Company Incorporation / Registration Proof'
    };

    const docItemsHtml = company.resubmitRequestedDocs && company.resubmitRequestedDocs.length > 0
        ? `<ul>${company.resubmitRequestedDocs.map(k => `<li><strong>${docLabels[k] || k}</strong></li>`).join('')}</ul>`
        : '<p>Please review and re-upload your business registration documents.</p>';

    const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login`;

    const emailSubject = 'Action Required: Please Re-upload Documents for B2B Registration';
    const emailMessage = `
        <h2>Action Required: Document Re-upload</h2>
        <p>Dear ${targetName},</p>
        <p>Thank you for registering <strong>${company.companyName}</strong> on our B2B platform.</p>
        <p>During our compliance verification review, our administration team noted that some documents need to be re-uploaded before your account can be approved.</p>
        
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin: 16px 0; border-radius: 6px;">
            <p style="margin: 0; color: #92400e; font-weight: bold;">Admin Review Notes:</p>
            <p style="margin: 6px 0 0; color: #78350f;">${reason.trim()}</p>
        </div>

        <p><strong>Documents to Re-upload:</strong></p>
        ${docItemsHtml}

        <p><strong>Next Steps:</strong></p>
        <p>Please log in to your account with your registered admin email (${targetEmail}) and password. You will be prompted to re-upload the requested documents in the Legal Documents section.</p>
        
        <div style="margin: 20px 0;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                Log In & Re-upload Documents
            </a>
        </div>
        
        <p>Once re-submitted, our team will review and complete your verification promptly.</p>
        <br/>
        <p>Best regards,<br/>The B2B Platform Team</p>
    `;

    try {
        await sendEmail({
            to: targetEmail,
            subject: emailSubject,
            text: emailMessage.replace(/<[^>]+>/g, ''),
            html: emailMessage,
        });
    } catch (err) {
        console.warn(`B2B resubmission email sending failed: ${err.message}`);
    }

    res.status(200).json(new ApiResponse(200, company, 'Document re-upload requested successfully.'));
});

// DELETE /api/admin/b2b-users/:id
export const deleteB2BUser = asyncHandler(async (req, res) => {
    const company = await B2BCompany.findById(req.params.id);
    if (!company) throw new ApiError(404, 'B2B Company not found.');

    // Delete Company, Admin, and Employees
    await B2BCompany.findByIdAndDelete(company._id);
    await User.deleteMany({ companyId: company._id });

    res.status(200).json(new ApiResponse(200, null, 'B2B User permanently deleted.'));
});

// GET /api/admin/b2b-users/analytics
export const getB2BAnalytics = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const [
        totalCompanies,
        approvedCompanies,
        pendingCompanies,
        rejectedCompanies,
        suspendedCompanies,
        activeCompanies,
        totalEmployees,
        b2bOrdersAgg,
        totalRFQs,
        totalPOs
    ] = await Promise.all([
        B2BCompany.countDocuments(dateFilter),
        B2BCompany.countDocuments({ verificationStatus: 'Approved', ...dateFilter }),
        B2BCompany.countDocuments({ verificationStatus: 'Pending Verification', ...dateFilter }),
        B2BCompany.countDocuments({ verificationStatus: 'Rejected', ...dateFilter }),
        B2BCompany.countDocuments({ verificationStatus: 'Suspended', ...dateFilter }),
        B2BCompany.countDocuments({ status: 'Active', ...dateFilter }),
        User.countDocuments({ role: { $in: ['b2bAdmin', 'b2bEmployee', 'b2badmin', 'b2bemployee'] }, ...dateFilter }),
        Order.aggregate([
            {
                $match: {
                    $or: [{ orderType: 'b2b' }, { type: 'b2b' }],
                    isDeleted: { $ne: true },
                    status: { $ne: 'cancelled' },
                    ...(dateFilter.createdAt ? { createdAt: dateFilter.createdAt } : {})
                }
            },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$total' }
                }
            }
        ]),
        RFQ.countDocuments(dateFilter),
        PurchaseOrder.countDocuments(dateFilter)
    ]);

    const totalOrders = b2bOrdersAgg[0]?.count || 0;
    const totalRevenue = b2bOrdersAgg[0]?.totalRevenue || 0;
    const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Company Type Distribution
    const rawTypeDist = await B2BCompany.aggregate([
        ...(dateFilter.createdAt ? [{ $match: dateFilter }] : []),
        { $group: { _id: '$companyType', count: { $sum: 1 } } },
        { $project: { type: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } }
    ]);
    const companyTypeDistribution = rawTypeDist.filter(d => Boolean(d.type));

    // Verification Status Breakdown
    const verificationBreakdown = [
        { status: 'Approved', count: approvedCompanies, color: '#10B981' },
        { status: 'Pending Verification', count: pendingCompanies, color: '#F59E0B' },
        { status: 'Rejected', count: rejectedCompanies, color: '#EF4444' },
        { status: 'Suspended', count: suspendedCompanies, color: '#6B7280' },
    ];

    // Monthly Growth Trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyData = await B2BCompany.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const monthMap = {};
    monthlyData.forEach(item => {
        monthMap[item._id] = item.count;
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const growthTrend = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const key = `${y}-${m}`;
        growthTrend.push({
            month: `${monthNames[d.getMonth()]} ${y}`,
            companies: monthMap[key] || 0
        });
    }

    // Top Companies
    const topCompanies = await B2BCompany.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    const enrichedTopCompanies = await Promise.all(topCompanies.map(async (company) => {
        const admin = await User.findOne({ companyId: company._id, role: { $in: ['b2bAdmin', 'b2badmin'] } }).lean();
        const employeeCount = await User.countDocuments({ companyId: company._id });
        const orders = await Order.find({
            $or: [
                { companyId: company._id },
                { userId: admin?._id }
            ],
            isDeleted: { $ne: true }
        }).lean();

        const orderCount = orders.length;
        const totalSpend = orders.reduce((sum, o) => sum + (o.total || 0), 0);

        return {
            _id: company._id,
            companyName: company.companyName,
            companyType: company.companyType,
            businessEmail: company.businessEmail,
            businessPhone: company.businessPhone,
            gstNumber: company.gstNumber,
            verificationStatus: company.verificationStatus,
            status: company.status,
            createdAt: company.createdAt,
            employeeCount,
            adminName: admin?.name || 'N/A',
            adminEmail: admin?.email || company.businessEmail,
            orderCount,
            totalSpend
        };
    }));

    // Recent Registrations
    const recentRegistrations = await B2BCompany.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

    const enrichedRecent = await Promise.all(recentRegistrations.map(async (c) => {
        const admin = await User.findOne({ companyId: c._id, role: { $in: ['b2bAdmin', 'b2badmin'] } }).lean();
        return {
            _id: c._id,
            companyName: c.companyName,
            companyType: c.companyType,
            businessEmail: c.businessEmail,
            verificationStatus: c.verificationStatus,
            status: c.status,
            createdAt: c.createdAt,
            adminName: admin?.name || 'N/A'
        };
    }));

    res.status(200).json(new ApiResponse(200, {
        kpis: {
            totalCompanies,
            approvedCompanies,
            pendingCompanies,
            rejectedCompanies,
            suspendedCompanies,
            activeCompanies,
            totalEmployees,
            totalOrders,
            totalRevenue,
            aov,
            totalRFQs,
            totalPOs
        },
        verificationBreakdown,
        companyTypeDistribution,
        growthTrend,
        topCompanies: enrichedTopCompanies,
        recentRegistrations: enrichedRecent
    }, 'B2B Analytics fetched successfully.'));
});
