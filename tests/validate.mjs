import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const html = await readFile('index.html', 'utf8');
const open = html.lastIndexOf('<script>');
const close = html.indexOf('</script>', open);
assert.ok(open >= 0 && close > open, 'inline game script exists');
const gameScript = html.slice(open + '<script>'.length, close);
new vm.Script(gameScript, { filename: 'traumagochi-inline.js' });

function createGame(savedValue = null) {
  const elements = new Map();
  const buttons = ['btn-feed','btn-ritual','btn-darkness','btn-heal','btn-shop','btn-work'].map(id => makeElement(id));
  const storage = new Map();
  if (savedValue !== null) storage.set('traumagochi_state', savedValue);
  function makeElement(id = '') {
    const classes = new Set();
    const el = {
      id, style: {}, innerText: '', textContent: '', innerHTML: '', value: '',
      disabled: false, offsetWidth: 0, title: '', dataset: {},
      classList: {
        add(...tokens) { tokens.forEach(x => classes.add(x)); },
        remove(...tokens) { tokens.forEach(x => classes.delete(x)); },
        contains(token) { return classes.has(token); },
        toggle(token, force) {
          const shouldAdd = force === undefined ? !classes.has(token) : !!force;
          if (shouldAdd) classes.add(token); else classes.delete(token);
          return shouldAdd;
        }
      }
    };
    Object.defineProperty(el, 'className', {
      get() { return [...classes].join(' '); },
      set(value) { classes.clear(); String(value || '').split(/\s+/).filter(Boolean).forEach(x => classes.add(x)); }
    });
    return el;
  }
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    querySelectorAll(selector) {
      if (selector === '.actions .btn') return buttons;
      return [];
    }
  };
  const context = vm.createContext({
    document,
    window: {},
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    setInterval(fn) { return {fn}; },
    clearInterval() {},
    setTimeout(fn) { return {fn}; },
    clearTimeout() {},
    console: {log(){},warn(){},error(){}}
  });
  new vm.Script(gameScript, { filename: 'traumagochi-inline.js' }).runInContext(context);
  return {context, elements, storage};
}

const oldSave = JSON.stringify({
  life:100, satiation:100, spirit:100, darkness:50, souls:10,
  candles:5, elixirs:2, ageDays:0, stage:1, petName:'Безымянный',
  isDead:false, isWorking:true, lastSave:Date.now()
});
const game = createGame(oldSave);
const {context: ctx, storage} = game;
const read = expr => vm.runInContext(expr, ctx);
const val = expr => JSON.parse(read('JSON.stringify(' + expr + ')'));

assert.equal(val('state.isWorking'), false, 'loading an old save closes any interrupted mini-game');

const corrupted = createGame('{invalid-json');
const corruptedRead = expr => vm.runInContext(expr, corrupted.context);
const corruptedVal = expr => JSON.parse(corruptedRead('JSON.stringify(' + expr + ')'));
assert.equal(corruptedVal('state.isDead'), false, 'corrupted saves fall back to a fresh living state');
assert.ok(corrupted.storage.has('traumagochi_state'), 'fresh state replaces an unreadable save when storage is writable');
assert.match(corrupted.elements.get('log').innerText, /Сохранение повреждено/, 'corrupted-save recovery is explained to the player');
assert.equal(val('state.memoryShards'), 0, 'old saves migrate with zero memory shards');
assert.equal(val('state.lifetime.taps'), 0, 'old saves receive default lifetime counters');
assert.equal(val('state.stage'), 1, 'legacy stage is preserved');
assert.ok(html.includes('lastTick: Date.now()'), 'simulation clock is separate from autosave clock');
assert.ok(!/user-scalable=no|maximum-scale=1/.test(html), 'users can zoom the interface');
assert.ok(html.includes('width: min(100%, 560px)'), 'game stays centered and readable on desktop');
assert.ok(html.includes('@media(prefers-reduced-motion:reduce)'), 'reduced-motion preference is respected');
assert.ok(html.includes('role="button" tabindex="0" aria-label="Погладить питомца"'), 'pet is keyboard-accessible');
assert.ok(html.includes('aria-modal="true"'), 'dialogs expose accessible modal semantics');
assert.ok(!html.includes('drop-shadow(none)'), 'dead-pet filter does not contain invalid CSS');
assert.ok(html.includes('onclick="cancelMiniGame()"'), 'resonance can be cancelled without reloading');
assert.ok(html.includes("event.key !== 'Escape'"), 'Escape key closes interruptible dialogs');
assert.ok(html.includes('aria-live="polite"'), 'game notifications are announced to assistive technology');
assert.ok(html.includes('const diffSeconds = Math.max(0, (now - lastTick) / 1000);'), 'offline progress uses the simulation clock');

const offlineSave = JSON.stringify({
  life:100, satiation:100, spirit:100, darkness:50, souls:10,
  candles:5, elixirs:2, ageDays:0, stage:1, petName:'Безымянный',
  isDead:false, isWorking:false, lastSave:Date.now() - 4 * 60000
});
const offlineGame = createGame(offlineSave);
const offlineRead = expr => vm.runInContext(expr, offlineGame.context);
const offlineVal = expr => JSON.parse(offlineRead('JSON.stringify(' + expr + ')'));
assert.equal(offlineVal('state.lifetime.minutesAlive'), 4, 'four elapsed minutes are simulated even with frequent autosaves');
assert.ok(Math.abs(offlineVal('state.ageDays') - 0.02) < 1e-9, 'offline simulation advances age consistently');
const persistedOffline = JSON.parse(offlineGame.storage.get('traumagochi_state'));
assert.equal(persistedOffline.lifetime.minutesAlive, 4, 'offline progress is persisted immediately and cannot be replayed after reload');
assert.match(offlineGame.elements.get('log').innerText, /ещё 4 мин/, 'offline catch-up produces an accurate visible summary');

read('simulateOneMinute()');
const decay = val('({sat:state.satiation, spirit:state.spirit, dark:state.darkness, age:state.ageDays})');
assert.ok(Math.abs(decay.sat - 99.75) < 1e-9, 'satiation decays at the balanced rate');
assert.ok(Math.abs(decay.spirit - 99.88) < 1e-9, 'spirit decays at the balanced rate');
assert.ok(Math.abs(decay.dark - 50.06) < 1e-9, 'darkness grows slowly enough to permit evolution');
assert.ok(Math.abs(decay.age - 0.005) < 1e-9, 'game age advances once per simulated minute');

read('tapPet()');
assert.equal(val('state.lifetime.taps'), 1, 'pet taps are recorded');
assert.equal(val('state.achievements.firstTouch'), true, 'first-touch achievement unlocks');
assert.equal(val('state.souls'), 12, 'achievement reward is granted once');

read('actionFeed()');
assert.equal(val('state.lifetime.feedings'), 1, 'feeding is tracked');
assert.ok(storage.has('traumagochi_state'), 'care action immediately saves progress');

read("state.dailyVow={key:todayKey(),index:2,progress:0,claimed:false}; recordDailyProgress('rituals',3);");
const candlesBefore = val('state.candles');
read('claimDailyVow()');
assert.equal(val('state.dailyVow.claimed'), true, 'completed daily vow can be claimed');
assert.equal(val('state.candles'), candlesBefore + 2, 'daily vow gives its listed candle reward');

read("state.memoryShards=4; buyMemoryUpgrade('warmSoul');");
assert.equal(val('state.memoryUpgrades.warmSoul'), true, 'permanent memory upgrade is purchased');
assert.equal(val('state.memoryShards'), 2, 'memory purchase deducts its cost');

read('state.life=0; state.ageDays=6; state.stage=3; state.memoryShards=2; state.deathRewarded=false; state.isDead=false; checkDeath();');
assert.equal(val('state.isDead'), true, 'zero life triggers game over');
assert.equal(val('state.memoryShards'), 7, 'death grants the calculated memory shards');
read('checkDeath()');
assert.equal(val('state.memoryShards'), 7, 'repeated death checks cannot duplicate the memory reward');

read('resetGame()');
assert.equal(val('state.isDead'), false, 'rebirth starts a living pet');
assert.equal(val('state.memoryShards'), 7, 'memory shards persist across rebirth');
assert.equal(val('state.memoryUpgrades.warmSoul'), true, 'permanent upgrades survive rebirth');
assert.equal(val('state.lifetime.reincarnations'), 1, 'reincarnation is counted');
assert.equal(val('state.achievements.reborn'), true, 'rebirth achievement unlocks');

assert.ok(html.includes('id="chroniclesModal"'), 'Chronicles UI is present');
assert.ok(html.includes('id="evo-progress"'), 'evolution progress UI is present');
assert.ok(html.includes('id="memory-earned"'), 'game over exposes memory reward');
assert.ok(html.includes('setInterval(saveGame, 15000)'), 'autosave is enabled for active lives');
assert.ok(html.includes('Учтены последние '), 'offline cap is explained instead of reporting unprocessed time');

console.log('TRAUMAGOCHI validation passed: syntax, legacy migration, balanced ticks, achievements, daily vows, memory upgrades, death rewards, and rebirth.');
