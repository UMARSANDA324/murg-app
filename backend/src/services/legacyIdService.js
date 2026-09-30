const { Counter } = require('../models');

async function reserveLegacyIds(Model, counterName, count, session = null) {
  if (!Number.isInteger(count) || count < 1) return [];

  const latestRecordQuery = Model.findOne().sort({ mysqlId: -1 }).select('mysqlId').lean();
  const counterQuery = Counter.findOne({ name: counterName }).lean();
  const latestCounterQuery = Counter.findOne().sort({ mysqlId: -1 }).select('mysqlId').lean();

  const [latestRecord, counter, latestCounter] = session
    ? await Promise.all([
        latestRecordQuery.session(session),
        counterQuery.session(session),
        latestCounterQuery.session(session),
      ])
    : await Promise.all([latestRecordQuery, counterQuery, latestCounterQuery]);

  const firstId = Math.max(latestRecord?.mysqlId || 0, counter?.lastID || 0) + 1;
  const lastId = firstId + count - 1;

  if (counter) {
    if (session) {
      await Counter.updateOne({ _id: counter._id }, { $set: { lastID: lastId } }, { session });
    } else {
      await Counter.updateOne({ _id: counter._id }, { $set: { lastID: lastId } });
    }
  } else {
    const counterPayload = {
      name: counterName,
      lastID: lastId,
      mysqlId: (latestCounter?.mysqlId || 0) + 1,
    };

    if (session) {
      await Counter.create([{ ...counterPayload }], { session });
    } else {
      await Counter.create(counterPayload);
    }
  }

  return Array.from({ length: count }, (_, index) => firstId + index);
}

module.exports = { reserveLegacyIds };