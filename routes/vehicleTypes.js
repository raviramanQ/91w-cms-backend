const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authMiddleware, requirePermission } = require('../middleware/auth');

// Get all vehicle types
router.get('/', authMiddleware, requirePermission('vehicle-types', 'read'), async (req, res) => {
  try {
    const vehicleTypes = await executeQuery(`
      SELECT 
        v_type_id as id,
        v_type_name as name,
        v_type_display_name as display_name,
        v_type_slug as slug,
        v_type_image as image,
        v_type_description as description,
        v_type_status as status,
        v_type_added as created_at,
        v_type_modified as updated_at,
        sort_order
      FROM 91wheels_vehicle_types 
      ORDER BY sort_order ASC, v_type_added DESC
    `);
    
    res.json({
      success: true,
      data: vehicleTypes
    });
  } catch (error) {
    console.error('Error fetching vehicle types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle types'
    });
  }
});

// Public endpoint for vehicle types (for dropdowns)
router.get('/public', authMiddleware, async (req, res) => {
  try {
    const vehicleTypes = await executeQuery(`
      SELECT 
        v_type_id as id,
        v_type_name as name,
        v_type_display_name as display_name,
        v_type_slug as slug,
        v_type_status as status,
        sort_order
      FROM 91wheels_vehicle_types 
      ORDER BY sort_order ASC, v_type_name ASC
    `);
    
    res.json({
      success: true,
      data: vehicleTypes
    });
  } catch (error) {
    console.error('Error fetching vehicle types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle types'
    });
  }
});

// Get single vehicle type
router.get('/:id', authMiddleware, requirePermission('vehicle-types', 'read'), async (req, res) => {
  try {
    const vehicleTypes = await executeQuery(
      `SELECT 
        v_type_id as id,
        v_type_name as name,
        v_type_display_name as display_name,
        v_type_slug as slug,
        v_type_image as image,
        v_type_description as description,
        v_type_status as status,
        v_type_added as created_at,
        v_type_modified as updated_at,
        sort_order
      FROM 91wheels_vehicle_types 
      WHERE v_type_id = ?`,
      [req.params.id]
    );

    if (!vehicleTypes || vehicleTypes.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle type not found'
      });
    }

    res.json({
      success: true,
      data: vehicleTypes[0]
    });
  } catch (error) {
    console.error('Error fetching vehicle type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle type'
    });
  }
});

// Create vehicle type
router.post('/', authMiddleware, requirePermission('vehicle-types', 'create'), async (req, res) => {
  try {
    const { name, display_name, slug, image, description, status, sort_order } = req.body;

    if (!name || !display_name || !slug) {
      return res.status(400).json({
        success: false,
        error: 'Name, display name, and slug are required'
      });
    }

    const result = await executeQuery(
      `INSERT INTO 91wheels_vehicle_types 
       (v_type_name, v_type_display_name, v_type_slug, v_type_image, v_type_description, v_type_status, v_type_added, v_type_modified, sort_order) 
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      [name, display_name, slug, image || '', description || '', parseInt(status) || 1, sort_order || 20]
    );

    const newVehicleType = await executeQuery(
      `SELECT 
        v_type_id as id,
        v_type_name as name,
        v_type_display_name as display_name,
        v_type_slug as slug,
        v_type_image as image,
        v_type_description as description,
        v_type_status as status,
        v_type_added as created_at,
        v_type_modified as updated_at,
        sort_order
       FROM 91wheels_vehicle_types WHERE v_type_id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      data: newVehicleType[0],
      message: 'Vehicle type created successfully'
    });
  } catch (error) {
    console.error('Error creating vehicle type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create vehicle type'
    });
  }
});

// Update vehicle type
router.put('/:id', authMiddleware, requirePermission('vehicle-types', 'update'), async (req, res) => {
  try {
    const { name, display_name, slug, image, description, status, sort_order } = req.body;

    if (!name || !display_name || !slug) {
      return res.status(400).json({
        success: false,
        error: 'Name, display name, and slug are required'
      });
    }

    await executeQuery(
      `UPDATE 91wheels_vehicle_types 
       SET v_type_name = ?, v_type_display_name = ?, v_type_slug = ?, v_type_image = ?, 
           v_type_description = ?, v_type_status = ?, v_type_modified = CURRENT_TIMESTAMP, sort_order = ?
       WHERE v_type_id = ?`,
      [name, display_name, slug, image || '', description || '', parseInt(status) || 1, sort_order || 20, req.params.id]
    );

    const updatedVehicleType = await executeQuery(
      `SELECT 
        v_type_id as id,
        v_type_name as name,
        v_type_display_name as display_name,
        v_type_slug as slug,
        v_type_image as image,
        v_type_description as description,
        v_type_status as status,
        v_type_added as created_at,
        v_type_modified as updated_at,
        sort_order
       FROM 91wheels_vehicle_types WHERE v_type_id = ?`,
      [req.params.id]
    );

    res.json({
      success: true,
      data: updatedVehicleType[0],
      message: 'Vehicle type updated successfully'
    });
  } catch (error) {
    console.error('Error updating vehicle type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vehicle type'
    });
  }
});

// Delete vehicle type
router.delete('/:id', authMiddleware, requirePermission('vehicle-types', 'delete'), async (req, res) => {
  try {
    await executeQuery(
      'UPDATE 91wheels_vehicle_types SET v_type_status = 0 WHERE v_type_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Vehicle type deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vehicle type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vehicle type'
    });
  }
});

module.exports = router;
