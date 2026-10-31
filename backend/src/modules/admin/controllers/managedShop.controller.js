import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import ManagedShop from '../../../models/ManagedShop.model.js';
import ManagedVendorUser from '../../../models/ManagedVendorUser.model.js';

// ─── Managed Shop Controllers ───────────────────────────────────────────────

// POST /api/admin/managed-shops
export const createShop = asyncHandler(async (req, res) => {
    const { name, logo, address, phone, gst, warehouse, description } = req.body;
    if (!name) throw new ApiError(400, 'Shop Name is required.');

    const existing = await ManagedShop.findOne({ name: String(name).trim() });
    if (existing) throw new ApiError(409, 'Shop name already exists.');

    const shop = await ManagedShop.create({
        name: String(name).trim(),
        logo,
        address,
        phone,
        gst,
        warehouse,
        description,
        status: 'active'
    });

    res.status(201).json(new ApiResponse(201, shop, 'Managed Shop created successfully.'));
});

// GET /api/admin/managed-shops
export const getAllShops = asyncHandler(async (req, res) => {
    const shops = await ManagedShop.find().sort({ createdAt: -1 });
    res.status(200).json(new ApiResponse(200, shops, 'Managed Shops fetched successfully.'));
});

// GET /api/admin/managed-shops/:id
export const getShopById = asyncHandler(async (req, res) => {
    const shop = await ManagedShop.findById(req.params.id);
    if (!shop) throw new ApiError(404, 'Managed Shop not found.');
    res.status(200).json(new ApiResponse(200, shop, 'Managed Shop fetched.'));
});

// PUT /api/admin/managed-shops/:id
export const updateShop = asyncHandler(async (req, res) => {
    const { name, logo, address, phone, gst, warehouse, description } = req.body;
    const shop = await ManagedShop.findById(req.params.id);
    if (!shop) throw new ApiError(404, 'Managed Shop not found.');

    if (name && String(name).trim() !== shop.name) {
        const existing = await ManagedShop.findOne({ name: String(name).trim() });
        if (existing) throw new ApiError(409, 'Shop name already exists.');
        shop.name = String(name).trim();
    }

    if (logo !== undefined) shop.logo = logo;
    if (address !== undefined) shop.address = address;
    if (phone !== undefined) shop.phone = phone;
    if (gst !== undefined) shop.gst = gst;
    if (warehouse !== undefined) shop.warehouse = warehouse;
    if (description !== undefined) shop.description = description;

    await shop.save();
    res.status(200).json(new ApiResponse(200, shop, 'Managed Shop updated successfully.'));
});

// PATCH /api/admin/managed-shops/:id/status
export const updateShopStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
        throw new ApiError(400, 'Invalid status. Must be active or inactive.');
    }

    const shop = await ManagedShop.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!shop) throw new ApiError(404, 'Managed Shop not found.');

    // If shop is deactivated, deactivate all associated vendor users
    if (status === 'inactive') {
        await ManagedVendorUser.updateMany({ shopId: shop._id }, { status: 'inactive' });
    }

    res.status(200).json(new ApiResponse(200, shop, `Managed Shop status updated to ${status}.`));
});

// DELETE /api/admin/managed-shops/:id
export const deleteShop = asyncHandler(async (req, res) => {
    const shop = await ManagedShop.findById(req.params.id);
    if (!shop) throw new ApiError(404, 'Managed Shop not found.');

    // Check if shop has active vendor users
    const userCount = await ManagedVendorUser.countDocuments({ shopId: shop._id });
    if (userCount > 0) {
        throw new ApiError(400, 'Cannot delete shop with registered vendor users. Delete users first.');
    }

    await shop.deleteOne();
    res.status(200).json(new ApiResponse(200, null, 'Managed Shop deleted.'));
});

// ─── Managed Vendor User Controllers ────────────────────────────────────────

// POST /api/admin/managed-vendors
export const createVendorUser = asyncHandler(async (req, res) => {
    const { name, phone, username, password, role, shopId, companyName, gstNumber, address } = req.body;
    if (!name || !username || !password || !shopId) {
        throw new ApiError(400, 'Name, Username, Password, and Shop ID are required.');
    }

    const shop = await ManagedShop.findById(shopId);
    if (!shop) throw new ApiError(404, 'Assigned Managed Shop not found.');

    const normalizedUsername = String(username).trim().toLowerCase();
    const existing = await ManagedVendorUser.findOne({ username: normalizedUsername });
    if (existing) throw new ApiError(409, 'Username is already taken.');

    const vendorUser = await ManagedVendorUser.create({
        name: String(name).trim(),
        phone: String(phone || '').trim(),
        username: normalizedUsername,
        password,
        role: role || 'managed_vendor',
        shopId,
        companyName: String(companyName || '').trim(),
        gstNumber: String(gstNumber || '').trim().toUpperCase(),
        address: String(address || '').trim(),
        createdBy: req.user.id,
        status: 'active'
    });

    // Strip password in response
    const responseData = vendorUser.toObject();
    delete responseData.password;

    res.status(201).json(new ApiResponse(201, responseData, 'Managed Vendor User created.'));
});

// GET /api/admin/managed-vendors
export const getVendorUsers = asyncHandler(async (req, res) => {
    const { shopId } = req.query;
    const filter = {};
    if (shopId) {
        filter.shopId = shopId;
    }

    const users = await ManagedVendorUser.find(filter)
        .populate('shopId', 'name logo')
        .sort({ createdAt: -1 });

    res.status(200).json(new ApiResponse(200, users, 'Managed Vendor Users fetched.'));
});

// PUT /api/admin/managed-vendors/:id
export const updateVendorUser = asyncHandler(async (req, res) => {
    const { name, phone, password, role, status, companyName, gstNumber, address, shopId } = req.body;
    const vendorUser = await ManagedVendorUser.findById(req.params.id);
    if (!vendorUser) throw new ApiError(404, 'Managed Vendor User not found.');

    if (name !== undefined) vendorUser.name = String(name).trim();
    if (phone !== undefined) vendorUser.phone = String(phone || '').trim();
    if (role !== undefined) vendorUser.role = role;
    if (shopId !== undefined) {
        const shopExists = await ManagedShop.findById(shopId);
        if (!shopExists) throw new ApiError(404, 'Assigned Managed Shop not found.');
        vendorUser.shopId = shopId;
    }
    if (status !== undefined) {
        if (!['active', 'inactive'].includes(status)) {
            throw new ApiError(400, 'Invalid status.');
        }
        vendorUser.status = status;
    }
    if (companyName !== undefined) vendorUser.companyName = String(companyName || '').trim();
    if (gstNumber !== undefined) vendorUser.gstNumber = String(gstNumber || '').trim().toUpperCase();
    if (address !== undefined) vendorUser.address = String(address || '').trim();
    if (password) {
        vendorUser.password = password; // hashed in pre-save hook
    }

    await vendorUser.save();

    const responseData = vendorUser.toObject();
    delete responseData.password;

    res.status(200).json(new ApiResponse(200, responseData, 'Managed Vendor User updated.'));
});

// DELETE /api/admin/managed-vendors/:id
export const deleteVendorUser = asyncHandler(async (req, res) => {
    const vendorUser = await ManagedVendorUser.findByIdAndDelete(req.params.id);
    if (!vendorUser) throw new ApiError(404, 'Managed Vendor User not found.');
    res.status(200).json(new ApiResponse(200, null, 'Managed Vendor User deleted.'));
});
