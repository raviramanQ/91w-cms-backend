const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { verifyPassword } = require('../utils/phpPasswordCompat');
const { generateToken } = require('../utils/jwt');
const { authMiddleware, getUserWithPermissions } = require('../middleware/auth');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const query = `SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.password,
        u.mobile_phone_number,
        r.role_name as role
      FROM 91wheels_users u
      LEFT JOIN 91wheels_user_roles r ON u.role_id = r.role_id
      WHERE u.email = ?`;
    
    console.log('Executing login query:', query);
    console.log('Query parameters:', [email]);
    
    const users = await executeQuery(query, [email]);

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    const user = users[0];

    const isPasswordValid = verifyPassword(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    console.log('✅ Login successful for user:', user.user_id);

    const token = generateToken({ userId: user.user_id });

    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const userWithPermissions = await getUserWithPermissions(user.user_id);

    if (!userWithPermissions) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load user permissions'
      });
    }

    res.json({
      success: true,
      user: {
        id: userWithPermissions.id,
        name: userWithPermissions.name,
        email: userWithPermissions.email,
        role: userWithPermissions.role,
        permissions: userWithPermissions.permissions
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('auth-token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

module.exports = router;
