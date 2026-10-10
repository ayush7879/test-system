require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../model/User');

async function createFirstAdmin() {
  const { MONGO, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGO || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('Set MONGO, ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in backend/.env first');
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters');
  }

  await mongoose.connect(MONGO);
  const existingAdmin = await User.findOne({ role: { $in: ['Admin', 'admin'] } });
  if (existingAdmin) {
    throw new Error(`An admin already exists (${existingAdmin.email}); refusing to create another bootstrap admin`);
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (await User.exists({ email })) {
    throw new Error('ADMIN_EMAIL is already in use; bootstrap does not promote existing accounts');
  }

  await User.create({
    name: ADMIN_NAME.trim(),
    email,
    role: 'Admin',
    password: await bcrypt.hash(ADMIN_PASSWORD, 12),
    mustChangePassword: false,
  });
  console.log(`First admin account created for ${email}`);
}

createFirstAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
