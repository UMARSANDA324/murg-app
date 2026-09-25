const { subscribeToBranch } = require('../services/realtimeService');
const { error } = require('../utils/responseUtils');

class RealtimeController {
  streamBranch(req, res) {
    const branchId = req.branchId;
    if (!branchId) {
      return error(res, 'A branch is required for a real-time subscription.', 400);
    }

    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    res.write(`event: ready\ndata: ${JSON.stringify({ branchId })}\n\n`);

    const unsubscribe = subscribeToBranch(branchId, (event) => {
      res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 25000);
    const close = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    req.on('close', close);
    res.on('error', close);
  }
}

module.exports = new RealtimeController();
