const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true }
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(
    name => dependencies[name] || require(name), module, module.exports);
  return module.exports;
}
test('operator queue uses registered route and supports pagination', async () => {
  let call;
  const { loadOperatorQueue } = load('src/utils/operatorQueue.ts', {
    './api': { get: async (...args) => {
      call = args;
      return { data: { results: [{ id: 9 }], count: 30, next: '/api/delivery/operator/queue/?page=3' } };
    }}
  });
  assert.deepEqual(await loadOperatorQueue(2), { items: [{id:9}], count:30, nextPage:3 });
  assert.deepEqual(call, ['/delivery/operator/queue/', { params: {page:2} }]);
});
test('operator queue accepts unpaginated responses and rejects malformed data', async () => {
  let data = [{id:1}];
  const { loadOperatorQueue } = load('src/utils/operatorQueue.ts', {
    './api': { get: async () => ({data}) }
  });
  assert.deepEqual(await loadOperatorQueue(), {items:data,count:1,nextPage:null});
  data = {detail:'not a queue'};
  await assert.rejects(loadOperatorQueue(), /indisponible/);
});
function layer() {
  const handlers = new Map();
  return {
    on: (name, handler) => handlers.set(name, handler),
    off: name => handlers.delete(name),
    emit: (name, src='tile') => handlers.get(name)?.({tile:{src}}),
    redraw() { this.redraws = (this.redraws || 0) + 1; },
    handlers
  };
}
test('map retains failed tiles until recovery and allows retry', () => {
  const { monitorTiles } = load('src/app/supervision/tileHealth.ts');
  const tiles = layer(), states = [];
  const health = monitorTiles(tiles, state => states.push(state));
  tiles.emit('loading');
  tiles.emit('tileerror', 'bad');
  tiles.emit('tileload', 'good');
  tiles.emit('load');
  assert.deepEqual(states.at(-1), {loading:false,error:true});
  health.retry();
  assert.equal(tiles.redraws, 1);
  assert.deepEqual(states.at(-1), {loading:true,error:false});
  tiles.emit('load');
  assert.deepEqual(states.at(-1), {loading:false,error:false});
  health.dispose();
  assert.equal(tiles.handlers.size, 0);
});
test('map detects stalled loads; one tile cannot hide the timeout', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const { monitorTiles } = load('src/app/supervision/tileHealth.ts');
  const tiles = layer(), states = [];
  const health = monitorTiles(tiles, state => states.push(state));
  tiles.emit('loading');
  t.mock.timers.tick(15000);
  tiles.emit('tileload', 'partial');
  assert.deepEqual(states.at(-1), {loading:false,error:true});
  tiles.emit('load');
  assert.deepEqual(states.at(-1), {loading:false,error:false});
  health.dispose();
});
