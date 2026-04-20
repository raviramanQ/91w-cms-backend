const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authMiddleware, requirePermission } = require('../middleware/auth');

// Get key features for a model
router.get('/:modelId/features', authMiddleware, requirePermission('vehicle-models', 'read'), async (req, res) => {
  try {
    const features = await executeQuery(
      `SELECT * FROM 91wheels_top_custom_model_features 
       WHERE v_model_id = ? AND status = 1
       ORDER BY id ASC`,
      [req.params.modelId]
    );

    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    console.error('Error fetching model features:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch model features'
    });
  }
});

// Add feature to model
router.post('/:modelId/features', authMiddleware, requirePermission('vehicle-models', 'create'), async (req, res) => {
  try {
    const {
      model_feature_name,
      model_feature_image,
      feature_video_url,
      feature_video_thumbnil,
      ShortIconUrl,
      description,
      rival_tag,
      title,
      specs_master_id
    } = req.body;

    const result = await executeQuery(
      `INSERT INTO 91wheels_top_custom_model_features 
       (v_model_id, model_feature_name, model_feature_image, feature_video_url, feature_video_thumbnil, 
        ShortIconUrl, description, rival_tag, title, specs_master_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        req.params.modelId,
        model_feature_name || '',
        model_feature_image || '',
        feature_video_url || '',
        feature_video_thumbnil || '',
        ShortIconUrl || '',
        description || '',
        rival_tag || '',
        title || '',
        specs_master_id || null
      ]
    );

    res.status(201).json({
      success: true,
      data: { id: result.insertId },
      message: 'Feature added successfully'
    });
  } catch (error) {
    console.error('Error adding model feature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add model feature'
    });
  }
});

// Update feature
router.put('/:modelId/features/:featureId', authMiddleware, requirePermission('vehicle-models', 'update'), async (req, res) => {
  try {
    const {
      model_feature_name,
      model_feature_image,
      feature_video_url,
      feature_video_thumbnil,
      ShortIconUrl,
      description,
      rival_tag,
      title,
      specs_master_id
    } = req.body;

    await executeQuery(
      `UPDATE 91wheels_top_custom_model_features SET
       model_feature_name = ?, model_feature_image = ?, feature_video_url = ?, 
       feature_video_thumbnil = ?, ShortIconUrl = ?, description = ?, rival_tag = ?, 
       title = ?, specs_master_id = ?
       WHERE id = ? AND v_model_id = ?`,
      [
        model_feature_name || '',
        model_feature_image || '',
        feature_video_url || '',
        feature_video_thumbnil || '',
        ShortIconUrl || '',
        description || '',
        rival_tag || '',
        title || '',
        specs_master_id || null,
        req.params.featureId,
        req.params.modelId
      ]
    );

    res.json({
      success: true,
      message: 'Feature updated successfully'
    });
  } catch (error) {
    console.error('Error updating model feature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update model feature'
    });
  }
});

// Delete feature
router.delete('/:modelId/features/:featureId', authMiddleware, requirePermission('vehicle-models', 'delete'), async (req, res) => {
  try {
    await executeQuery(
      'UPDATE 91wheels_top_custom_model_features SET status = 0 WHERE id = ? AND v_model_id = ?',
      [req.params.featureId, req.params.modelId]
    );

    res.json({
      success: true,
      message: 'Feature deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting model feature:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete model feature'
    });
  }
});

module.exports = router;
