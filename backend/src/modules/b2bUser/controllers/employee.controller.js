import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import User from '../../../models/User.model.js';
import WalletTransaction from '../../../models/WalletTransaction.model.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import crypto from 'crypto';
import { sendEmail } from '../../../services/email.service.js';
import * as walletService from '../../../services/wallet.service.js';

export const getCompanyId = async (req) => {
    let companyId = req.user.companyId;
    if (!companyId) {
        const admin = await User.findById(req.user.id);
        if (admin) companyId = admin.companyId;
    }
    if (!companyId) throw new ApiError(404, 'Admin not found or company ID missing.');
    return companyId;
};

/**
 * Move funds from the B2B admin's wallet to an employee's spendable balance,
 * recording it on both ledgers. Returns the admin's updated wallet.
 * Throws (before crediting anything) if the admin wallet can't cover it.
 */
const transferFundsToEmployee = async ({ adminId, employee, companyId, amount }) => {
    const { wallet: adminWallet } = await walletService.debitWallet({
        userId: adminId,
        amount,
        category: 'transfer_out',
        description: `Allotted funds to employee: ${employee.name}`
    });

    employee.b2bWalletBalance = parseFloat(((employee.b2bWalletBalance || 0) + amount).toFixed(2));
    await employee.save();

    // Mirror on the employee's Wallet and record the credit on their own ledger
    const employeeWallet = await walletService.getOrCreateWallet(employee._id);
    employeeWallet.balance = employee.b2bWalletBalance;
    employeeWallet.totalCredit = parseFloat(((employeeWallet.totalCredit || 0) + amount).toFixed(2));
    await employeeWallet.save();

    await WalletTransaction.create({
        walletId: employeeWallet._id,
        userId: employee._id,
        companyId,
        performedBy: adminId,
        type: 'credit',
        transactionCategory: 'b2b_allotment',
        amount,
        balanceAfterTransaction: employee.b2bWalletBalance,
        description: 'Funds allotted by company admin',
        status: 'completed'
    });

    return adminWallet;
};

// Fields a B2B admin may change via "Edit employee". The wallet balance is
// deliberately excluded: it only changes through allotments, orders and refunds,
// so every movement is recorded in the ledger.
const EDITABLE_EMPLOYEE_FIELDS = [
    'firstName', 'lastName', 'phone', 'password', 'designation', 'department',
    'address', 'status', 'role', 'b2bSpendingLimit'
];

/**
 * @desc    Get all employees for the B2B Company
 * @route   GET /api/b2b-user/admin/employees
 * @access  Private (B2B Admin)
 */
export const getEmployees = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);

    const employees = await User.find({ companyId: companyId, role: 'b2bEmployee' }).sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, employees, 'Employees fetched successfully.'));
});

/**
 * @desc    Create a new employee
 * @route   POST /api/b2b-user/admin/employees
 * @access  Private (B2B Admin)
 */
export const createEmployee = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const { firstName, lastName, email, phone, password, role, designation, department, address, b2bWalletBalance, b2bSpendingLimit } = req.body;

    if (!firstName || !lastName || !email) {
        throw new ApiError(400, 'First name, last name, and email are required.');
    }

    const existingEmployee = await User.findOne({ email: email.toLowerCase() });
    if (existingEmployee) {
        throw new ApiError(400, 'A user with this email already exists.');
    }

    // An initial allotment is a real transfer from the admin's wallet: check it can be covered first
    const initialAllotment = Number(b2bWalletBalance) || 0;
    if (initialAllotment < 0) {
        throw new ApiError(400, 'Initial wallet allotment cannot be negative.');
    }
    if (initialAllotment > 0) {
        const adminWallet = await walletService.getOrCreateWallet(req.user.id);
        if (adminWallet.isFrozen) {
            throw new ApiError(400, 'Company wallet is frozen. Cannot allot funds.');
        }
        if (adminWallet.balance < initialAllotment) {
            throw new ApiError(400, `Insufficient company wallet balance for initial allotment. Available: ₹${adminWallet.balance}`);
        }
    }

    const generatedPassword = password || crypto.randomBytes(4).toString('hex');

    const newEmployee = await User.create({
        companyId: companyId,
        name: `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        email,
        phone,
        password: generatedPassword,
        role: 'b2bEmployee',
        b2bRole: role || 'Staff',
        designation,
        department,
        address,
        isActive: true,
        isVerified: true,
        b2bWalletBalance: 0,
        b2bSpendingLimit: Number(b2bSpendingLimit) || 0
    });

    if (initialAllotment > 0) {
        try {
            await transferFundsToEmployee({ adminId: req.user.id, employee: newEmployee, companyId, amount: initialAllotment });
        } catch (err) {
            // Don't leave a half-created employee behind if the transfer fails
            await User.deleteOne({ _id: newEmployee._id });
            throw err;
        }
    }

    const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login`;
    const emailHtml = `
        <h2>Welcome to the B2B Platform!</h2>
        <p>You have been added as an employee.</p>
        <p><strong>Your Login Credentials:</strong></p>
        <ul>
            <li>Email: ${email}</li>
            <li>Password: ${generatedPassword}</li>
        </ul>
        <p>Please <a href="${loginUrl}">login here</a> and change your password as soon as possible.</p>
    `;

    try {
        await sendEmail({
            to: email,
            subject: 'Your B2B Employee Account Credentials',
            text: emailHtml.replace(/<[^>]+>/g, ''),
            html: emailHtml,
        });
    } catch (error) {
        console.error('Failed to send employee credentials email:', error);
    }

    const employeeResponse = newEmployee.toObject();
    delete employeeResponse.password;

    res.status(201).json(new ApiResponse(201, employeeResponse, 'Employee created successfully.'));
});

/**
 * @desc    Update an employee
 * @route   PUT /api/b2b-user/admin/employees/:id
 * @access  Private (B2B Admin)
 */
export const updateEmployee = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const employeeId = req.params.id;

    const employee = await User.findOne({ _id: employeeId, companyId: companyId, role: 'b2bEmployee' });

    if (!employee) {
        throw new ApiError(404, 'Employee not found or unauthorized.');
    }

    // Only accept known profile fields (email, companyId, wallet balance etc. are never editable here)
    const updates = {};
    for (const field of EDITABLE_EMPLOYEE_FIELDS) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (updates.firstName || updates.lastName) {
        const fn = updates.firstName || employee.firstName;
        const ln = updates.lastName || employee.lastName;
        updates.name = `${fn} ${ln}`.trim();
    }
    
    // Support mapping frontend role to b2bRole
    if (updates.role) {
        updates.b2bRole = updates.role;
        delete updates.role;
    }
    
    if (updates.status) {
        updates.isActive = updates.status === 'Active';
        delete updates.status;
    }
    
    // Only hash password if it is being explicitly updated and not empty
    if (updates.password) {
        // Will be hashed by pre-save hook, but we use findOneAndUpdate so we need to save explicitly if we want pre-save to run
        // Alternatively, hash it here:
        const bcrypt = await import('bcryptjs');
        updates.password = await bcrypt.default.hash(updates.password, 12);
    } else {
        delete updates.password;
    }

    const updatedEmployee = await User.findByIdAndUpdate(
        employeeId,
        { $set: updates },
        { new: true, runValidators: true }
    );

    res.status(200).json(new ApiResponse(200, updatedEmployee, 'Employee updated successfully.'));
});

/**
 * @desc    Remove an employee (deactivate; never erase)
 * @route   DELETE /api/b2b-user/admin/employees/:id
 * @access  Private (B2B Admin)
 *
 * The employee's record is kept so their orders, returns and wallet history stay
 * visible to the company admin. They simply can no longer sign in or buy. Any
 * remaining wallet balance stays on the account; reactivate via Edit (Status: Active).
 */
export const deleteEmployee = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const employeeId = req.params.id;

    const employee = await User.findOneAndUpdate(
        { _id: employeeId, companyId: companyId, role: 'b2bEmployee' },
        {
            $set: { isActive: false },
            // Invalidate any refresh token so an open session can't silently continue
            $unset: { refreshTokenHash: '', refreshTokenExpiresAt: '' },
        },
        { new: true }
    ).select('name email isActive b2bWalletBalance');

    if (!employee) {
        throw new ApiError(404, 'Employee not found or unauthorized.');
    }

    res.status(200).json(new ApiResponse(200, employee, 'Employee deactivated. Their purchase history has been kept.'));
});

/**
 * @desc    Allot wallet funds to employee
 * @route   POST /api/b2b-user/admin/employees/:id/allot-wallet
 * @access  Private (B2B Admin)
 */
export const allotWalletFunds = asyncHandler(async (req, res) => {
    const companyId = await getCompanyId(req);
    const employeeId = req.params.id;
    const amount = Number(req.body.amount);

    if (isNaN(amount) || amount <= 0) {
        throw new ApiError(400, 'Invalid allotment amount.');
    }

    const employee = await User.findOne({ _id: employeeId, companyId, role: 'b2bEmployee' });
    if (!employee) {
        throw new ApiError(404, 'Employee not found or unauthorized.');
    }

    const adminWallet = await transferFundsToEmployee({ adminId: req.user.id, employee, companyId, amount });

    res.status(200).json(new ApiResponse(200, {
        adminBalance: adminWallet.balance,
        employeeBalance: employee.b2bWalletBalance,
        employee
    }, 'Wallet funds allotted successfully.'));
});
