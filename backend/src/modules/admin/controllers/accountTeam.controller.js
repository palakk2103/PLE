import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Admin from '../../../models/Admin.model.js';
import { logActivity } from '../../../services/auditLog.service.js';
import bcrypt from 'bcryptjs';

const CLASS_PREFIX_MAP = {
    employee: 'PLE-EMP-',
    director: 'PLE-DIR-',
    consultant: 'PLE-CON-',
    intern: 'PLE-INT-'
};

/**
 * Safely generate the next sequential unique Identity ID for a class
 */
export const generateUniqueIdentityId = async (identityClass = 'employee') => {
    const normalizedClass = String(identityClass).toLowerCase();
    const prefix = CLASS_PREFIX_MAP[normalizedClass] || 'PLE-EMP-';

    // Find the latest identity ID starting with this prefix
    const regex = new RegExp(`^${prefix}(\\d+)$`);
    const latestWithPrefix = await Admin.find({ identityId: regex })
        .sort({ identityId: -1 })
        .limit(10)
        .select('identityId')
        .lean();

    let maxNum = 0;
    for (const doc of latestWithPrefix) {
        const match = doc.identityId?.match(regex);
        if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxNum) {
                maxNum = num;
            }
        }
    }

    let nextNum = maxNum + 1;
    let candidateId = `${prefix}${String(nextNum).padStart(6, '0')}`;

    // Verify uniqueness in case of gaps or concurrency
    let exists = await Admin.exists({ identityId: candidateId });
    while (exists) {
        nextNum += 1;
        candidateId = `${prefix}${String(nextNum).padStart(6, '0')}`;
        exists = await Admin.exists({ identityId: candidateId });
    }

    return candidateId;
};

// GET /api/admin/account-team/next-id?class=employee
export const getNextId = asyncHandler(async (req, res) => {
    const identityClass = req.query.class || 'employee';
    const nextId = await generateUniqueIdentityId(identityClass);
    return res.status(200).json(new ApiResponse(200, { nextId, identityClass }, 'Next Identity ID generated.'));
});

// POST /api/admin/account-team/provision
export const provisionMember = asyncHandler(async (req, res) => {
    const {
        identityClass = 'employee',
        identityId: requestedIdentityId,
        name,
        email,
        phone,
        department,
        designation,
        contractType = 'Full-Time',
        joiningDate,
        personalSecret,
        initialPassword
    } = req.body;

    if (!name || !name.trim()) throw new ApiError(400, 'Full Name is required.');
    if (!email || !email.trim()) throw new ApiError(400, 'Corporate Email is required.');
    if (!department || !department.trim()) throw new ApiError(400, 'Department is required.');
    if (!designation || !designation.trim()) throw new ApiError(400, 'Designation is required.');
    if (!personalSecret || String(personalSecret).trim().length < 4) {
        throw new ApiError(400, 'Personal Secret Code must be at least 4 characters.');
    }
    if (!initialPassword || String(initialPassword).length < 6) {
        throw new ApiError(400, 'Initial Domain Password must be at least 6 characters.');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existing = await Admin.findOne({ email: normalizedEmail });
    if (existing) {
        throw new ApiError(409, `An account with email "${normalizedEmail}" already exists.`);
    }

    // Determine final Identity ID: Admin-specified or auto-generated
    let identityId;
    if (requestedIdentityId && requestedIdentityId.trim()) {
        identityId = requestedIdentityId.trim().toUpperCase();
        // Check uniqueness for custom identity ID
        const existingId = await Admin.findOne({ identityId });
        if (existingId) {
            throw new ApiError(409, `Identity ID "${identityId}" already exists. Please enter a different ID.`);
        }
    } else {
        identityId = await generateUniqueIdentityId(identityClass);
    }

    // Hash personal secret securely
    const personalSecretHash = await Admin.hashPersonalSecret(personalSecret);

    // Create Account Team user
    const member = new Admin({
        name: name.trim(),
        email: normalizedEmail,
        password: initialPassword, // pre-save hook will hash this
        role: 'account_team',
        userType: 'account_team',
        identityId,
        identityClass: identityClass.toLowerCase(),
        personalSecretHash,
        phone: phone ? phone.trim() : undefined,
        department: department.trim(),
        designation: designation.trim(),
        contractType,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        status: 'active',
        isActive: true,
        createdBy: req.user?.id || null
    });

    await member.save();

    // Audit log
    await logActivity({
        actor: req.user,
        action: 'IDENTITY_PROVISIONED',
        module: 'ACCOUNT_TEAM',
        entityType: 'Admin',
        entityId: member._id,
        description: `Provisioned organizational identity ${identityId} for ${name.trim()} (${department.trim()} - ${designation.trim()})`,
        req,
        status: 'SUCCESS',
        metadata: {
            identityId,
            identityClass,
            name: member.name,
            email: member.email,
            department: member.department,
            designation: member.designation,
            contractType: member.contractType
        }
    });

    return res.status(201).json(new ApiResponse(201, {
        id: member._id,
        identityId: member.identityId,
        identityClass: member.identityClass,
        name: member.name,
        email: member.email,
        phone: member.phone,
        department: member.department,
        designation: member.designation,
        role: member.role,
        contractType: member.contractType,
        status: member.status,
        joiningDate: member.joiningDate,
        createdAt: member.createdAt
    }, `Organizational Identity ${identityId} successfully provisioned.`));
});

// GET /api/admin/account-team
export const getTeamMembers = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const { q, status, department, identityClass } = req.query;
    const filter = {
        role: { $in: ['account_team', 'admin', 'superadmin'] }
    };

    if (q) {
        const queryRegex = new RegExp(q.trim(), 'i');
        filter.$or = [
            { name: queryRegex },
            { email: queryRegex },
            { identityId: queryRegex },
            { department: queryRegex },
            { designation: queryRegex }
        ];
    }

    if (status && status !== 'all') {
        filter.status = status;
    }

    if (department && department !== 'all') {
        filter.department = new RegExp(`^${department.trim()}$`, 'i');
    }

    if (identityClass && identityClass !== 'all') {
        filter.identityClass = identityClass.toLowerCase();
    }

    const [members, total] = await Promise.all([
        Admin.find(filter)
            .select('-password -personalSecretHash -refreshTokenHash -twoFactorOtp')
            .populate('createdBy', 'name email identityId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Admin.countDocuments(filter)
    ]);

    return res.status(200).json(new ApiResponse(200, {
        members,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    }, 'Account team members fetched successfully.'));
});

// GET /api/admin/account-team/:id
export const getMemberById = asyncHandler(async (req, res) => {
    const member = await Admin.findById(req.params.id)
        .select('-password -personalSecretHash -refreshTokenHash -twoFactorOtp')
        .populate('createdBy', 'name email identityId')
        .lean();

    if (!member) throw new ApiError(404, 'Team member not found.');
    return res.status(200).json(new ApiResponse(200, member, 'Member details fetched.'));
});

// PATCH /api/admin/account-team/:id
export const updateMember = asyncHandler(async (req, res) => {
    const { name, phone, department, designation, contractType, joiningDate } = req.body;

    const member = await Admin.findById(req.params.id);
    if (!member) throw new ApiError(404, 'Team member not found.');

    if (name) member.name = name.trim();
    if (phone !== undefined) member.phone = phone.trim();
    if (department) member.department = department.trim();
    if (designation) member.designation = designation.trim();
    if (contractType) member.contractType = contractType;
    if (joiningDate) member.joiningDate = new Date(joiningDate);

    await member.save();

    await logActivity({
        actor: req.user,
        action: 'IDENTITY_UPDATED',
        module: 'ACCOUNT_TEAM',
        entityType: 'Admin',
        entityId: member._id,
        description: `Updated profile details for team member ${member.name} (${member.identityId || member.email})`,
        req,
        status: 'SUCCESS',
        metadata: {
            identityId: member.identityId,
            name: member.name,
            department: member.department,
            designation: member.designation
        }
    });

    return res.status(200).json(new ApiResponse(200, member, 'Member details updated successfully.'));
});

// PATCH /api/admin/account-team/:id/status
export const toggleMemberStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!status || !['active', 'inactive'].includes(status)) {
        throw new ApiError(400, 'Valid status ("active" or "inactive") is required.');
    }

    const member = await Admin.findById(req.params.id);
    if (!member) throw new ApiError(404, 'Team member not found.');

    // Prevent deactivating own Super Admin account
    if (String(member._id) === String(req.user.id)) {
        throw new ApiError(400, 'You cannot deactivate your own account.');
    }

    member.status = status;
    member.isActive = status === 'active';
    await member.save();

    await logActivity({
        actor: req.user,
        action: status === 'active' ? 'IDENTITY_ACTIVATED' : 'IDENTITY_DEACTIVATED',
        module: 'ACCOUNT_TEAM',
        entityType: 'Admin',
        entityId: member._id,
        description: `${status === 'active' ? 'Activated' : 'Deactivated'} account for ${member.name} (${member.identityId || member.email})`,
        req,
        status: 'SUCCESS',
        metadata: {
            identityId: member.identityId,
            newStatus: status
        }
    });

    return res.status(200).json(new ApiResponse(200, {
        id: member._id,
        status: member.status,
        isActive: member.isActive
    }, `Team member marked as ${status}.`));
});

// POST /api/admin/account-team/:id/reset-credentials
export const resetCredentials = asyncHandler(async (req, res) => {
    const { newPassword, newPersonalSecret } = req.body;

    if (!newPassword && !newPersonalSecret) {
        throw new ApiError(400, 'Please provide at least a new password or a new personal secret code.');
    }

    const member = await Admin.findById(req.params.id);
    if (!member) throw new ApiError(404, 'Team member not found.');

    const changes = [];

    if (newPassword) {
        if (String(newPassword).length < 6) {
            throw new ApiError(400, 'New password must be at least 6 characters.');
        }
        member.password = await bcrypt.hash(newPassword, 12);
        changes.push('password');
    }

    if (newPersonalSecret) {
        if (String(newPersonalSecret).length < 4) {
            throw new ApiError(400, 'New personal secret code must be at least 4 characters.');
        }
        member.personalSecretHash = await Admin.hashPersonalSecret(newPersonalSecret);
        changes.push('personalSecret');
    }

    await member.save();

    await logActivity({
        actor: req.user,
        action: 'CREDENTIAL_RESET',
        module: 'ACCOUNT_TEAM',
        entityType: 'Admin',
        entityId: member._id,
        description: `Reset credentials (${changes.join(', ')}) for ${member.name} (${member.identityId || member.email})`,
        req,
        status: 'SUCCESS',
        metadata: {
            identityId: member.identityId,
            credentialsChanged: changes
        }
    });

    return res.status(200).json(new ApiResponse(200, null, 'Credentials successfully reset.'));
});

export default {
    getNextId,
    provisionMember,
    getTeamMembers,
    getMemberById,
    updateMember,
    toggleMemberStatus,
    resetCredentials
};
