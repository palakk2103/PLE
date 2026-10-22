import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.model.js';
import Vendor from '../src/models/Vendor.model.js';
import Admin from '../src/models/Admin.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const searchEmail = 'palakpatel0342@gmail.com'.toLowerCase().trim();

async function check() {
    await connectDB();
    console.log(`Checking for email: ${searchEmail}\n`);

    const user = await User.findOne({ email: searchEmail }).select('+password').lean();
    if (user) {
        console.log('✅ Found in User collection:');
        console.log({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
            isVerified: user.isVerified,
            hasPassword: !!user.password,
            passwordHashPrefix: user.password ? user.password.substring(0, 10) : 'none'
        });
    } else {
        console.log('❌ NOT found in User collection (Customer / B2B User)');
    }

    const vendor = await Vendor.findOne({ email: searchEmail }).select('+password').lean();
    if (vendor) {
        console.log('\n✅ Found in Vendor collection:');
        console.log({
            _id: vendor._id,
            name: vendor.name,
            storeName: vendor.storeName,
            email: vendor.email,
            status: vendor.status,
            hasPassword: !!vendor.password,
            passwordHashPrefix: vendor.password ? vendor.password.substring(0, 10) : 'none'
        });
    } else {
        console.log('\n❌ NOT found in Vendor collection');
    }

    const admin = await Admin.findOne({ email: searchEmail }).select('+password').lean();
    if (admin) {
        console.log('\n✅ Found in Admin collection:');
        console.log({
            _id: admin._id,
            name: admin.name,
            email: admin.email,
            role: admin.role,
            hasPassword: !!admin.password,
            passwordHashPrefix: admin.password ? admin.password.substring(0, 10) : 'none'
        });
    } else {
        console.log('\n❌ NOT found in Admin collection');
    }

    // Let's also search case-insensitively with regex in case there's any typo or whitespace
    const regexUsers = await User.find({ email: { $regex: new RegExp(searchEmail.split('@')[0], 'i') } }).lean();
    if (regexUsers.length > 0) {
        console.log('\nSimilar Users found:');
        regexUsers.forEach(u => console.log(`- ${u.email} (Role: ${u.role}, Name: ${u.name})`));
    }

    await mongoose.connection.close();
}

check().catch(console.error);
