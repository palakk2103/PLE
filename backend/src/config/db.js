import mongoose from 'mongoose';
import https from 'https';
import Admin from '../models/Admin.model.js';
import DeliveryBoy from '../models/DeliveryBoy.model.js';

let mongoServer;

const getPublicIP = () => {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org?format=json', { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.ip);
        } catch {
          resolve('122.179.90.35'); // fallback
        }
      });
    }).on('error', () => {
      resolve('122.179.90.35'); // fallback
    });
  });
};

const autoSeedAdmin = async () => {
  try {
    let admin = await Admin.findOne({ email: 'admin@admin.com' });
    if (!admin) {
      await Admin.create({
        name: 'Super Admin',
        email: 'admin@admin.com',
        password: 'admin@123',
        role: 'superadmin',
        isActive: true,
      });
      console.log('✅ DATABASE AUTO-SEED SUCCESS: Admin account created (admin@admin.com / admin@123)');
    }
  } catch (err) {
    console.error('⚠️ DATABASE AUTO-SEED FAILED:', err.message);
  }
};

const autoSeedDeliveryBoy = async () => {
  try {
    let deliveryBoy = await DeliveryBoy.findOne({ email: 'delivery@delivery.com' });
    if (!deliveryBoy) {
      await DeliveryBoy.create({
        name: 'Rahul Kumar',
        email: 'delivery@delivery.com',
        password: 'delivery123',
        phone: '+91 98765 43210',
        applicationStatus: 'approved',
        isActive: true,
        isAvailable: true,
        status: 'available',
      });
      console.log('✅ DATABASE AUTO-SEED SUCCESS: Delivery boy account created (delivery@delivery.com / delivery123)');
    }
  } catch (err) {
    console.error('⚠️ DATABASE AUTO-SEED FAILED for DeliveryBoy:', err.message);
  }
};

const autoSeedVendor = async () => {
  try {
    const { Vendor } = await import('../models/Vendor.model.js');
    let vendor = await Vendor.findOne({ email: 'vendor@vendor.com' }).select('+password');
    if (!vendor) {
      vendor = new Vendor({
        name: 'Vikas Sharma',
        storeName: 'Fashion Hub Official',
        ownerName: 'Vikas Sharma',
        email: 'vendor@vendor.com',
        phone: '9876543211',
        password: 'vendor123',
        status: 'approved',
        isVerified: true,
        verificationStatus: 'Approved',
        commissionRate: 10,
        address: {
          street: '12 Commercial Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India'
        },
        bankDetails: {
          accountName: 'Fashion Hub Official',
          bankName: 'HDFC Bank',
          ifscCode: 'HDFC0001234',
          accountNumber: '123456789012',
          upiId: 'fashionhub@okhdfcbank'
        }
      });
      await vendor.save();
      console.log('✅ DATABASE AUTO-SEED SUCCESS: Vendor account created (vendor@vendor.com / vendor123)');
    } else {
      vendor.name = vendor.name || 'Vikas Sharma';
      vendor.status = 'approved';
      vendor.isVerified = true;
      vendor.verificationStatus = 'Approved';
      vendor.password = 'vendor123';
      if (!vendor.bankDetails || (!vendor.bankDetails.accountNumber && !vendor.bankDetails.upiId)) {
        vendor.bankDetails = {
          accountName: 'Fashion Hub Official',
          bankName: 'HDFC Bank',
          ifscCode: 'HDFC0001234',
          accountNumber: '123456789012',
          upiId: 'fashionhub@okhdfcbank'
        };
      }
      await vendor.save();
      console.log('✅ DATABASE AUTO-SEED SUCCESS: Vendor account reset & ready (vendor@vendor.com / vendor123)');
    }

    // Auto-seed or top-up vendor wallet with ₹5,000 test balance for withdrawal testing
    const VendorWallet = (await import('../models/VendorWallet.model.js')).default;
    const VendorTransaction = (await import('../models/VendorTransaction.model.js')).default;

    let wallet = await VendorWallet.findOne({ vendorId: vendor._id });
    if (!wallet) {
      wallet = await VendorWallet.create({
        vendorId: vendor._id,
        totalEarnings: 5000,
        available: 5000,
        onHold: 0,
        reserved: 0,
        withdrawn: 0,
      });
      await VendorTransaction.create({
        vendorId: vendor._id,
        type: 'EARNING_CLEARED',
        amount: 5000,
        balanceSnapshot: { onHold: 0, available: 5000, reserved: 0, withdrawn: 0 },
        referenceType: 'order',
        referenceNumber: 'INITIAL-TEST-BALANCE',
        description: 'Test cleared earnings credited for testing withdrawals',
        status: 'completed',
      });
      console.log('✅ DATABASE AUTO-SEED SUCCESS: Vendor wallet created with ₹5,000 available balance');
    } else if (wallet.available === 0 && wallet.reserved === 0 && wallet.withdrawn === 0) {
      wallet.totalEarnings = Math.max(wallet.totalEarnings, 5000);
      wallet.available = 5000;
      await wallet.save();
      await VendorTransaction.create({
        vendorId: vendor._id,
        type: 'EARNING_CLEARED',
        amount: 5000,
        balanceSnapshot: { onHold: wallet.onHold, available: 5000, reserved: 0, withdrawn: 0 },
        referenceType: 'order',
        referenceNumber: 'TOPUP-TEST-BALANCE',
        description: 'Test balance top-up for testing withdrawals',
        status: 'completed',
      });
      console.log('✅ DATABASE AUTO-SEED SUCCESS: Vendor wallet topped up with ₹5,000 available balance');
    }
  } catch (err) {
    console.error('⚠️ DATABASE AUTO-SEED FAILED for Vendor:', err.message);
  }
};

const autoSeedB2B = async () => {
  try {
    const User = (await import('../models/User.model.js')).default;
    const B2BCompany = (await import('../models/B2BCompany.model.js')).default;

    let company = await B2BCompany.findOne({ businessEmail: 'procurement@apexenterprises.in' });
    if (!company) {
      company = await B2BCompany.create({
        companyName: 'Apex General Enterprises',
        gstNumber: '27AAPCG9838F1Z1',
        businessEmail: 'procurement@apexenterprises.in',
        businessPhone: '9876543210',
        companyAddress: '404 Business Hub, BKC, Mumbai, MH - 400051',
        companyType: 'Private Limited Company',
        website: 'https://apexenterprises.in',
        ownerSecretKey: 'ApexSecret123!',
        verificationStatus: 'Approved',
        status: 'Active'
      });
      console.log('✅ DATABASE AUTO-SEED SUCCESS: B2B Company created (Apex General Enterprises)');
    }

    let b2bAdmin = await User.findOne({ email: 'sarkarraj0766@gmail.com' });
    if (!b2bAdmin) {
      b2bAdmin = await User.create({
        companyId: company._id,
        name: 'Apex General Enterprises',
        email: 'sarkarraj0766@gmail.com',
        phone: '9876543210',
        password: 'password123',
        role: 'b2bAdmin',
        b2bRole: 'Admin',
        isVerified: true,
        isActive: true
      });
      console.log('✅ DATABASE AUTO-SEED SUCCESS: B2B Admin account created (sarkarraj0766@gmail.com / password123)');
    }

    // Seed additional sample B2B companies if none exist
    let nova = await B2BCompany.findOne({ businessEmail: 'info@novahealth.in' });
    if (!nova) {
      nova = await B2BCompany.create({
        companyName: 'Nova Healthcare Pvt Ltd',
        gstNumber: '29ABCDE1234F2Z5',
        businessEmail: 'info@novahealth.in',
        businessPhone: '9822011223',
        companyAddress: '12 Science Park, Electronic City, Bengaluru, KA - 560100',
        companyType: 'Private Limited Company',
        website: 'https://novahealth.in',
        ownerSecretKey: 'NovaSecret123!',
        verificationStatus: 'Pending Verification',
        status: 'Active'
      });
      await User.create({
        companyId: nova._id,
        name: 'Dr. Ramesh Kumar',
        email: 'admin@novahealth.in',
        phone: '9822011223',
        password: 'password123',
        role: 'b2bAdmin',
        b2bRole: 'Admin',
        isVerified: true,
        isActive: true
      });
    }

    let zenith = await B2BCompany.findOne({ businessEmail: 'ops@zenithlogistics.in' });
    if (!zenith) {
      zenith = await B2BCompany.create({
        companyName: 'Zenith Logistics LLP',
        gstNumber: '07AAACZ1234K1Z0',
        businessEmail: 'ops@zenithlogistics.in',
        businessPhone: '9811099887',
        companyAddress: 'Plot 45, Udyog Vihar Phase 4, Gurugram, HR - 122015',
        companyType: 'LLP (Limited Liability Partnership)',
        website: 'https://zenithlogistics.in',
        ownerSecretKey: 'ZenithSecret123!',
        verificationStatus: 'Approved',
        status: 'Active'
      });
      await User.create({
        companyId: zenith._id,
        name: 'Vikram Malhotra',
        email: 'vikram@zenithlogistics.in',
        phone: '9811099887',
        password: 'password123',
        role: 'b2bAdmin',
        b2bRole: 'Admin',
        isVerified: true,
        isActive: true
      });
    }
  } catch (err) {
    console.error('⚠️ DATABASE AUTO-SEED FAILED for B2B:', err.message);
  }
};

const autoSeedChatThreads = async () => {
  try {
    const { VendorChatThread } = await import('../models/VendorChatThread.model.js');
    const { VendorChatMessage } = await import('../models/VendorChatMessage.model.js');
    const { Vendor } = await import('../models/Vendor.model.js');
    const User = (await import('../models/User.model.js')).default;

    const count = await VendorChatThread.countDocuments();
    if (count > 0) return;

    const vendor = await Vendor.findOne({ email: 'vendor@vendor.com' });
    if (!vendor) return;

    // 1. Retail Customer
    let customer = await User.findOne({ email: 'customer@example.com' });
    if (!customer) {
      customer = await User.create({
        name: 'Rahul Verma',
        email: 'customer@example.com',
        phone: '9876543201',
        password: 'password123',
        role: 'customer',
        isVerified: true,
        isActive: true,
      });
    }

    // 2. B2B Users
    const b2bAdmin = await User.findOne({ email: 'sarkarraj0766@gmail.com' });
    const novaUser = await User.findOne({ email: 'admin@novahealth.in' });

    // Seed B2B Thread 1 (Apex General Enterprises)
    if (b2bAdmin) {
      const b2bThread = await VendorChatThread.create({
        vendorId: vendor._id,
        customerUserId: b2bAdmin._id,
        customerName: 'Apex General Enterprises',
        customerEmail: b2bAdmin.email,
        customerPhone: b2bAdmin.phone || '9876543210',
        lastMessage: 'Can you share the wholesale quotation for 500 units of cotton shirts?',
        lastActivity: new Date(),
        unreadCount: 1,
        status: 'active',
      });

      await VendorChatMessage.create([
        {
          threadId: b2bThread._id,
          senderType: 'customer',
          senderId: b2bAdmin._id,
          message: 'Hello Fashion Hub team, we are looking for a bulk supply of 500 premium shirts for our corporate requirement.',
          createdAt: new Date(Date.now() - 3600000),
        },
        {
          threadId: b2bThread._id,
          senderType: 'vendor',
          senderId: vendor._id,
          message: 'Hello Apex team! Yes, we can supply this. Our wholesale rate for 500+ units is ₹380 per unit with 7 days delivery.',
          createdAt: new Date(Date.now() - 1800000),
        },
        {
          threadId: b2bThread._id,
          senderType: 'customer',
          senderId: b2bAdmin._id,
          message: 'Can you share the wholesale quotation for 500 units of cotton shirts?',
          createdAt: new Date(),
        },
      ]);
    }

    // Seed B2B Thread 2 (Nova Healthcare Pvt Ltd)
    if (novaUser) {
      const novaThread = await VendorChatThread.create({
        vendorId: vendor._id,
        customerUserId: novaUser._id,
        customerName: 'Nova Healthcare Pvt Ltd',
        customerEmail: novaUser.email,
        customerPhone: novaUser.phone || '9822011223',
        lastMessage: 'Please provide GST tax invoice terms for bulk surgical masks & scrubs.',
        lastActivity: new Date(Date.now() - 7200000),
        unreadCount: 0,
        status: 'active',
      });

      await VendorChatMessage.create([
        {
          threadId: novaThread._id,
          senderType: 'customer',
          senderId: novaUser._id,
          message: 'Hi, we need to order monthly bulk supplies of hospital linen and uniforms.',
          createdAt: new Date(Date.now() - 10800000),
        },
        {
          threadId: novaThread._id,
          senderType: 'vendor',
          senderId: vendor._id,
          message: 'We provide specialized medical fabrics. What are your specific specifications?',
          createdAt: new Date(Date.now() - 9000000),
        },
        {
          threadId: novaThread._id,
          senderType: 'customer',
          senderId: novaUser._id,
          message: 'Please provide GST tax invoice terms for bulk surgical masks & scrubs.',
          createdAt: new Date(Date.now() - 7200000),
        },
      ]);
    }

    // Seed Retail Customer Thread 1
    if (customer) {
      const custThread = await VendorChatThread.create({
        vendorId: vendor._id,
        customerUserId: customer._id,
        customerName: customer.name,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        orderDisplayId: 'ORD-98231',
        lastMessage: 'When will my order ORD-98231 be dispatched?',
        lastActivity: new Date(Date.now() - 2500000),
        unreadCount: 2,
        status: 'active',
      });

      await VendorChatMessage.create([
        {
          threadId: custThread._id,
          senderType: 'customer',
          senderId: customer._id,
          message: 'Hi, I placed order #ORD-98231 yesterday. Can I change the delivery address to Mumbai?',
          createdAt: new Date(Date.now() - 3600000),
        },
        {
          threadId: custThread._id,
          senderType: 'vendor',
          senderId: vendor._id,
          message: 'Hello Rahul, let me verify if the package is already packed by warehouse.',
          createdAt: new Date(Date.now() - 3000000),
        },
        {
          threadId: custThread._id,
          senderType: 'customer',
          senderId: customer._id,
          message: 'When will my order ORD-98231 be dispatched?',
          createdAt: new Date(Date.now() - 2500000),
        },
      ]);
    }

    console.log('✅ DATABASE AUTO-SEED SUCCESS: Initial Customer and B2B chat threads created with message history.');
  } catch (err) {
    console.error('⚠️ DATABASE AUTO-SEED FAILED for Chat Threads:', err.message);
  }
};


const autoMigrateCategories = async () => {
  try {
    const { Category } = await import('../models/Category.model.js');
    const oldCategoryIconMap = {
      'Clothing': 'Shirt',
      'Footwear': 'Footprints',
      'Bags': 'ShoppingBag',
      'Jewelry': 'Gem',
      'Accessories': 'Sparkles',
      'Athletic': 'Flame',
      "Men's": 'Shirt',
      'Women': 'Sparkles',
      'Kids': 'Smile',
      'Electronics': 'Smartphone'
    };

    const categories = await Category.find({ 
      $or: [
        { icon: { $exists: false } }, 
        { icon: null }, 
        { icon: '' },
        { icon: 'Package' }
      ] 
    });

    if (categories.length > 0) {
      let migratedCount = 0;
      for (const cat of categories) {
        const iconName = oldCategoryIconMap[cat.name] || 'Package';
        // Only update if it actually changes the icon from Package
        if (cat.icon !== iconName) {
          cat.icon = iconName;
          await cat.save();
          migratedCount++;
        }
      }
      if (migratedCount > 0) {
        console.log(`✅ DATABASE MIGRATION SUCCESS: Migrated ${migratedCount} categories to Lucide icons.`);
      } else {
        console.log('ℹ️ DATABASE MIGRATION: All categories already have correct icons.');
      }
    } else {
      console.log('ℹ️ DATABASE MIGRATION: All categories already have icons.');
    }
  } catch (err) {
    console.error('⚠️ DATABASE MIGRATION FAILED:', err.message);
  }
};

const autoMigrateProducts = async () => {
  try {
    const { default: Product } = await import('../models/Product.model.js');
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await Product.updateMany(
      { createdAt: { $gte: thirtyDaysAgo }, isNewArrival: { $ne: true } },
      { $set: { isNewArrival: true } }
    );
    if (result.modifiedCount > 0) {
      console.log(`✅ DATABASE MIGRATION SUCCESS: Marked ${result.modifiedCount} recent products as new arrivals.`);
    }
  } catch (err) {
    console.error('⚠️ DATABASE MIGRATION FAILED for Products:', err.message);
  }
};

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: process.env.NODE_ENV === 'production' ? 30000 : 8000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await autoSeedAdmin();
    await autoSeedDeliveryBoy();
    await autoSeedVendor();
    await autoSeedB2B();
    await autoSeedChatThreads();
    await autoMigrateCategories();
    await autoMigrateProducts();
  } catch (error) {
    const publicIP = await getPublicIP();
    console.error(`
========================================================================
❌ MONGODB CONNECTION ERROR: COULD NOT CONNECT TO ATLAS CLUSTER
========================================================================

It looks like your IP address is not whitelisted in your MongoDB Atlas cluster or there is a network issue.

👉 YOUR CURRENT PUBLIC IP ADDRESS: ${publicIP}

To fix this persistently, follow these steps:
1. Log in to your MongoDB Atlas Console: https://cloud.mongodb.com
2. Go to "Network Access" under the "Security" section in the left sidebar.
3. Click the "+ Add IP Address" button.
4. Choose "Add Current IP Address" (which should be ${publicIP}),
   or allow access from anywhere by entering 0.0.0.0/0 (for temporary testing).
5. Save/Confirm the changes and wait 1-2 minutes for the cluster to update.

Error Details: ${error.message}
========================================================================
    `);

    console.log('🔄 Attempting to connect to local MongoDB fallback (mongodb://127.0.0.1:27017/ple)...');
    try {
      const conn = await mongoose.connect('mongodb://127.0.0.1:27017/ple', {
        serverSelectionTimeoutMS: 3000
      });
      console.log(`
========================================================================
⚠️ SUCCESS: LOCAL MONGODB FALLBACK CONFIGURED
========================================================================
Backend is now running with your local MongoDB instance!

👉 What this means:
   1. The backend is running, and you can test all features!
   2. All operations (User, Vendor, Delivery, Products, etc.) will work.
   
Whenever you're ready, whitelist your IP (${publicIP}) on MongoDB Atlas
to switch back to your persistent remote cluster.
========================================================================
      `);
      await autoSeedAdmin();
      await autoSeedDeliveryBoy();
      await autoSeedVendor();
      await autoSeedB2B();
      await autoSeedChatThreads();
      await autoMigrateCategories();
      await autoMigrateProducts();
    } catch (localError) {
      console.log('❌ Local MongoDB is not running. Attempting to spin up an in-memory MongoDB fallback server...');
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        const conn = await mongoose.connect(mongoUri);
        console.log(`
========================================================================
⚠️ SUCCESS: IN-MEMORY MONGODB FALLBACK CONFIGURED
========================================================================
Backend is now running with a local, zero-config in-memory MongoDB!

👉 What this means:
   1. The backend is running, and you can test all features!
   2. All operations (User, Vendor, Delivery, Products, etc.) will work.
   3. NOTE: Data is stored in memory and will reset when the server restarts.
   
Whenever you're ready, whitelist your IP (${publicIP}) on MongoDB Atlas
to switch back to your persistent remote cluster.
========================================================================
        `);
        await autoSeedAdmin();
        await autoSeedDeliveryBoy();
        await autoSeedVendor();
        await autoSeedB2B();
        await autoSeedChatThreads();
        await autoMigrateCategories();
        await autoMigrateProducts();
      } catch (fallbackError) {
        console.error('❌ Failed to start in-memory MongoDB server:', fallbackError.message);
        process.exit(1);
      }
    }
  }
};

export default connectDB;
