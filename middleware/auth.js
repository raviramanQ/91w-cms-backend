const { verifyToken } = require('../utils/jwt');
const { executeQuery } = require('../config/database');

async function getUserWithPermissions(userId) {
  try {
    const users = await executeQuery(
      `SELECT 
        u.user_id as id,
        u.user_name as name,
        u.user_email as email,
        u.user_mobile as mobile,
        u.user_status as status,
        r.role_id,
        r.role_name as role
      FROM 91wheels_users u
      LEFT JOIN 91wheels_user_roles r ON u.role_id = r.role_id
      WHERE u.user_id = ? AND u.user_status = 1`,
      [userId]
    );

    if (!users || users.length === 0) {
      return null;
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

    return user;
  } catch (error) {
    console.error('Error getting user with permissions:', error);
    return null;
  }
}

function hasPermission(userPermissions, module, action) {
  if (!userPermissions || !Array.isArray(userPermissions)) {
    return false;
  }

  const modulePermission = userPermissions.find(p => p.module === module);
  if (!modulePermission) {
    return false;
  }

  return modulePermission.actions.includes(action);
}

// Authentication middleware
async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = req.cookies['auth-token'] || 
                  (authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null);

    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const user = await getUserWithPermissions(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ success: false, error: 'Authentication failed' });
  }
}

// Permission check middleware
function requirePermission(module, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    // Admin role bypasses permission checks
    if (req.user.role === 'admin' || req.user.role === 'superadmin') {
      return next();
    }

    if (!hasPermission(req.user.permissions, module, action)) {
      return res.status(403).json({ 
        success: false, 
        error: `Permission denied. Required: ${action} on ${module}` 
      });
    }

    next();
  };
}

module.exports = {
  authMiddleware,
  requirePermission,
  getUserWithPermissions,
  hasPermission
};
