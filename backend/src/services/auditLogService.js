const { AuditLog } = require('../models');
const { reserveLegacyIds } = require('./legacyIdService');

async function recordAuditLog(values, session = null) {
  const [mysqlId] = await reserveLegacyIds(AuditLog, 'auditLogId', 1, session);

  if (session) {
    const [entry] = await AuditLog.create([{ ...values, mysqlId }], { session });
    return entry;
  }

  const [entry] = await AuditLog.create([{ ...values, mysqlId }]);
  return entry;
}

module.exports = { recordAuditLog };