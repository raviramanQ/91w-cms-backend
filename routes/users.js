const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { encryptPassword } = require('../utils/phpPasswordCompat');

// Get all users with pagination and filters
router.get('/', authMiddleware, requirePermission('users', 'read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const roleId = req.query.role_id || 'all';
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];

    if (search) {
      whereConditions.push('(u.user_name LIKE ? OR u.user_email LIKE ? OR u.user_mobile LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (status === 'active') {
      whereConditions.push('u.user_status = 1');
    } else if (status === 'inactive') {
      whereConditions.push('u.user_status = 0');
    }

    if (roleId !== 'all') {
      whereConditions.push('u.role_id = ?');
      queryParams.push(roleId);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM 91wheels_users u ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    const users = await executeQuery(`
      SELECT 
        u.user_id as id,
        u.user_name as name,
        u.user_email as email,
        u.user_mobile as mobile,
        u.user_status as status,
        u.role_id,
        r.role_name as role,
        u.user_added as created_at,
        u.user_updated as updated_at
      FROM 91wheels_users u
      LEFT JOIN 91wheels_user_roles r ON u.role_id = r.role_id
      ${whereClause}
      ORDER BY u.user_added DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    });
  }
});

// Get single user
router.get('/:id', authMiddleware, requirePermission('users', 'read'), async (req, res) => {
  try {
    const users = await executeQuery(
      `SELECT 
        u.user_id as id,
        u.user_name as name,
        u.user_email as email,
        u.user_mobile as mobile,
        u.user_status as status,
        u.role_id,
        r.role_name as role,
        u.user_added as created_at,
        u.user_updated as updated_at
      FROM 91wheels_users u
      LEFT JOIN 91wheels_user_roles r ON u.role_id = r.role_id
      WHERE u.user_id = ?`,
      [req.params.id]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[0];

    // Get user permissions
    const permissions = await executeQuery(
      `SELECT 
        m.module_name as module,
        GROUP_CONCAT(p.permission_name) as actions
      FROM 91wheels_role_permissions rp
      JOIN 91wheels_permissions p ON rp.permission_id = p.permission_id
      JOIN 91wheels_modules m ON p.module_id = m.module_id
      WHERE rp.role_id = ? AND rp.status = 1
      GROUP BY m.module_name`,
      [user.role_id]
    );

    user.permissions = permissions.map(p => ({
      module: p.module,
      actions: p.actions ? p.actions.split(',') : []
    }));

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// Create user
router.post('/', authMiddleware, requirePermission('users', 'create'), async (req, res) => {
  try {
    const { name, email, mobile, password, role_id, status } = req.body;

    if (!name || !email || !password || !role_id) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, password, and role are required'
      });
    }

    // Check if email already exists
    const existingUsers = await executeQuery(
      'SELECT user_id FROM 91wheels_users WHERE user_email = ?',
      [email]
    );

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    const encryptedPassword = encryptPassword(password);

    const result = await executeQuery(
      `INSERT INTO 91wheels_users 
       (user_name, user_email, user_mobile, user_password, role_id, user_status, user_added, user_updated) 
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [name, email, mobile || '', encryptedPassword, role_id, parseInt(status) || 1]
    );

    const newUser = await executeQuery(
      `SELECT 
        u.user_id as id,
        u.user_name as name,
        u.user_email as email,
        u.user_mobile as mobile,
        u.user_status as status,
        u.role_id,
        r.role_name as role,
        u.user_added as created_at,
        u.user_updated as updated_at
       FROM 91wheels_users u
       LEFT JOIN 91wheels_user_roles r ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: newUser[0],
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user'
    });
  }
});

// Update user
router.put('/:id', authMiddleware, requirePermission('users', 'update'), async (req, res) => {
  try {
    const { name, email, mobile, password, role_id, status } = req.body;

    if (!name || !email || !role_id) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and role are required'
      });
    }

    // Check if email already exists for another user
    const existingUsers = await executeQuery(
      'SELECT user_id FROM 91wheels_users WHERE user_email = ? AND user_id != ?',
      [email, req.params.id]
    );

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    let query = `UPDATE 91wheels_users 
                 SET user_name = ?, user_email = ?, user_mobile = ?, role_id = ?, user_status = ?, user_updated = CURRENT_TIMESTAMP`;
    let params = [name, email, mobile || '', role_id, parseInt(status) || 1];

    if (password) {
      const encryptedPassword = encryptPassword(password);
      query += ', user_password = ?';
      params.push(encryptedPassword);
    }

    query += ' WHERE user_id = ?';
    params.push(req.params.id);

    await executeQuery(query, params);

    const updatedUser = await executeQuery(
      `SELECT 
        u.user_id as id,
        u.user_name as name,
        u.user_email as email,
        u.user_mobile as mobile,
        u.user_status as status,
        u.role_id,
        r.role_name as role,
        u.user_added as created_at,
        u.user_updated as updated_at
       FROM 91wheels_users u
       LEFT JOIN 91wheels_user_roles r ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: updatedUser[0],
      message: 'User updated successfully'
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user'
    });
  }
});

// Delete user (soft delete)
router.delete('/:id', authMiddleware, requirePermission('users', 'delete'), async (req, res) => {
  try {
    await executeQuery(
      'UPDATE 91wheels_users SET user_status = 0 WHERE user_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user'
    });
  }
});

module.exports = router;
