const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authMiddleware, requirePermission } = require('../middleware/auth');

// Get all vehicle makes with pagination and filters
router.get('/', authMiddleware, requirePermission('vehicle-makes', 'read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const typeId = req.query.type_id || 'all';
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let queryParams = [];

    if (search) {
      whereConditions.push('(v_make_name LIKE ? OR v_make_display_name LIKE ? OR v_make_slug LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (status === 'active') {
      whereConditions.push('v_make_status = 1');
    } else if (status === 'discontinued') {
      whereConditions.push('v_make_status = 0');
    } else if (status === 'upcoming') {
      whereConditions.push('v_make_status = 2');
    }

    if (typeId !== 'all') {
      whereConditions.push('v_type_id = ?');
      queryParams.push(typeId);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total FROM 91wheels_vehicle_makes ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    const vehicleMakes = await executeQuery(`
      SELECT 
        v_make_id as id,
        v_type_id as type_id,
        v_make_name as name,
        v_make_display_name as display_name,
        v_make_slug as slug,
        v_make_logo_url as logo_url,
        v_make_description as description,
        v_make_status as status,
        v_make_added as created_at,
        v_make_updated as updated_at
      FROM 91wheels_vehicle_makes 
      ${whereClause}
      ORDER BY v_make_name ASC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    res.json({
      success: true,
      data: vehicleMakes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching vehicle makes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle makes'
    });
  }
});

// Get single vehicle make
router.get('/:id', authMiddleware, requirePermission('vehicle-makes', 'read'), async (req, res) => {
  try {
    const vehicleMakes = await executeQuery(
      `SELECT 
        v_make_id as id,
        v_type_id as type_id,
        v_make_name as name,
        v_make_display_name as display_name,
        v_make_slug as slug,
        v_make_logo_url as logo_url,
        v_make_description as description,
        v_make_status as status,
        v_make_added as created_at,
        v_make_updated as updated_at
      FROM 91wheels_vehicle_makes 
      WHERE v_make_id = ?`,
      [req.params.id]
    );

    if (!vehicleMakes || vehicleMakes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle make not found'
      });
    }

    res.json({
      success: true,
      data: vehicleMakes[0]
    });
  } catch (error) {
    console.error('Error fetching vehicle make:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle make'
    });
  }
});

// Create vehicle make
router.post('/', authMiddleware, requirePermission('vehicle-makes', 'create'), async (req, res) => {
  try {
    const { type_id, name, display_name, slug, logo_url, description, status } = req.body;

    if (!type_id || !name || !display_name || !slug) {
      return res.status(400).json({
        success: false,
        error: 'Type ID, name, display name, and slug are required'
      });
    }

    const result = await executeQuery(
      `INSERT INTO 91wheels_vehicle_makes 
       (v_type_id, v_make_name, v_make_display_name, v_make_slug, v_make_logo_url, v_make_description, v_make_status, v_make_added, v_make_updated) 
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [type_id, name, display_name, slug, logo_url || '', description || '', parseInt(status) || 1]
    );

    const newVehicleMake = await executeQuery(
      `SELECT 
        v_make_id as id,
        v_type_id as type_id,
        v_make_name as name,
        v_make_display_name as display_name,
        v_make_slug as slug,
        v_make_logo_url as logo_url,
        v_make_description as description,
        v_make_status as status,
        v_make_added as created_at,
        v_make_updated as updated_at
       FROM 91wheels_vehicle_makes WHERE v_make_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: newVehicleMake[0],
      message: 'Vehicle make created successfully'
    });
  } catch (error) {
    console.error('Error creating vehicle make:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create vehicle make'
    });
  }
});

// Update vehicle make
router.put('/:id', authMiddleware, requirePermission('vehicle-makes', 'update'), async (req, res) => {
  try {
    const { type_id, name, display_name, slug, logo_url, description, status } = req.body;

    if (!type_id || !name || !display_name || !slug) {
      return res.status(400).json({
        success: false,
        error: 'Type ID, name, display name, and slug are required'
      });
    }

    await executeQuery(
      `UPDATE 91wheels_vehicle_makes 
       SET v_type_id = ?, v_make_name = ?, v_make_display_name = ?, v_make_slug = ?, 
           v_make_logo_url = ?, v_make_description = ?, v_make_status = ?, v_make_updated = CURRENT_TIMESTAMP
       WHERE v_make_id = ?`,
      [type_id, name, display_name, slug, logo_url || '', description || '', parseInt(status) || 1, req.params.id]
    );

    const updatedVehicleMake = await executeQuery(
      `SELECT 
        v_make_id as id,
        v_type_id as type_id,
        v_make_name as name,
        v_make_display_name as display_name,
        v_make_slug as slug,
        v_make_logo_url as logo_url,
        v_make_description as description,
        v_make_status as status,
        v_make_added as created_at,
        v_make_updated as updated_at
       FROM 91wheels_vehicle_makes WHERE v_make_id = ?`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: updatedVehicleMake[0],
      message: 'Vehicle make updated successfully'
    });
  } catch (error) {
    console.error('Error updating vehicle make:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vehicle make'
    });
  }
});

// Delete vehicle make
router.delete('/:id', authMiddleware, requirePermission('vehicle-makes', 'delete'), async (req, res) => {
  try {
    await executeQuery(
      'UPDATE 91wheels_vehicle_makes SET v_make_status = 0 WHERE v_make_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Vehicle make deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vehicle make:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vehicle make'
    });
  }
});

module.exports = router;
