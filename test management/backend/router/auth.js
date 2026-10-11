const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const User = require('../model/User');
const fetchUser = require('../middleware/fetchUser');
const JWT_SECRET = require('../middleware/jwtSecret');
const sendInviteEmail = require('../services/email');
const ActivityLog = require('../model/ActivityLog');

const router = express.Router();
const credentialsError = 'Please try to login with correct credentials';
const inviteRoles = ['Tester', 'QA Lead'];
const registrationRoles = ['Admin'];

function sendValidationErrors(req, res) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json({ success: false, errors: errors.array() });
  return true;
}

function createToken(user) {
  return jwt.sign({ user: { id: user.id } }, JWT_SECRET, { expiresIn: '7d' });
}

router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
    body('email').trim().isEmail().withMessage('Enter a valid email'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').isIn(registrationRoles).withMessage('Choose Admin'),
  ],
  async (req, res) => {
    if (sendValidationErrors(req, res)) return;

    try {
      const email = req.body.email.trim().toLowerCase();
      if (await User.exists({ email })) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }

      const user = await User.create({
        name: req.body.name.trim(),
        email,
        role: req.body.role,
        password: await bcrypt.hash(req.body.password, 12),
        mustChangePassword: false,
      });
      await ActivityLog.create({ actor: user._id, action: 'registered', entityType: 'User', entityId: user._id, details: { email, role: user.role } });
      return res.status(201).json({
        success: true,
        authtoken: createToken(user),
        role: user.role,
        mustChangePassword: false,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }
      console.error('Account registration failed:', error.message);
      return res.status(500).json({ success: false, message: 'Unable to create account right now' });
    }
  },
);

async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || String(user.role || '').toLowerCase() !== 'admin' || user.mustChangePassword) {
      return res.status(403).json({ success: false, message: 'Only an admin can send invitations' });
    }
    req.authenticatedUser = user;
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to verify admin access' });
  }
}

router.post(
  '/invite',
  fetchUser,
  requireAdmin,
  [
    body('name').trim().isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
    body('email').trim().isEmail().withMessage('Enter a valid email'),
    body('role').isIn(inviteRoles).withMessage('Invites can only be for Tester or QA Lead'),
  ],
  async (req, res) => {
    if (sendValidationErrors(req, res)) return;

    const name = req.body.name.trim();
    const email = req.body.email.trim().toLowerCase();
    const role = req.body.role;
    const temporaryPassword = crypto.randomBytes(12).toString('base64url');
    let invitedUser;

    try {
      if (await User.exists({ email })) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }

      invitedUser = await User.create({
        name,
        email,
        role,
        password: await bcrypt.hash(temporaryPassword, 12),
        mustChangePassword: true,
      });

    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists' });
      }
      console.error('Creating invited user failed:', error.message);
      return res.status(500).json({ success: false, message: 'Unable to create the invited account' });
    }

    try {
      await sendInviteEmail({ name, email, role, temporaryPassword });
    } catch (error) {
      await User.deleteOne({ _id: invitedUser._id }).catch((deleteError) => {
        console.error('Removing undelivered invited account failed:', deleteError.message);
      });
      console.error('Invite email delivery failed:', error.message);
      return res.status(503).json({
        success: false,
        message: 'Invitation email could not be sent. Check the SMTP settings and try again.',
      });
    }

    await ActivityLog.create({
      actor: req.authenticatedUser._id,
      action: 'invited',
      entityType: 'User',
      entityId: invitedUser._id,
      details: { email, role },
    }).catch((error) => console.error('Recording invitation activity failed:', error.message));

    return res.status(201).json({ success: true, message: `Invitation sent to ${email}` });
  },
);

router.get('/team', fetchUser, requireAdmin, async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.authenticatedUser._id } },
      'name email role createdAt mustChangePassword isActive',
    )
      .sort({ createdAt: -1 })
      .lean();
    return res.json({
      success: true,
      users: users.map(({ _id, name, email, role, createdAt, mustChangePassword, isActive }) => ({
        id: String(_id),
        name,
        email,
        role,
        createdAt,
        status: isActive === false ? 'Disabled' : mustChangePassword ? 'Invitation pending' : 'Active',
      })),
    });
  } catch (error) {
    console.error('Loading team failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load team members' });
  }
});

router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Enter a valid email'),
    body('password').isString().notEmpty().withMessage('Password cannot be blank'),
  ],
  async (req, res) => {
    if (sendValidationErrors(req, res)) return;

    try {
      const email = req.body.email.trim().toLowerCase();
      const user = await User.findOne({ email });
      if (!user || user.isActive === false || !(await bcrypt.compare(req.body.password, user.password))) {
        return res.status(401).json({ success: false, message: credentialsError });
      }

      return res.json({
        success: true,
        authtoken: createToken(user),
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      });
    } catch (error) {
      console.error('Login failed:', error.message);
      return res.status(503).json({ success: false, message: 'Login is unavailable. Check the backend database connection.' });
    }
  },
);

router.get('/getuser', fetchUser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    console.error('Fetching user failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to fetch user' });
  }
});

router.post(
  '/change-password',
  fetchUser,
  [
    body('currentPassword').isString().notEmpty().withMessage('Enter your current password'),
    body('newPassword').isString().isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
  ],
  async (req, res) => {
    if (sendValidationErrors(req, res)) return;

    try {
      const user = await User.findById(req.user.id);
      if (!user) return res.status(404).json({ success: false, message: 'User not found' });
      if (!(await bcrypt.compare(req.body.currentPassword, user.password))) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }

      user.password = await bcrypt.hash(req.body.newPassword, 12);
      user.mustChangePassword = false;
      await user.save();
      await ActivityLog.create({ actor: user._id, action: 'changed-password', entityType: 'User', entityId: user._id, details: { email: user.email } });
      return res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Password change failed:', error.message);
      return res.status(500).json({ success: false, message: 'Unable to change password' });
    }
  },
);



module.exports = router;