-- Update backend access for the user
UPDATE 91wheels_users 
SET backend_access_allowed = 1 
WHERE email = 'deepak.kumar@exaltosoft.com';

-- Verify the update
SELECT user_id, first_name, last_name, email, backend_access_allowed, role_id
FROM 91wheels_users 
WHERE email = 'deepak.kumar@exaltosoft.com';
