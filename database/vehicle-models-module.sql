-- Add vehicle-models module to the system

-- Insert module
INSERT INTO 91wheels_modules (module_name, module_slug, module_description, status, created_at)
VALUES ('vehicle-models', 'vehicle-models', 'Vehicle Models Management', 1, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE module_name = module_name;

-- Get the module_id
SET @module_id = (SELECT module_id FROM 91wheels_modules WHERE module_slug = 'vehicle-models');

-- Insert role permissions for admin
INSERT INTO 91wheels_role_permissions (role, module_id, permissions, created_at, updated_at)
VALUES ('admin', @module_id, '["create", "read", "update", "delete"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE permissions = '["create", "read", "update", "delete"]';

-- Insert role permissions for editor
INSERT INTO 91wheels_role_permissions (role, module_id, permissions, created_at, updated_at)
VALUES ('editor', @module_id, '["create", "read", "update"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE permissions = '["create", "read", "update"]';

-- Insert role permissions for viewer
INSERT INTO 91wheels_role_permissions (role, module_id, permissions, created_at, updated_at)
VALUES ('viewer', @module_id, '["read"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON DUPLICATE KEY UPDATE permissions = '["read"]';
