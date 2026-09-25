const { EventEmitter } = require('events');

const events = new EventEmitter();
events.setMaxListeners(0);

let sequence = 0;

function publishBranchEvent({ branchIds, type, operation, referenceId = null }) {
  const uniqueBranchIds = [...new Set((branchIds || []).filter(Boolean))];
  if (uniqueBranchIds.length === 0) return;

  const event = {
    id: `${Date.now()}-${++sequence}`,
    type,
    operation,
    referenceId,
    occurredAt: new Date().toISOString(),
  };

  for (const branchId of uniqueBranchIds) {
    events.emit(`branch:${branchId}`, event);
  }
}

function subscribeToBranch(branchId, listener) {
  const channel = `branch:${branchId}`;
  events.on(channel, listener);
  return () => events.off(channel, listener);
}

module.exports = { publishBranchEvent, subscribeToBranch };
