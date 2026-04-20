const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authMiddleware, requirePermission } = require('../middleware/auth');

// Get colors for a model
router.get('/:modelId/colors', authMiddleware, requirePermission('vehicle-models', 'read'), async (req, res) => {
  try {
    const colors = await executeQuery(
      `SELECT * FROM 91wheels_vehicle_model_colors WHERE v_model_id = ?`,
      [req.params.modelId]
    );

    res.json({
      success: true,
      data: colors
    });
  } catch (error) {
    console.error('Error fetching model colors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model colors'
    });
  }
});

// Add color to model
router.post('/:modelId/colors', authMiddleware, requirePermission('vehicle-models', 'create'), async (req, res) => {
  try {
    const { title, hex, image_url, dual_tone, v_make_id, v_type_id } = req.body;

    const result = await executeQuery(
      `INSERT INTO 91wheels_vehicle_model_colors (v_model_id, v_make_id, v_type_id, title, hex, ImageUrl, dual_tone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.modelId, v_make_id, v_type_id, title, hex || '', image_url || '', dual_tone || 0]
    );

    res.status(201).json({
      success: true,
      data: { id: result.insertId },
      message: 'Color added successfully'
    });
  } catch (error) {
    console.error('Error adding model color:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add model color'
    });
  }
});

// Delete color
router.delete('/:modelId/colors/:colorId', authMiddleware, requirePermission('vehicle-models', 'delete'), async (req, res) => {
  try {
    await executeQuery(
      'DELETE FROM 91wheels_vehicle_model_colors WHERE id = ? AND v_model_id = ?',
      [req.params.colorId, req.params.modelId]
    );

    res.json({
      success: true,
      message: 'Color deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting model color:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete model color'
    });
  }
});

module.exports = router;
