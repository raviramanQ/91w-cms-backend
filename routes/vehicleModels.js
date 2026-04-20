const express = require('express');
const router = express.Router();
const { executeQuery } = require('../config/database');
const { authMiddleware, requirePermission } = require('../middleware/auth');

// Get all vehicle models with pagination and filters
router.get('/', authMiddleware, requirePermission('vehicle-models', 'read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || 'all';
    const typeId = req.query.type_id || 'all';
    const makeId = req.query.make_id || 'all';
    const offset = (page - 1) * limit;

    let whereConditions = ['VMO.is_deleted = 0'];
    let queryParams = [];

    if (search) {
      whereConditions.push('(VMO.v_model_name LIKE ? OR VMO.v_model_display_name LIKE ? OR VMO.v_model_slug LIKE ?)');
      const searchPattern = `%${search}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (status === 'active') {
      whereConditions.push('VMO.v_model_status = 1');
    } else if (status === 'discontinued') {
      whereConditions.push('VMO.v_model_status = 2');
    } else if (status === 'upcoming') {
      whereConditions.push('VMO.v_model_status = 3');
    }

    if (typeId !== 'all') {
      whereConditions.push('VMO.v_type_id = ?');
      queryParams.push(typeId);
    }

    if (makeId !== 'all') {
      whereConditions.push('VMO.v_make_id = ?');
      queryParams.push(makeId);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const countResult = await executeQuery(
      `SELECT COUNT(*) as total 
       FROM 91wheels_vehicle_models VMO
       ${whereClause}`,
      queryParams
    );
    const total = countResult[0].total;

    const vehicleModels = await executeQuery(`
      SELECT 
        VMO.v_model_id as id,
        VMO.v_make_id as make_id,
        VMO.v_type_id as type_id,
        VMO.v_model_name as name,
        VMO.v_model_display_name as display_name,
        VMO.v_model_slug as slug,
        VMO.profile_image_url,
        VMO.v_model_min_price as min_price,
        VMO.v_model_max_price as max_price,
        VMO.v_model_status as status,
        VMO.v_model_rank as rank,
        VMO.launched_date,
        VMO.v_model_added as created_at,
        VMO.v_model_updated as updated_at,
        VMA.v_make_name as make_name,
        VMA.v_make_display_name as make_display_name,
        VT.v_type_name as type_name,
        VT.v_type_display_name as type_display_name
      FROM 91wheels_vehicle_models VMO
      LEFT JOIN 91wheels_vehicle_makes VMA ON VMA.v_make_id = VMO.v_make_id
      LEFT JOIN 91wheels_vehicle_types VT ON VT.v_type_id = VMO.v_type_id
      ${whereClause}
      ORDER BY VMO.v_model_updated DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, limit, offset]);

    res.json({
      success: true,
      data: vehicleModels,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching vehicle models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle models'
    });
  }
});

// Get single vehicle model with all related data
router.get('/:id', authMiddleware, requirePermission('vehicle-models', 'read'), async (req, res) => {
  try {
    const modelId = req.params.id;

    // Get main model data
    const models = await executeQuery(
      `SELECT 
        VMO.*,
        VMA.v_make_name,
        VMA.v_make_display_name,
        VMA.v_make_slug,
        VT.v_type_name,
        VT.v_type_display_name,
        VT.v_type_slug,
        ME.key_highlights
      FROM 91wheels_vehicle_models VMO
      LEFT JOIN 91wheels_vehicle_makes VMA ON VMA.v_make_id = VMO.v_make_id
      LEFT JOIN 91wheels_vehicle_types VT ON VT.v_type_id = VMO.v_type_id
      LEFT JOIN 91wheels_model_extra_fields ME ON ME.v_model_id = VMO.v_model_id
      WHERE VMO.v_model_id = ? AND VMO.is_deleted = 0`,
      [modelId]
    );

    if (!models || models.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle model not found'
      });
    }

    const model = models[0];

    // Get pros and cons
    const prosConsData = await executeQuery(
      `SELECT content, classification_type, remark
       FROM 91wheels_vehicle_model_pros_cons
       WHERE v_model_id = ? AND status = 1`,
      [modelId]
    );

    const pros = prosConsData.filter(pc => pc.classification_type === 1).map(pc => pc.content);
    const cons = prosConsData.filter(pc => pc.classification_type === 2).map(pc => pc.content);

    // Get colors
    const colors = await executeQuery(
      `SELECT title, hex, ImageUrl as image_url, dual_tone
       FROM 91wheels_vehicle_model_colors
       WHERE v_model_id = ?`,
      [modelId]
    );

    // Get model groups
    const groups = await executeQuery(
      `SELECT v_model_id, rank
       FROM 91wheels_vehicle_model_groups
       WHERE group_model_id = ?
       ORDER BY rank`,
      [modelId]
    );

    // Get key features
    const features = await executeQuery(
      `SELECT *
       FROM 91wheels_top_custom_model_features
       WHERE v_model_id = ? AND status = 1`,
      [modelId]
    );

    // Get gallery images
    const gallery = await executeQuery(
      `SELECT *
       FROM 91wheels_vehicle_model_gallery
       WHERE v_model_id = ?
       ORDER BY is_profile DESC, id ASC`,
      [modelId]
    );

    // Get review if exists
    const reviews = await executeQuery(
      `SELECT R.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('rating_spec_id', rating_spec_id, 'rating', rating))
         FROM 91wheels_review_rating_link WHERE review_id = R.id) as ratings
       FROM 91wheels_reviews R
       WHERE R.v_model_id = ?
       LIMIT 1`,
      [modelId]
    );

    const response = {
      ...model,
      pros,
      cons,
      colors,
      groups: groups.map(g => g.v_model_id),
      features,
      gallery,
      review: reviews.length > 0 ? reviews[0] : null
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error fetching vehicle model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vehicle model'
    });
  }
});

// Create vehicle model
router.post('/', authMiddleware, requirePermission('vehicle-models', 'create'), async (req, res) => {
  try {
    const {
      v_make_id, v_type_id, v_model_name, v_model_display_name, v_model_slug,
      parent_slug, p_model_id, v_model_description, v_model_history,
      v_model_min_price, v_model_max_price, v_model_status,
      body_type, sub_body_type, subCategory,
      is_ev, is_mini, is_auto_expo, is_baas, is_luxury,
      is_expected_launch, is_expected_price,
      electric_range, charging_time,
      v_gears, v_max_power, v_max_torque, v_mileage,
      fuel_json, transmission_json,
      launched_date, discontinued_date,
      v_model_rank, summary, should_buy, atf_content,
      v_model_expert_speak, key_model_feature_json, key_highlights,
      top_variant_id, base_variant_id, recommended_variant_id, recommended_variant_atf,
      profile_image_url, left_image_url, right_image_url, dimension_image, campaign_banner_url,
      v_model_brochure_url,
      pros, cons, colors, groups, features
    } = req.body;

    // Validate required fields
    if (!v_make_id || !v_model_name || !v_model_slug || !v_type_id) {
      return res.status(400).json({
        success: false,
        error: 'Make ID, model name, slug, and type ID are required'
      });
    }

    // Extract numeric values from power and torque
    let v_max_power_int = null;
    let v_max_torque_int = null;
    
    if (v_max_power) {
      const powerMatch = v_max_power.match(/^(\d+(\.\d+)?)/);
      if (powerMatch) v_max_power_int = parseFloat(powerMatch[1]);
    }
    
    if (v_max_torque) {
      const torqueMatch = v_max_torque.match(/^(\d+(\.\d+)?)/);
      if (torqueMatch) v_max_torque_int = parseFloat(torqueMatch[1]);
    }

    // Trim slug
    const cleanSlug = (v_model_slug || '').trim().replace(/^-+|-+$/g, '');

    // Remove commas from prices
    const minPrice = v_model_min_price ? String(v_model_min_price).replace(/,/g, '') : null;
    const maxPrice = v_model_max_price ? String(v_model_max_price).replace(/,/g, '') : null;

    // Calculate parent model ID if status is active
    let parentModelId = p_model_id || null;
    if (v_model_status == 1 && parent_slug) {
      const parentResult = await executeQuery(
        `SELECT MIN(v_model_id) AS min_id
         FROM 91wheels_vehicle_models
         WHERE parent_slug = ?`,
        [parent_slug]
      );
      if (parentResult[0] && parentResult[0].min_id) {
        parentModelId = parentResult[0].min_id;
      }
    }

    // Extract year from launched date
    const minYear = launched_date ? launched_date.split('-')[0] : null;
    const maxYear = discontinued_date ? discontinued_date.split('-')[0] : null;

    // Insert main model
    const result = await executeQuery(
      `INSERT INTO 91wheels_vehicle_models 
       (v_make_id, v_type_id, v_model_name, v_model_display_name, v_model_slug, parent_slug, p_model_id,
        v_model_description, v_model_history, v_model_min_price, v_model_max_price, v_model_status,
        body_type, sub_body_type, subCategory, is_ev, is_mini, is_auto_expo, is_baas, is_luxury,
        is_expected_launch, is_expected_price, electric_range, charging_time,
        v_gears, v_max_power, v_max_torque, v_max_power_int, v_max_torque_int, v_mileage,
        fuel_json, transmission_json, launched_date, discontinued_date, min_year, max_year,
        v_model_rank, summary, should_buy, atf_content, v_model_expert_speak, key_model_feature_json,
        top_variant_id, base_variant_id, recommended_variant_id, recommended_variant_atf,
        profile_image_url, left_image_url, right_image_url, dimension_image, campaign_banner_url,
        v_model_brochure_url, is_deleted, v_model_added, v_model_updated, has_faq)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)`,
      [
        v_make_id, v_type_id, v_model_name, v_model_display_name, cleanSlug, parent_slug || '', parentModelId,
        v_model_description || '', v_model_history || '', minPrice, maxPrice, v_model_status || 1,
        body_type || '', sub_body_type || '', subCategory || 0, is_ev || 0, is_mini || 0, is_auto_expo || 0, is_baas || 0, is_luxury || 0,
        is_expected_launch || 0, is_expected_price || 0, electric_range || null, charging_time || null,
        v_gears || null, v_max_power || null, v_max_torque || null, v_max_power_int, v_max_torque_int, v_mileage || null,
        fuel_json ? JSON.stringify(fuel_json) : null, transmission_json ? JSON.stringify(transmission_json) : null,
        launched_date || null, discontinued_date || null, minYear, maxYear,
        v_model_rank || 0, summary || '', should_buy || '', atf_content || '', v_model_expert_speak || '',
        key_model_feature_json ? JSON.stringify(key_model_feature_json) : '[]',
        top_variant_id || 0, base_variant_id || 0, recommended_variant_id || 0, recommended_variant_atf || '',
        profile_image_url || '', left_image_url || '', right_image_url || '', dimension_image || '', campaign_banner_url || '',
        v_model_brochure_url || '', 0, v_model_status == 1 ? 1 : 0
      ]
    );

    const modelId = result.insertId;

    // Insert key highlights
    if (key_highlights) {
      await executeQuery(
        `INSERT INTO 91wheels_model_extra_fields (v_model_id, key_highlights, status, added_by)
         VALUES (?, ?, 1, ?)`,
        [modelId, key_highlights, req.user?.id || 1]
      );
    }

    // Insert pros and cons
    if (pros && Array.isArray(pros)) {
      for (const pro of pros) {
        if (pro && pro.trim()) {
          await executeQuery(
            `INSERT INTO 91wheels_vehicle_model_pros_cons (v_model_id, content, classification_type, remark, status, added)
             VALUES (?, ?, 1, 'Advantage', 1, CURRENT_TIMESTAMP)`,
            [modelId, pro.trim()]
          );
        }
      }
    }

    if (cons && Array.isArray(cons)) {
      for (const con of cons) {
        if (con && con.trim()) {
          await executeQuery(
            `INSERT INTO 91wheels_vehicle_model_pros_cons (v_model_id, content, classification_type, remark, status, added)
             VALUES (?, ?, 2, 'Disadvantage', 1, CURRENT_TIMESTAMP)`,
            [modelId, con.trim()]
          );
        }
      }
    }

    // Insert colors
    if (colors && Array.isArray(colors)) {
      for (const color of colors) {
        if (color.title) {
          await executeQuery(
            `INSERT INTO 91wheels_vehicle_model_colors (v_model_id, v_make_id, v_type_id, title, hex, ImageUrl, dual_tone)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [modelId, v_make_id, v_type_id, color.title, color.hex || '', color.image_url || '', color.dual_tone || 0]
          );
        }
      }
    }

    // Insert model groups
    if (groups && Array.isArray(groups)) {
      for (let i = 0; i < groups.length; i++) {
        await executeQuery(
          `INSERT INTO 91wheels_vehicle_model_groups (group_model_id, v_model_id, rank)
           VALUES (?, ?, ?)`,
          [modelId, groups[i], i + 1]
        );
      }
    }

    // Update make counters
    await updateMakeCounters(v_make_id, v_type_id, subCategory || 0);

    res.status(201).json({
      success: true,
      data: { id: modelId },
      message: 'Vehicle model created successfully'
    });
  } catch (error) {
    console.error('Error creating vehicle model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create vehicle model'
    });
  }
});

// Update vehicle model
router.put('/:id', authMiddleware, requirePermission('vehicle-models', 'update'), async (req, res) => {
  try {
    const modelId = req.params.id;
    const {
      v_make_id, v_type_id, v_model_name, v_model_display_name,
      parent_slug, p_model_id, v_model_description, v_model_history,
      v_model_min_price, v_model_max_price, v_model_status,
      body_type, sub_body_type, subCategory,
      is_ev, is_mini, is_auto_expo, is_baas, is_luxury,
      is_expected_launch, is_expected_price,
      electric_range, charging_time,
      v_gears, v_max_power, v_max_torque, v_mileage,
      fuel_json, transmission_json,
      launched_date, discontinued_date,
      v_model_rank, summary, should_buy, atf_content,
      v_model_expert_speak, key_model_feature_json, key_highlights,
      top_variant_id, base_variant_id, recommended_variant_id, recommended_variant_atf,
      profile_image_url, left_image_url, right_image_url, dimension_image, campaign_banner_url,
      v_model_brochure_url,
      pros, cons, colors, groups
    } = req.body;

    // Get old status for tracking
    const oldModel = await executeQuery(
      'SELECT v_model_status, v_make_id, v_type_id, subCategory FROM 91wheels_vehicle_models WHERE v_model_id = ?',
      [modelId]
    );

    if (!oldModel || oldModel.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle model not found'
      });
    }

    const oldStatus = oldModel[0].v_model_status;

    // Extract numeric values
    let v_max_power_int = null;
    let v_max_torque_int = null;
    
    if (v_max_power) {
      const powerMatch = v_max_power.match(/^(\d+(\.\d+)?)/);
      if (powerMatch) v_max_power_int = parseFloat(powerMatch[1]);
    }
    
    if (v_max_torque) {
      const torqueMatch = v_max_torque.match(/^(\d+(\.\d+)?)/);
      if (torqueMatch) v_max_torque_int = parseFloat(torqueMatch[1]);
    }

    // Remove commas from prices
    const minPrice = v_model_min_price ? String(v_model_min_price).replace(/,/g, '') : null;
    const maxPrice = v_model_max_price ? String(v_model_max_price).replace(/,/g, '') : null;

    // Calculate parent model ID
    let parentModelId = p_model_id || null;
    if (v_model_status == 1 && parent_slug) {
      const parentResult = await executeQuery(
        `SELECT MIN(v_model_id) AS min_id
         FROM 91wheels_vehicle_models
         WHERE parent_slug = ?`,
        [parent_slug]
      );
      if (parentResult[0] && parentResult[0].min_id) {
        parentModelId = parentResult[0].min_id;
      }
    }

    const minYear = launched_date ? launched_date.split('-')[0] : null;
    const maxYear = discontinued_date ? discontinued_date.split('-')[0] : null;

    // Mark gallery profile images as non-profile if new profile image is uploaded
    if (profile_image_url) {
      await executeQuery(
        'UPDATE 91wheels_vehicle_model_gallery SET is_profile = 0 WHERE v_model_id = ?',
        [modelId]
      );
    }

    // Update main model
    await executeQuery(
      `UPDATE 91wheels_vehicle_models SET
       v_make_id = ?, v_type_id = ?, v_model_name = ?, v_model_display_name = ?, parent_slug = ?, p_model_id = ?,
       v_model_description = ?, v_model_history = ?, v_model_min_price = ?, v_model_max_price = ?, v_model_status = ?,
       body_type = ?, sub_body_type = ?, subCategory = ?, is_ev = ?, is_mini = ?, is_auto_expo = ?, is_baas = ?, is_luxury = ?,
       is_expected_launch = ?, is_expected_price = ?, electric_range = ?, charging_time = ?,
       v_gears = ?, v_max_power = ?, v_max_torque = ?, v_max_power_int = ?, v_max_torque_int = ?, v_mileage = ?,
       fuel_json = ?, transmission_json = ?, launched_date = ?, discontinued_date = ?, min_year = ?, max_year = ?,
       v_model_rank = ?, summary = ?, should_buy = ?, atf_content = ?, v_model_expert_speak = ?, key_model_feature_json = ?,
       top_variant_id = ?, base_variant_id = ?, recommended_variant_id = ?, recommended_variant_atf = ?,
       profile_image_url = COALESCE(NULLIF(?, ''), profile_image_url),
       left_image_url = COALESCE(NULLIF(?, ''), left_image_url),
       right_image_url = COALESCE(NULLIF(?, ''), right_image_url),
       dimension_image = COALESCE(NULLIF(?, ''), dimension_image),
       campaign_banner_url = COALESCE(NULLIF(?, ''), campaign_banner_url),
       v_model_brochure_url = COALESCE(NULLIF(?, ''), v_model_brochure_url),
       v_model_updated = CURRENT_TIMESTAMP
       WHERE v_model_id = ?`,
      [
        v_make_id, v_type_id, v_model_name, v_model_display_name, parent_slug || '', parentModelId,
        v_model_description || '', v_model_history || '', minPrice, maxPrice, v_model_status || 1,
        body_type || '', sub_body_type || '', subCategory || 0, is_ev || 0, is_mini || 0, is_auto_expo || 0, is_baas || 0, is_luxury || 0,
        is_expected_launch || 0, is_expected_price || 0, electric_range || null, charging_time || null,
        v_gears || null, v_max_power || null, v_max_torque || null, v_max_power_int, v_max_torque_int, v_mileage || null,
        fuel_json ? JSON.stringify(fuel_json) : null, transmission_json ? JSON.stringify(transmission_json) : null,
        launched_date || null, discontinued_date || null, minYear, maxYear,
        v_model_rank || 0, summary || '', should_buy || '', atf_content || '', v_model_expert_speak || '',
        key_model_feature_json ? JSON.stringify(key_model_feature_json) : '[]',
        top_variant_id || 0, base_variant_id || 0, recommended_variant_id || 0, recommended_variant_atf || '',
        profile_image_url || '', left_image_url || '', right_image_url || '', dimension_image || '', campaign_banner_url || '',
        v_model_brochure_url || '', modelId
      ]
    );

    // Update key highlights
    const existingHighlights = await executeQuery(
      'SELECT * FROM 91wheels_model_extra_fields WHERE v_model_id = ?',
      [modelId]
    );

    if (existingHighlights.length > 0) {
      await executeQuery(
        'UPDATE 91wheels_model_extra_fields SET key_highlights = ?, added_by = ? WHERE v_model_id = ?',
        [key_highlights || '', req.user?.id || 1, modelId]
      );
    } else if (key_highlights) {
      await executeQuery(
        'INSERT INTO 91wheels_model_extra_fields (v_model_id, key_highlights, status, added_by) VALUES (?, ?, 1, ?)',
        [modelId, key_highlights, req.user?.id || 1]
      );
    }

    // Update pros and cons - soft delete old ones
    await executeQuery(
      'UPDATE 91wheels_vehicle_model_pros_cons SET status = 0 WHERE v_model_id = ?',
      [modelId]
    );

    if (pros && Array.isArray(pros)) {
      for (const pro of pros) {
        if (pro && pro.trim()) {
          await executeQuery(
            `INSERT INTO 91wheels_vehicle_model_pros_cons (v_model_id, content, classification_type, remark, status, added)
             VALUES (?, ?, 1, 'Advantage', 1, CURRENT_TIMESTAMP)`,
            [modelId, pro.trim()]
          );
        }
      }
    }

    if (cons && Array.isArray(cons)) {
      for (const con of cons) {
        if (con && con.trim()) {
          await executeQuery(
            `INSERT INTO 91wheels_vehicle_model_pros_cons (v_model_id, content, classification_type, remark, status, added)
             VALUES (?, ?, 2, 'Disadvantage', 1, CURRENT_TIMESTAMP)`,
            [modelId, con.trim()]
          );
        }
      }
    }

    // Update model groups
    if (groups && Array.isArray(groups)) {
      await executeQuery('DELETE FROM 91wheels_vehicle_model_groups WHERE group_model_id = ?', [modelId]);
      for (let i = 0; i < groups.length; i++) {
        await executeQuery(
          'INSERT INTO 91wheels_vehicle_model_groups (group_model_id, v_model_id, rank) VALUES (?, ?, ?)',
          [modelId, groups[i], i + 1]
        );
      }
    }

    // If model becomes discontinued, update all variants
    if (v_model_status == 2) {
      await executeQuery(
        'UPDATE 91wheels_vehicle_variants SET v_variant_status = 2 WHERE v_model_id = ?',
        [modelId]
      );
    }

    // Track status changes
    if (oldStatus == 3 && v_model_status == 1) {
      await executeQuery(
        `UPDATE 91wheels_vehicle_models 
         SET status_change_check = 1, status_change_date = CURRENT_TIMESTAMP, has_faq = 1
         WHERE v_model_id = ?`,
        [modelId]
      );
      
      // Add to SMS notification queue
      await executeQuery(
        'INSERT INTO 91wheels_sms_upcoming_models (v_model_id, notification_sent) VALUES (?, 0)',
        [modelId]
      );
    } else if (oldStatus == 1 && v_model_status == 2) {
      await executeQuery(
        'UPDATE 91wheels_vehicle_models SET status_change_check = 2, status_change_date = CURRENT_TIMESTAMP WHERE v_model_id = ?',
        [modelId]
      );
    }

    // Update make counters
    await updateMakeCounters(v_make_id, v_type_id, subCategory || 0);

    res.json({
      success: true,
      message: 'Vehicle model updated successfully'
    });
  } catch (error) {
    console.error('Error updating vehicle model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vehicle model'
    });
  }
});

// Delete vehicle model (soft delete)
router.delete('/:id', authMiddleware, requirePermission('vehicle-models', 'delete'), async (req, res) => {
  try {
    await executeQuery(
      'UPDATE 91wheels_vehicle_models SET is_deleted = 1, v_model_updated = CURRENT_TIMESTAMP WHERE v_model_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Vehicle model deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting vehicle model:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vehicle model'
    });
  }
});

// Helper function to update make counters
async function updateMakeCounters(makeId, typeId, subCategory) {
  try {
    const result = await executeQuery(
      `SELECT
        SUM(CASE WHEN v_model_status=1 THEN 1 ELSE 0 END) as active_model_cnt,
        SUM(CASE WHEN v_model_status=3 THEN 1 ELSE 0 END) as upcoming_model_cnt
       FROM 91wheels_vehicle_models
       WHERE v_make_id = ? AND v_type_id = ? AND subCategory = ? AND is_deleted = 0`,
      [makeId, typeId, subCategory]
    );

    if (result && result[0]) {
      await executeQuery(
        'UPDATE 91wheels_vehicle_makes SET active_model_cnt = ?, upcoming_model_cnt = ? WHERE v_make_id = ?',
        [result[0].active_model_cnt || 0, result[0].upcoming_model_cnt || 0, makeId]
      );
    }
  } catch (error) {
    console.error('Error updating make counters:', error);
  }
}

module.exports = router;
