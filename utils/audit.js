const { executeQuery } = require('../config/database');

async function logAudit({
  userId,
  action,
  entity,
  entityId = null,
  details = {},
  ipAddress = null,
  userAgent = null
}) {
  try {
    await executeQuery(
      `INSERT INTO 91wheels_audit_logs (user_id, action, entity, entity_id, details, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        action,
        entity,
        entityId,
        JSON.stringify(details),
        ipAddress,
        userAgent
      ]
    );
  } catch (error) {
    console.error('Audit log error:', error);
  }
}

async function getAuditLogs({ 
  userId = null, 
  entity = null, 
  limit = 100, 
  offset = 0 
}) {
  try {
    let sql = `
      SELECT 
        al.id,
        al.user_id,
        CONCAT(u.first_name, ' ', u.last_name) as user_name,
        u.email as user_email,
        al.action,
        al.entity,
        al.entity_id,
        al.details,
        al.ip_address,
        al.timestamp
      FROM 91wheels_audit_logs al
      JOIN 91wheels_users u ON al.user_id = u.user_id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (userId) {
      sql += ' AND al.user_id = ?';
      params.push(userId);
    }
    
    if (entity) {
      sql += ' AND al.entity = ?';
      params.push(entity);
    }
    
    sql += ' ORDER BY al.timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const logs = await executeQuery(sql, params);
    
    return logs.map(log => ({
      ...log,
      details: JSON.parse(log.details)
    }));
  } catch (error) {
    console.error('Get audit logs error:', error);
    return [];
  }
}

function getClientInfo(req) {
  const ipAddress = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress ||
                    'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  return { ipAddress, userAgent };
}

module.exports = {
  logAudit,
  getAuditLogs,
  getClientInfo
};
