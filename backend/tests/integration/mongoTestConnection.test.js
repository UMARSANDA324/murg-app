const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EXPECTED_TEST_DATABASE,
  connectTestDatabase,
  disconnectTestDatabase,
} = require('../support/mongoTestDatabase');

test('integration target resolves to the isolated test database', async (context) => {
  context.after(disconnectTestDatabase);

  const connection = await connectTestDatabase();
  assert.equal(connection.name, EXPECTED_TEST_DATABASE);
});