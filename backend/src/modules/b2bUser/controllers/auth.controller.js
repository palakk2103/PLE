import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import B2BCompany from '../../../models/B2BCompany.model.js';
import User from '../../../models/User.model.js';
import Settings from '../../../models/Settings.model.js';
import { generateTokens } from '../../../utils/generateToken.js';
import { signPreAuthToken, send2FAOtp } from '../../../services/twoFactor.service.js';
import crypto from 'crypto';
import { sendEmail } from '../../../services/email.service.js';
import { uploadLocalFileToCloudinaryAndCleanupWithType } from '../../../services/upload.service.js';
import B2BRegistrationDraft from '../../../models/B2BRegistrationDraft.model.js';
import {
    validateV2Registration, sanitizeDoc, normalizeMobile, matchesMagicBytes
} from '../../../services/b2bRegistration.service.js';
import fs from 'fs/promises';
import path from 'path';


// Extra fields persisted for the v2 registration. GST data is dropped entirely when the user declared "no GST".
const buildV2CompanyFields = ({ companyData, signatoryData, adminData, draft }) => {
    const a = companyData.addressDetails || {};
    const b = companyData.bankDetails || {};
    const gst = companyData.gstRegistered === true;
    const bankDoc = sanitizeDoc(companyData.bankDocument);
    const isStatement = companyData.bankDocumentType === 'bank_statement';
    return {
        companyRegistrationNumber: companyData.companyRegistrationNumber || undefined,
        gstRegistered: gst,
        gstDetails: gst
            ? { legalName: companyData.gstDetails?.legalName, registrationType: companyData.gstDetails?.registrationType, state: companyData.gstDetails?.state }
            : undefined,
        gstCertificate: gst ? sanitizeDoc(companyData.gstCertificate) : undefined,
        addressDetails: { line1: a.line1, line2: a.line2, country: a.country, state: a.state, city: a.city, pincode: a.pincode },
        addressProof: sanitizeDoc(companyData.addressProof),
        bankDetails: {
            accountHolderName: b.accountHolderName, bankName: b.bankName, accountNumber: b.accountNumber,
            ifscCode: String(b.ifscCode || '').toUpperCase(), accountType: b.accountType, branchName: b.branchName
        },
        bankDocumentType: companyData.bankDocumentType,
        cancelledCheque: isStatement ? undefined : bankDoc,
        bankStatement: isStatement ? bankDoc : undefined,
        authorisedSignatory: {
            fullName: signatoryData.fullName,
            designation: signatoryData.designation,
            email: signatoryData.email,
            mobile: normalizeMobile(signatoryData.mobile),
            identityDocument: sanitizeDoc(signatoryData.identityDocument),
            authorisationDocument: sanitizeDoc(signatoryData.authorisationDocument),
            declaration: { accepted: signatoryData.declarationAccepted === true, acceptedAt: new Date() }
        },
        adminInfo: {
            sameAsSignatory: adminData.sameAsSignatory === true,
            name: adminData.adminName, email: adminData.adminEmail, phone: normalizeMobile(adminData.adminPhone),
            designation: adminData.designation
        },
        registrationInfo: { version: 2, submittedAt: new Date(), draftId: draft?._id }
    };
};

// POST /api/b2b-user/auth/register
export const registerB2BUser = asyncHandler(async (req, res) => {
    const { companyData, adminData, employees, signatoryData, draftToken } = req.body;
    // version 2 = the 4-step registration (address/bank/GST/signatory). Legacy payloads keep working unchanged.
    const isV2 = Number(req.body.version) === 2;

    if (!companyData || !adminData) {
        throw new ApiError(400, 'Company and Admin data must be provided.');
    }

    if (isV2) {
        if (!signatoryData) throw new ApiError(400, 'Authorised signatory details must be provided.');
        // "Same as Authorised Signatory": the server fills any blank admin field from the signatory record.
        if (adminData.sameAsSignatory) {
            adminData.adminName = adminData.adminName || signatoryData.fullName;
            adminData.adminEmail = adminData.adminEmail || signatoryData.email;
            adminData.adminPhone = adminData.adminPhone || signatoryData.mobile;
            adminData.designation = adminData.designation || signatoryData.designation;
        }
        const v2Errors = validateV2Registration({ companyData, signatoryData, adminData });
        if (v2Errors.length) {
            throw new ApiError(400, v2Errors.map((e) => e.message).join(' '), v2Errors);
        }
    }

    const { 
        companyName, 
        gstNumber, 
        businessEmail, 
        businessPhone, 
        businessAddress, 
        businessType, 
        website, 
        secretKey, 
        acceptanceExecutionDocument,
        companyRegistrationProof
    } = companyData;
    const { adminName, adminEmail, adminPhone, password } = adminData;

    const gstOptional = isV2 && companyData.gstRegistered === false;
    const addr = companyData.addressDetails || {};
    const composedAddress = isV2
        ? [addr.line1, addr.line2, addr.city, addr.state, addr.pincode, addr.country].filter(Boolean).join(', ')
        : businessAddress;

    if (!companyName || (!gstNumber && !gstOptional) || !businessEmail || !businessPhone || !composedAddress || !businessType) {
        throw new ApiError(400, 'All required company fields must be provided.');
    }

    if (!acceptanceExecutionDocument || !acceptanceExecutionDocument.url) {
        throw new ApiError(400, 'Signed Acceptance & Execution Agreement is required.');
    }


    if (!secretKey || secretKey.length < 6) {
        throw new ApiError(400, 'Owner Secret Key must be at least 6 characters.');
    }

    if (!adminName || !adminEmail || !adminPhone || !password) {
        throw new ApiError(400, 'All required admin fields must be provided.');
    }

    // The draft (if any) must belong to this registration email and the caller must own it.
    let draft = null;
    if (draftToken) {
        draft = await B2BRegistrationDraft.findOne({ email: businessEmail.toLowerCase() }).select('+tokenHash');
        if (!draft || draft.tokenHash !== crypto.createHash('sha256').update(String(draftToken)).digest('hex')) {
            throw new ApiError(403, 'Draft ownership could not be verified. Resume your draft again.');
        }
    }

    const existingCompany = await B2BCompany.findOne({ businessEmail: businessEmail.toLowerCase() });
    if (existingCompany) {
        throw new ApiError(400, 'A B2B Company with this business email already exists.');
    }

    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (existingAdmin) {
        throw new ApiError(400, 'A user with this admin email already exists.');
    }

    // Set status to Pending Verification so that registration requires SuperAdmin approval.
    let verificationStatus = 'Pending Verification';

    // 1. Create Company
    const b2bCompany = await B2BCompany.create({
        companyName,
        gstNumber: gstOptional ? '' : gstNumber,
        businessEmail,
        businessPhone,
        companyAddress: composedAddress,
        companyType: businessType,
        website,
        ownerSecretKey: secretKey,
        verificationStatus,
        acceptanceExecutionDocument,
        ...(companyRegistrationProof ? { companyRegistrationProof } : {}),
        ...(isV2 ? buildV2CompanyFields({ companyData, signatoryData, adminData, draft }) : {})
    });


    // 2. Create Admin
    const b2bAdmin = await User.create({
        companyId: b2bCompany._id,
        name: companyName,
        email: adminEmail,
        phone: isV2 ? normalizeMobile(adminPhone) : adminPhone,
        password,
        role: 'b2bAdmin',
        b2bRole: 'Admin',
        isVerified: true,
        isActive: true
    });

    if (draft) {
        await B2BRegistrationDraft.deleteOne({ _id: draft._id });
    }

    // Send email to Admin
    try {
        let subject = 'B2B Registration Received - Pending Verification';
        let statusMessage = "Your company <strong>${companyName}</strong> has been successfully registered and is currently pending verification.</p><p>We will review your application and notify you once it's approved.</p>";
        
        if (verificationStatus === 'Approved') {
            subject = 'B2B Registration Successful - Account Approved';
            statusMessage = "Your company <strong>${companyName}</strong> has been successfully registered and your account is automatically approved.</p><p>You can now log in and start using our platform.</p>";
        }

        await sendEmail({
            to: adminEmail,
            subject,
            html: `
                <h2>Welcome to our B2B Platform!</h2>
                <p>Dear ${adminName},</p>
                <p>${statusMessage}
                <br>
                <p>Thank you!</p>
            `,
        });
    } catch (err) {
        console.error('Failed to send admin registration email:', err);
    }

    // 3. Create Employees (optional)
    if (employees && Array.isArray(employees) && employees.length > 0) {
        for (const emp of employees) {
            // Check if employee email already exists across the system
            const existingEmp = await User.findOne({ email: emp.email.toLowerCase() });
            if (!existingEmp) {
                // We split name into firstName and lastName for Employee Schema
                const nameParts = (emp.name || '').split(' ');
                const firstName = nameParts[0] || 'Unknown';
                const lastName = nameParts.slice(1).join(' ') || 'Unknown';
                const empPassword = emp.password || 'Employee@123';

                await User.create({
                    companyId: b2bCompany._id,
                    name: emp.name || 'Unknown',
                    firstName,
                    lastName,
                    email: emp.email,
                    phone: emp.phone,
                    password: empPassword,
                    designation: emp.designation,
                    department: emp.department,
                    address: emp.address,
                    role: 'b2bEmployee',
                    b2bRole: 'Staff',
                    isVerified: true,
                    isActive: true
                });

                // Send email to Employee
                const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/login`;
                try {
                    const emailHtml = `
                        <h2>Welcome to the B2B Platform!</h2>
                        <p>You have been added as an employee for <strong>${companyName}</strong>.</p>
                        <p><strong>Your Login Credentials:</strong></p>
                        <ul>
                            <li>Email: ${emp.email}</li>
                            <li>Password: ${empPassword}</li>
                        </ul>
                        <p>Please note: You will be able to login once your company's account is verified and approved. You can login at <a href="${loginUrl}">login here</a> and change your password as soon as possible.</p>
                    `;

                    await sendEmail({
                        to: emp.email,
                        subject: 'Your B2B Employee Account Credentials',
                        text: emailHtml.replace(/<[^>]+>/g, ''),
                        html: emailHtml,
                    });
                } catch (err) {
                    console.error('Failed to send employee credentials email:', err);
                }
            }
        }
    }

    const adminObj = b2bAdmin.toObject();
    delete adminObj.password;

    const responseMessage = verificationStatus === 'Approved' 
        ? 'B2B Registration successful. Your account is approved.'
        : 'B2B Registration successful. Awaiting admin approval.';

    res.status(201).json(new ApiResponse(201, { company: b2bCompany, admin: adminObj }, responseMessage));
});

// POST /api/b2b-user/auth/login
export const loginB2BUser = asyncHandler(async (req, res) => {
    let { businessEmail, password } = req.body;

    if (!businessEmail || !password) {
        throw new ApiError(400, 'Admin email and password are required.');
    }

    businessEmail = businessEmail.trim();
    password = password.trim();

    let b2bAdmin = await User.findOne({ 
        email: businessEmail.toLowerCase(),
        role: { $in: ['b2bAdmin', 'b2bEmployee'] }
    }).select('+password').populate('companyId');

    if (!b2bAdmin) {
        throw new ApiError(401, 'Invalid email or password.');
    }

    let isEmployee = b2bAdmin.role === 'b2bEmployee';

    const isMatch = await b2bAdmin.comparePassword(password);
    if (!isMatch) {
        throw new ApiError(401, 'Invalid email or password.');
    }

    if (b2bAdmin.twoFactorEnabled) {
        const tempToken = signPreAuthToken({ 
            id: b2bAdmin._id, 
            role: b2bAdmin.role, 
            email: b2bAdmin.email,
            companyId: b2bAdmin.companyId._id || b2bAdmin.companyId
        });
        await send2FAOtp(b2bAdmin, b2bAdmin.role);
        return res.status(200).json(new ApiResponse(200, {
            status: '2FA_PENDING',
            tempToken,
            email: b2bAdmin.email
        }, 'Two-factor authentication required.'));
    }

    const b2bCompany = b2bAdmin.companyId;

    if (b2bCompany.verificationStatus === 'Resubmission Required') {
        if (isEmployee) {
            throw new ApiError(403, 'Account login restricted. Company registration documents require re-upload by the Company Admin.');
        }
        // Allow b2bAdmin to log in so they can re-upload requested documents
    } else if (b2bCompany.verificationStatus !== 'Approved') {
        throw new ApiError(403, `Account login denied. Company status is: ${b2bCompany.verificationStatus}.`);
    }

    const { accessToken, refreshToken } = generateTokens({ 
        id: b2bAdmin._id, 
        role: b2bAdmin.role, 
        email: b2bAdmin.email,
        companyId: b2bAdmin.companyId._id || b2bAdmin.companyId
    });

    b2bAdmin.refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    b2bAdmin.refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await b2bAdmin.save();

    const adminObj = b2bAdmin.toObject();
    delete adminObj.password;
    delete adminObj.refreshTokenHash;
    
    // Fallback mapping for frontend stores
    adminObj.adminEmail = adminObj.email;
    adminObj.adminName = adminObj.name;
    if (isEmployee) {
        adminObj.isEmployee = true;
    }

    res.cookie('b2bRefreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json(new ApiResponse(200, { b2bAdmin: adminObj, company: b2bCompany, accessToken }, 'Login successful.'));
});

// POST /api/b2b-user/auth/logout
export const logoutB2BUser = asyncHandler(async (req, res) => {
    const { id } = req.user || {}; 
    if (id) {
        await User.findByIdAndUpdate(id, {
            $unset: { refreshTokenHash: 1, refreshTokenExpiresAt: 1 }
        });
    }

    res.clearCookie('b2bRefreshToken');
    res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
});

// POST /api/b2b-user/auth/upload-agreement
export const uploadB2BAgreement = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'No file uploaded.');
    }
    const folder = 'b2b/agreements';
    const result = await uploadLocalFileToCloudinaryAndCleanupWithType(req.file.path, folder, 'raw');
    res.status(200).json(
        new ApiResponse(200, {
            url: result.url,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date()
        }, 'Agreement uploaded successfully.')
    );
});

// POST /api/b2b-user/auth/upload-document
export const uploadB2BRegistrationDocument = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'No file uploaded.');
    }
    const folder = 'b2b/registration_proofs';
    const result = await uploadLocalFileToCloudinaryAndCleanupWithType(req.file.path, folder, 'auto');
    res.status(200).json(
        new ApiResponse(200, {
            url: result.url,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date()
        }, 'Company document uploaded successfully.')
    );
});



// POST /api/b2b-user/auth/upload-registration-doc  (PDF / JPG / PNG, 5MB; magic bytes verified)
export const uploadB2BRegistrationDoc = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, 'No file uploaded.');
    }
    const ext = path.extname(req.file.originalname || '').slice(1).toLowerCase();
    const fd = await fs.open(req.file.path, 'r');
    const head = Buffer.alloc(8);
    await fd.read(head, 0, 8, 0);
    await fd.close();
    if (!matchesMagicBytes(head, ext)) {
        await fs.unlink(req.file.path).catch(() => {});
        throw new ApiError(400, 'File content does not match its extension.');
    }
    const result = await uploadLocalFileToCloudinaryAndCleanupWithType(req.file.path, 'b2b/registration_docs', 'auto');
    res.status(200).json(
        new ApiResponse(200, {
            url: result.url,
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            uploadedAt: new Date()
        }, 'Document uploaded successfully.')
    );
});
