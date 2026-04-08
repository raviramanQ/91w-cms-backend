const { verifyToken } = require('../utils/jwt');
const { executeQuery } = require('../config/database');

async function getUserWithPermissions(userId) {
  try {
    console.log('getUserWithPermissions---', userId);
    
    const query = `SELECT 
        u.user_id as id,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.email,
        u.mobile_phone_number as mobile,
        r.role_id,
        r.role_name as role
      FROM 91wheels_users u
      LEFT JOIN 91wheels_user_roles r ON u.role_id = r.role_id
      WHERE u.user_id = ?`;
    
    console.log('Executing getUserWithPermissions query:', query);
    console.log('Query parameters:', [userId]);
    
    const users = await executeQuery(query, [userId]);

    if (!users || users.length === 0) {
      return null;
    }

    const user = users[0];

    // Get user permissions from user_role_module_permissions table
    const permissions = await executeQuery(
      `SELECT 
        module_id as module,
        permissions as actions
      FROM 91wheels_user_role_module_permissions
      WHERE role_id = ?`,
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

    // Check for OAuth email in headers (sent from frontend)
    const oauthEmail = req.headers['x-user-email'];

    if (!token && !oauthEmail) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    let user = null;

    // Try JWT token first
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        user = await getUserWithPermissions(decoded.userId);
      }
    }

    // If no user from token, try OAuth email
    if (!user && oauthEmail) {
      const users = await executeQuery(
        'SELECT user_id FROM 91wheels_users WHERE email = ? AND status = 1',
        [oauthEmail]
      );
      
      if (users && users.length > 0) {
        user = await getUserWithPermissions(users[0].user_id);
      }
    }

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
