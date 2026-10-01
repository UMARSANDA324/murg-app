const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAdmin, requireBranchScope } = require('../../src/middleware/auth');
const { Branch } = require('../../src/models');

function createResponse() {
  return {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('requireAdmin allows only the Admin role', () => {
  const adminResponse = createResponse();
  let adminContinued = false;
  requireAdmin(
    { user: { role: 'Admin' } },
    adminResponse,
    () => { adminContinued = true; }
  );
  assert.equal(adminContinued, true);
  assert.equal(adminResponse.statusCode, null);

  for (const role of ['Staff', 'Cashier', 'Sub-admin']) {
    const response = createResponse();
    let continued = false;
    requireAdmin({ user: { role } }, response, () => { continued = true; });
    assert.equal(continued, false, `${role} must not pass Admin authorization`);
    assert.equal(response.statusCode, 403);
  }
});

test('requireAdmin rejects missing identity', () => {
  const response = createResponse();
  let continued = false;
  requireAdmin({}, response, () => { continued = true; });

  assert.equal(continued, false);
  assert.equal(response.statusCode, 403);
});

test('requireBranchScope forces Staff to their authenticated active branch', async () => {
  const originalFindOne = Branch.findOne;
  Branch.findOne = () => ({
    select() {
      return { lean: async () => ({ status: 'active' }) };
    },
  });
  const request = {
    user: { role: 'Staff', isGlobalAdmin: false, facilityID: 'MURG/007' },
    query: { branchId: 'MURG/007' },
    body: {},
    params: {},
  };
  let continued = false;

  try {
    await requireBranchScope(request, createResponse(), () => { continued = true; });
  } finally {
    Branch.findOne = originalFindOne;
  }

  assert.equal(continued, true);
  assert.equal(request.branchId, 'MURG/007');
});

test('requireBranchScope rejects Staff branch overrides before querying the branch', async () => {
  const request = {
    user: { role: 'Staff', isGlobalAdmin: false, facilityID: 'MURG/007' },
    query: { branchId: 'MURG/001' },
    body: {},
    params: {},
  };
  const response = createResponse();
  let continued = false;

  await requireBranchScope(request, response, () => { continued = true; });

  assert.equal(continued, false);
  assert.equal(response.statusCode, 403);
});

test('requireBranchScope rejects operations for inactive branches', async () => {
  const originalFindOne = Branch.findOne;
  Branch.findOne = () => ({
    select() {
      return { lean: async () => ({ status: 'inactive' }) };
    },
  });
  const request = {
    user: { role: 'Staff', isGlobalAdmin: false, facilityID: 'MURG/007' },
    query: {},
    body: {},
    params: {},
  };
  const response = createResponse();
  let continued = false;

  try {
    await requireBranchScope(request, response, () => { continued = true; });
  } finally {
    Branch.findOne = originalFindOne;
  }

  assert.equal(continued, false);
  assert.equal(response.statusCode, 403);
});
