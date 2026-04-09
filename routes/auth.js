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

// OAuth validation endpoint - validates if user is allowed to login
router.post('/oauth/validate', async (req, res) => {
  try {
    const { email, name, googleId, image } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Domain restriction check
  // const ALLOWED_DOMAINS = ['@gmail.com','@utmtk.in','@unicorntechmedia.com'];

    const ALLOWED_DOMAINS = ['@unicorntechmedia.com'];
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => email.endsWith(domain));
    
    if (!isAllowedDomain) {
      return res.status(403).json({
        success: false,
        error: `Only ${ALLOWED_DOMAINS.join(' or ')} emails are allowed`
      });
    }

    // Check if user exists in database (strict allowlist)
    // Using existing 91wheels_users table structure
    const users = await executeQuery(
      `SELECT 
        u.user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.status,
        r.role_id,
        r.role_name as role
      FROM 91wheels_users u
      LEFT JOIN 91wheels_user_roles r ON u.role_id = r.role_id
      WHERE u.email = ?`,
      [email]
    );

    if (!users || users.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'User not found in allowlist. Contact administrator.'
      });
    }

    const user = users[0];

    // Check if user is active (using existing status column)
    if (!user.status) {
      return res.status(403).json({
        success: false,
        error: 'User account is inactive'
      });
    }

    // Get user permissions
    const userWithPermissions = await getUserWithPermissions(user.user_id);

    res.json({
      success: true,
      allowed: true,
      user: {
        id: userWithPermissions.id,
        name: userWithPermissions.name,
        email: userWithPermissions.email,
        role: userWithPermissions.role,
        permissions: userWithPermissions.permissions
      }
    });
  } catch (error) {
    console.error('OAuth validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation failed'
    });
  }
});

// OAuth session endpoint - get user details for authenticated session
router.post('/oauth/session', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    const users = await executeQuery(
      `SELECT user_id FROM 91wheels_users WHERE email = ? AND status = 1`,
      [email]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found or inactive'
      });
    }

    const userWithPermissions = await getUserWithPermissions(users[0].user_id);

    res.json({
      success: true,
      user: {
        id: userWithPermissions.id,
        name: userWithPermissions.name,
        email: userWithPermissions.email,
        role: userWithPermissions.role,
        permissions: userWithPermissions.permissions
      }
    });
  } catch (error) {
    console.error('OAuth session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get session'
    });
  }
});

module.exports = router;
