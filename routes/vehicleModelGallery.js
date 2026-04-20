const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authMiddleware, requirePermission } = require('../middleware/auth');

// Get gallery images for a model
router.get('/:modelId/gallery', authMiddleware, requirePermission('vehicle-models', 'read'), async (req, res) => {
  try {
    const gallery = await executeQuery(
      `SELECT * FROM 91wheels_vehicle_model_gallery 
       WHERE v_model_id = ? 
       ORDER BY is_profile DESC, id ASC`,
      [req.params.modelId]
    );

    res.json({
      success: true,
      data: gallery
    });
  } catch (error) {
    console.error('Error fetching model gallery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model gallery'
    });
  }
});

// Add image to gallery
router.post('/:modelId/gallery', authMiddleware, requirePermission('vehicle-models', 'create'), async (req, res) => {
  try {
    const { image_url, title, is_profile } = req.body;

    // If setting as profile, unset other profile images
    if (is_profile) {
      await executeQuery(
        'UPDATE 91wheels_vehicle_model_gallery SET is_profile = 0 WHERE v_model_id = ?',
        [req.params.modelId]
      );
    }

    const result = await executeQuery(
      `INSERT INTO 91wheels_vehicle_model_gallery (v_model_id, image_url, title, is_profile)
       VALUES (?, ?, ?, ?)`,
      [req.params.modelId, image_url, title || '', is_profile || 0]
    );

    res.status(201).json({
      success: true,
      data: { id: result.insertId },
      message: 'Image added to gallery successfully'
    });
  } catch (error) {
    console.error('Error adding image to gallery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add image to gallery'
    });
  }
});

// Update gallery image (set as profile)
router.put('/:modelId/gallery/:imageId', authMiddleware, requirePermission('vehicle-models', 'update'), async (req, res) => {
  try {
    const { is_profile } = req.body;

    if (is_profile) {
      // Unset other profile images
      await executeQuery(
        'UPDATE 91wheels_vehicle_model_gallery SET is_profile = 0 WHERE v_model_id = ?',
        [req.params.modelId]
      );
    }

    await executeQuery(
      'UPDATE 91wheels_vehicle_model_gallery SET is_profile = ? WHERE id = ? AND v_model_id = ?',
      [is_profile || 0, req.params.imageId, req.params.modelId]
    );

    res.json({
      success: true,
      message: 'Gallery image updated successfully'
    });
  } catch (error) {
    console.error('Error updating gallery image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update gallery image'
    });
  }
});

// Delete gallery image
router.delete('/:modelId/gallery/:imageId', authMiddleware, requirePermission('vehicle-models', 'delete'), async (req, res) => {
  try {
    await executeQuery(
      'DELETE FROM 91wheels_vehicle_model_gallery WHERE id = ? AND v_model_id = ?',
      [req.params.imageId, req.params.modelId]
    );

    res.json({
      success: true,
      message: 'Gallery image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting gallery image:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete gallery image'
    });
  }
});

module.exports = router;
