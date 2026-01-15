const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// Get all roles (only requires authentication)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const roles = await executeQuery(`
      SELECT 
        role_id as id,
        role_name as name,
        description,
        status
      FROM 91wheels_user_roles
      WHERE status = 1
      ORDER BY role_name ASC
    `);
    
    res.json({
      success: true,
      data: roles
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch roles'
    });
  }
});

module.exports = router;
