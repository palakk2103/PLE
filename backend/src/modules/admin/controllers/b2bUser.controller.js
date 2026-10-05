import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import User from '../../../models/User.model.js';
import Order from '../../../models/Order.model.js';
import RFQ from '../../../models/RFQ.model.js';
import PurchaseOrder from '../../../models/PurchaseOrder.model.js';
import { sendEmail } from '../../../services/email.service.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/admin/b2b-users
export const getAllB2BUsers = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20, search } = req.query;
    const numericPage = Math.max(parseInt(page, 10) || 1, 1);
    const numericLimit = Math.max(parseInt(limit, 10) || 20, 1);
    const skip = (numericPage - 1) * numericLimit;
    const filter = {};

    if (status && status !== 'all') {
        if (status === 'pending') filter.verificationStatus = 'Pending Verification';
        else if (status === 'approved') filter.verificationStatus = 'Approved';
        else if (status === 'rejected') filter.verificationStatus = 'Rejected';
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
            ...company,
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

    res.status(200).json(new ApiResponse(200, { company, admin, employees }, 'B2B User detail fetched.'));
});

// PATCH /api/admin/b2b-users/:id/status
export const updateB2BUserStatus = asyncHandler(async (req, res) => {
    const { status, reason } = req.body;
    const normalized = String(status || '').trim().toLowerCase();

    // Check if this is an active/inactive toggle
    if (['active', 'inactive', 'deactivated'].includes(normalized)) {
        const nextStatus = normalized === 'active' ? 'Active' : 'Inactive';
        const company = await B2BCompany.findByIdAndUpdate(
            req.params.id,
            { status: nextStatus },
            { new: true }
        );
        if (!company) throw new ApiError(404, 'B2B Company not found.');
        return res.status(200).json(new ApiResponse(200, company, `Company status updated to ${nextStatus}.`));
    }
    
    let dbStatus;
    if (normalized === 'approved') dbStatus = 'Approved';
    else if (normalized === 'rejected') dbStatus = 'Rejected';
    else throw new ApiError(400, `Status must be one of: approved, rejected, active, inactive`);

    // Fetch current company first to check if already rejected
    const currentCompany = await B2BCompany.findById(req.params.id);
    if (!currentCompany) throw new ApiError(404, 'B2B Company not found.');

    if (currentCompany.verificationStatus === 'Rejected') {
        throw new ApiError(400, 'Cannot update status of a permanently rejected B2B User.');
    }

    const company = await B2BCompany.findByIdAndUpdate(
        req.params.id, 
        { verificationStatus: dbStatus }, 
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
            ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
            <br/>
            <p>If you believe this is a mistake, please contact support.</p>
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
