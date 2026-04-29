const assert = require('node:assert/strict');
const test = require('node:test');

require('../backend/config/database');

const loadCommentControllerWithPool = (pool) => {
  const databasePath = require.resolve('../backend/config/database');
  const controllerPath = require.resolve('../backend/controllers/commentController');
  delete require.cache[controllerPath];
  require.cache[databasePath].exports.getPool = () => pool;
  return require('../backend/controllers/commentController');
};

const createJsonResponse = () => {
  const response = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
  return response;
};

test('returns doc star count and current user state', async () => {
  const calls = [];
  const pool = {
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/COUNT\(\*\) AS count FROM doc_stars/.test(sql)) {
        return [[{ count: 3 }]];
      }
      if (/SELECT id FROM doc_stars/.test(sql)) {
        return [[{ id: 8 }]];
      }
      return [[]];
    }
  };
  const controller = loadCommentControllerWithPool(pool);
  const response = createJsonResponse();

  await controller.getDocStarStatus({
    params: { docId: ' codex-cli ' },
    user: { userId: 12 }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, {
    docId: 'codex-cli',
    starred: true,
    count: 3
  });
  assert.ok(calls.some(call => /CREATE TABLE IF NOT EXISTS doc_stars/.test(call.sql)));
  assert.ok(calls.some(call => /UNIQUE KEY uniq_doc_stars_user_doc/.test(call.sql)));
});

test('stars and unstars a document for the authenticated user', async () => {
  const calls = [];
  const pool = {
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/SELECT id FROM users/.test(sql)) {
        return [[{ id: 12 }]];
      }
      if (/COUNT\(\*\) AS count FROM doc_stars/.test(sql)) {
        return [[{ count: 4 }]];
      }
      return [[]];
    }
  };
  const controller = loadCommentControllerWithPool(pool);

  const starResponse = createJsonResponse();
  await controller.starDoc({
    params: { docId: 'codex-cli' },
    user: { userId: 12 }
  }, starResponse);

  assert.equal(starResponse.statusCode, 200);
  assert.deepEqual(starResponse.payload, {
    docId: 'codex-cli',
    starred: true,
    count: 4,
    message: 'Star成功'
  });
  assert.ok(calls.some(call => /INSERT IGNORE INTO doc_stars/.test(call.sql)));

  const unstarResponse = createJsonResponse();
  await controller.unstarDoc({
    params: { docId: 'codex-cli' },
    user: { userId: 12 }
  }, unstarResponse);

  assert.equal(unstarResponse.statusCode, 200);
  assert.deepEqual(unstarResponse.payload, {
    docId: 'codex-cli',
    starred: false,
    count: 4,
    message: '取消Star成功'
  });
  assert.ok(calls.some(call => /DELETE FROM doc_stars/.test(call.sql)));
});

test('returns the authenticated user doc stars for account page', async () => {
  const calls = [];
  const pool = {
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (/FROM doc_stars/.test(sql) && /WHERE user_id = \?/.test(sql)) {
        return [[
          { doc_id: 'codex-cli', created_at: '2026-04-28 10:00:00' },
          { doc_id: 'getting-started', created_at: '2026-04-27 09:00:00' }
        ]];
      }
      return [[]];
    }
  };
  const controller = loadCommentControllerWithPool(pool);
  const response = createJsonResponse();

  await controller.getUserDocStars({
    user: { userId: 12 }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, {
    stars: [
      { docId: 'codex-cli', starredAt: '2026-04-28 10:00:00' },
      { docId: 'getting-started', starredAt: '2026-04-27 09:00:00' }
    ],
    count: 2
  });
  assert.ok(calls.some(call => /ORDER BY created_at DESC/.test(call.sql)));
  assert.deepEqual(calls.at(-1).params, [12]);
});
