const mongoose = require('mongoose');

const EXPECTED_TEST_DATABASE = 'murg_test';

function getTestDatabaseName(uri) {
  if (!uri) {
    throw new Error('MONGODB_TEST_URI is required for integration tests.');
  }

  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error('MONGODB_TEST_URI must be a valid MongoDB connection URI.');
  }

  if (!['mongodb:', 'mongodb+srv:'].includes(parsedUri.protocol)) {
    throw new Error('MONGODB_TEST_URI must use mongodb:// or mongodb+srv://.');
  }

  let pathDatabaseName;
  try {
    pathDatabaseName = decodeURIComponent(parsedUri.pathname.replace(/^\/+/, ''));
  } catch {
    throw new Error('MONGODB_TEST_URI contains an invalid database name.');
  }

  const queryDatabaseName = parsedUri.searchParams.get('dbName');
  const resolvedDatabaseName = queryDatabaseName || pathDatabaseName;
  if (
    pathDatabaseName !== EXPECTED_TEST_DATABASE ||
    resolvedDatabaseName !== EXPECTED_TEST_DATABASE
  ) {
    throw new Error(`Refusing integration tests: database must resolve exactly to ${EXPECTED_TEST_DATABASE}.`);
  }

  return resolvedDatabaseName;
}

function assertTestDatabaseConnection(connection = mongoose.connection) {
  if (connection.name !== EXPECTED_TEST_DATABASE || !connection.db) {
    throw new Error(`Refusing test database operation outside ${EXPECTED_TEST_DATABASE}.`);
  }
}

async function connectTestDatabase(uri = process.env.MONGODB_TEST_URI) {
  const databaseName = getTestDatabaseName(uri);
  if (mongoose.connection.readyState !== 0) {
    throw new Error('Refusing integration tests: Mongoose is already connected.');
  }

  await mongoose.connect(uri, { dbName: databaseName });
  assertTestDatabaseConnection();
  return mongoose.connection;
}

async function clearTestModelCollections(models = require('../../src/models')) {
  assertTestDatabaseConnection();

  for (const model of Object.values(models)) {
    if (model.db !== mongoose.connection) {
      throw new Error('Refusing test cleanup for a model on another database connection.');
    }
  }

  await Promise.all(Object.values(models).map((model) => model.deleteMany({})));
}

async function disconnectTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    assertTestDatabaseConnection();
    await mongoose.disconnect();
  }
}

module.exports = {
  EXPECTED_TEST_DATABASE,
  getTestDatabaseName,
  assertTestDatabaseConnection,
  connectTestDatabase,
  clearTestModelCollections,
  disconnectTestDatabase,
};