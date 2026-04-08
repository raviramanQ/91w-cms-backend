-- OAuth Migration Script for 91W CMS
-- Minimal migration - uses existing 91wheels_users table structure

-- Create audit_logs table for tracking all CMS operations
CREATE TABLE IF NOT EXISTS 91wheels_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    entity VARCHAR(50) NOT NULL,
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES 91wheels_users(user_id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity),
    INDEX idx_timestamp (timestamp)
);

-- Ensure superadmin role exists
INSERT INTO 91wheels_user_roles (role_name, role_description, status)
SELECT 'superadmin', 'Super Administrator with full system access', 1
WHERE NOT EXISTS (
    SELECT 1 FROM 91wheels_user_roles WHERE role_name = 'superadmin'
);

-- Note: We're using existing columns from 91wheels_users table:
-- - email (for OAuth email)
-- - first_name, last_name (for user name)
-- - status (for active status check)
-- - role_id (for role-based permissions)

-- Optional: Set your initial superadmin user (REPLACE WITH YOUR EMAIL)
-- UPDATE 91wheels_users 
-- SET role_id = (SELECT role_id FROM 91wheels_user_roles WHERE role_name = 'superadmin' LIMIT 1)
-- WHERE email = 'admin@unicorntechmedia.com';
