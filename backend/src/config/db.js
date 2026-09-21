import mongoose from 'mongoose';
import https from 'https';
import { MongoMemoryServer } from 'mongodb-memory-server';
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
        verificationStatus: 'Approved',
        status: 'Active'
      });
      console.log('✅ DATABASE AUTO-SEED SUCCESS: B2B Company created (Apex General Enterprises)');
    }

    let b2bAdmin = await User.findOne({ email: 'sarkarraj0766@gmail.com' });
    if (!b2bAdmin) {
      await User.create({
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
  } catch (err) {
    console.error('⚠️ DATABASE AUTO-SEED FAILED for B2B:', err.message);
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

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: process.env.NODE_ENV === 'production' ? 30000 : 8000
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    await autoSeedAdmin();
    await autoSeedDeliveryBoy();
    await autoSeedB2B();
    await autoMigrateCategories();
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
      await autoSeedB2B();
      await autoMigrateCategories();
    } catch (localError) {
      console.log('❌ Local MongoDB is not running. Attempting to spin up an in-memory MongoDB fallback server...');
      try {
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
        await autoSeedB2B();
        await autoMigrateCategories();
      } catch (fallbackError) {
        console.error('❌ Failed to start in-memory MongoDB server:', fallbackError.message);
        process.exit(1);
      }
    }
  }
};

export default connectDB;
