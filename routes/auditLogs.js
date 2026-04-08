const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission } = require('../middleware/auth');
const { getAuditLogs } = require('../utils/audit');

// Get audit logs
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Only superadmin and admin can view audit logs
    if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Permission denied'
      });
    }

    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    const entity = req.query.entity || null;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const logs = await getAuditLogs({
      userId,
      entity,
      limit,
      offset
    });

    res.json({
      success: true,
      data: logs,
      pagination: {
        page,
        limit
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs'
    });
  }
});

module.exports = router;
