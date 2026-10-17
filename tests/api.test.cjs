const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const axios = require('axios');

function setup() {
  const values = new Map();
  global.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  global.document = { cookie: '' };
  global.window = new EventTarget();
  const filename = path.resolve('src/utils/api.ts');
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  const module = new Module(filename, require.main);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  module._compile(source, filename);
  const client = module.exports;
  client.setTokens('old-access', 'valid-refresh');
  return client;
}
function response(config, data = {}, status = 200) {
  return { config, data, status, statusText: String(status), headers: {} };
}
function failure(config, status, code) {
  return new axios.AxiosError(
    'Test API error',
    code,
    config,
    {},
    status ? response(config, {}, status) : undefined
  );
}
function protectedAdapter(config) {
  if (config.headers.get('Authorization') === 'Bearer old-access')
    return Promise.reject(failure(config, 401));
  return Promise.resolve(response(config, { ok: true }));
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function bounded(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Requête bloquée')), 1000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('parallel 401s share one refresh and all finish', async () => {
  const client = setup();
  let calls = 0;
  const gate = deferred();
  client.default.defaults.adapter = protectedAdapter;
  client.authApi.defaults.adapter = async (config) => {
    calls++;
    await gate.promise;
    return response(config, { access: 'new-access' });
  };
  const requests = Promise.all([
    client.default.get('/a'),
    client.default.get('/b'),
    client.default.get('/c'),
  ]);
  await tick();
  gate.resolve();
  const results = await bounded(requests);
  assert.equal(calls, 1);
  assert.equal(results.length, 3);
  assert.equal(client.getAccessToken(), 'new-access');
});
test('failed refresh rejects every waiting request and clears invalid session', async () => {
  const client = setup();
  let calls = 0;
  const gate = deferred();
  client.default.defaults.adapter = protectedAdapter;
  client.authApi.defaults.adapter = async (config) => {
    calls++;
    await gate.promise;
    throw failure(config, 401);
  };
  const requests = Promise.allSettled([
    client.default.get('/a'),
    client.default.get('/b'),
    client.default.get('/c'),
  ]);
  await tick();
  gate.resolve();
  const results = await bounded(requests);
  assert.equal(calls, 1);
  assert.ok(results.every((result) => result.status === 'rejected'));
  assert.equal(client.getAccessToken(), null);
  assert.equal(client.getRefreshToken(), null);
});
test('temporary provider failure does not erase a valid refresh token', async () => {
  const client = setup();
  client.default.defaults.adapter = protectedAdapter;
  client.authApi.defaults.adapter = async (config) => {
    throw failure(config, 503);
  };
  await assert.rejects(client.default.get('/a'));
  assert.equal(client.getRefreshToken(), 'valid-refresh');
});
test('logout during refresh cannot restore tokens or replay a previous user request', async () => {
  const client = setup();
  const gate = deferred();
  client.default.defaults.adapter = protectedAdapter;
  client.authApi.defaults.adapter = async (config) => {
    await gate.promise;
    return response(config, { access: 'new-access' });
  };
  const request = client.default.get('/a');
  const outcome = Promise.allSettled([request]);
  await tick();
  client.clearTokens();
  gate.resolve();
  assert.equal((await bounded(outcome))[0].status, 'rejected');
  assert.equal(client.getAccessToken(), null);
});
test('refresh token rotation retains the shared session for every waiting request', async () => {
  const client = setup();
  const gate = deferred();
  let calls = 0;
  client.default.defaults.adapter = protectedAdapter;
  client.authApi.defaults.adapter = async (config) => {
    calls++;
    await gate.promise;
    return response(config, {
      access: 'new-access',
      refresh: 'rotated-refresh',
    });
  };
  const requests = Promise.all([
    client.default.get('/a'),
    client.default.get('/b'),
  ]);
  await tick();
  gate.resolve();
  await bounded(requests);
  assert.equal(calls, 1);
  assert.equal(client.getRefreshToken(), 'rotated-refresh');
});
test('network and timeout errors are distinct from wrong credentials', () => {
  const client = setup();
  assert.match(
    client.apiErrorMessage(failure({}, undefined, 'ECONNABORTED')),
    /temps/
  );
  assert.match(
    client.apiErrorMessage(failure({}, undefined, 'ERR_NETWORK')),
    /Connexion au serveur/
  );
  assert.ok(client.default.defaults.timeout > 0);
  assert.ok(client.authApi.defaults.timeout > 0);
});
test('a second unauthorized response ends the session instead of looping', async () => {
  const client = setup();
  let refreshes = 0;
  client.default.defaults.adapter = async (config) => {
    throw failure(config, 401);
  };
  client.authApi.defaults.adapter = async (config) => {
    refreshes++;
    return response(config, { access: 'new-access' });
  };
  await assert.rejects(bounded(client.default.get('/a')));
  assert.equal(refreshes, 1);
  assert.equal(client.getAccessToken(), null);
});
test('a new login during refresh cannot replay an operation under the new user', async () => {
  const client = setup();
  const gate = deferred();
  let replayed = 0;
  client.default.defaults.adapter = async (config) => {
    if (config.headers.get('Authorization') !== 'Bearer old-access') replayed++;
    return protectedAdapter(config);
  };
  client.authApi.defaults.adapter = async (config) => {
    await gate.promise;
    return response(config, { access: 'stale-result' });
  };
  const outcome = Promise.allSettled([
    client.default.post('/private-action', { example: true }),
  ]);
  await tick();
  client.setTokens('another-user', 'another-refresh');
  gate.resolve();
  assert.equal((await bounded(outcome))[0].status, 'rejected');
  assert.equal(client.getAccessToken(), 'another-user');
  assert.equal(replayed, 0);
});
