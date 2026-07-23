/* Interactive dot book engine. */

// Bump this on every change so you can confirm the iPad loaded the latest deploy.
const VERSION = 'v1.1';

// ---- Tunable detection thresholds (adjust on-device if needed) ----
// Detection thresholds — tunable live via the ⚙ Tune panel, persisted to localStorage.
const DEFAULTS = {
  clap: 0.14,       // loudness spike for a clap (lower = easier)
  blow: 0.04,       // sustained loudness for a blow (lower = easier)
  blowFrames: 16,   // frames of sustained sound to count as a blow
  shakeDelta: 14,   // sudden change in gravity = a shake (lower = more sensitive)
  tiltG: 4,         // sideways gravity to count as a tilt (lower = easier)
  tiltFrames: 5,    // frames a tilt must be held (so a shake doesn't count)
  uprightG: 7,      // vertical gravity = device standing up (lower = easier)
  rub: 260,         // px of finger travel over a dot to count as a rub
};
function loadCfg() { try { return JSON.parse(localStorage.getItem('pressHereCfg') || '{}'); } catch (e) { return {}; } }
const CFG = Object.assign({}, DEFAULTS, loadCfg());
function saveCfg() { try { localStorage.setItem('pressHereCfg', JSON.stringify(CFG)); } catch (e) {} }

// Latest live sensor readings, surfaced in the tuning panel.
// roll: + = tilt right, - = tilt left. pitch: gravity along the screen's up axis.
const LIVE = { rms: 0, shake: 0, gx: 0, gy: 0, roll: 0, pitch: 0, angle: 0, phi: 0, otype: '' };

const SKIP_DELAY_SENSOR = 3000;
const SKIP_DELAY_OTHER = 9000;

// ---- DOM ----
const stage = document.getElementById('stage');
const dotsEl = document.getElementById('dots');
const instrEl = document.getElementById('instruction');
const coverEl = document.getElementById('cover');
const skipBtn = document.getElementById('skip');
const enableBtn = document.getElementById('enable');
const menuToggle = document.getElementById('menuToggle');
const menuBar = document.getElementById('menuBar');

// ---- Debug overlay (add #debug or ?debug to the URL; also auto-shows on errors) ----
const DEBUG = /(?:[?#&])debug/i.test(location.search + location.hash);
let dbgEl = null;
function dbg(msg, force) {
  if (!DEBUG && !force) return;
  if (!dbgEl) {
    dbgEl = document.createElement('div');
    dbgEl.id = 'debug';
    document.body.appendChild(dbgEl);
  }
  const lines = (String(msg) + '\n' + dbgEl.textContent).split('\n').slice(0, 14);
  dbgEl.textContent = lines.join('\n');
}
window.addEventListener('error', (e) => dbg('ERR: ' + (e.message || e.error), true));
window.addEventListener('unhandledrejection', (e) =>
  dbg('REJECT: ' + ((e.reason && e.reason.message) || e.reason), true));

// ---- State ----
let idx = 0;
let armed = false;         // true once a page is ready to accept its action
let skipTimer = null;
let dotEls = [];           // current dot elements
let tapProgress = 0;       // for tapCount
let clapProgress = 0;      // for clap
let tiltFrames = 0;        // consecutive frames of a held tilt
let gDbgCount = 0;         // throttle for gravity debug logging
const tappedSet = new Set(); // for tapAll
let audioPrimed = false;

// ================= Sensor monitors =================

class AudioMonitor {
  async init() {
    if (this.ready || this.starting) return;
    this.starting = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      if (ctx.state === 'suspended') ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      this.an = an;
      this.buf = new Uint8Array(an.fftSize);
      this.prevRms = 0;
      this.blowFrames = 0;
      this.lastClap = 0;
      this.ready = true;
      this.tick();
    } catch (e) {
      console.warn('Microphone unavailable — skip button will cover blow/clap pages.', e);
    }
  }
  tick() {
    if (!this.ready) return;
    requestAnimationFrame(() => this.tick());
    this.an.getByteTimeDomainData(this.buf);
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = (this.buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.buf.length);
    LIVE.rms = rms;
    const now = performance.now();

    // Clap = sharp rising transient
    if (rms > CFG.clap && this.prevRms <= CFG.clap && now - this.lastClap > 250) {
      this.lastClap = now;
      if (this.onClap) this.onClap();
    }
    // Blow = sustained energy across many frames
    if (rms > CFG.blow) this.blowFrames++;
    else this.blowFrames = 0;
    if (this.blowFrames > CFG.blowFrames) {
      this.blowFrames = 0;
      if (this.onBlow) this.onBlow();
    }
    this.prevRms = rms;
  }
}

class MotionMonitor {
  // Request (or RE-request) permission. Safe to call again on later gestures
  // until permission is actually granted (recovers from a failed first attempt).
  async init() {
    if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
      // iOS 13+ requires an explicit permission request from a user gesture.
      try {
        const r = await DeviceMotionEvent.requestPermission();
        dbg('motion perm=' + r);
        this.granted = (r === 'granted');
      } catch (e) { dbg('motion perm err=' + e); this.granted = false; }
    } else {
      dbg('motion: no requestPermission (auto)');
      this.granted = true; // Android / desktop — no prompt needed
    }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
        await DeviceOrientationEvent.requestPermission();
      }
    } catch (e) { /* ignore */ }
    this.attach();
    dbg('motion init done granted=' + this.granted);
  }

  // Attach the sensor listener exactly once.
  attach() {
    if (this.listening) return;
    this.listening = true;
    let lastShake = 0;
    let seen = false;
    window.addEventListener('devicemotion', (e) => {
      const g = e.accelerationIncludingGravity;
      if (!g) return;
      const gx = g.x || 0, gy = g.y || 0, gz = g.z || 0;
      if (!seen) { seen = true; dbg('motion events flowing'); }
      LIVE.gx = gx; LIVE.gy = gy;
      // Rotate the device-frame gravity into SCREEN coordinates using the current
      // orientation angle, so left/right and up/down always match what the user sees
      // (portrait and landscape swap the axes automatically).
      LIVE.angle = orientationAngle();
      LIVE.otype = (screen.orientation && screen.orientation.type) || '';
      const phi = screenRotationFromPortrait();
      LIVE.phi = phi;
      const rad = phi * Math.PI / 180;
      const c = Math.cos(rad), s = Math.sin(rad);
      // iOS reports accelerationIncludingGravity with inverted sign, so negate to
      // get intuitive screen-frame values (roll: - = tilt left, + = tilt right).
      const ax = -gx, ay = -gy;
      LIVE.roll = ax * c + ay * s;
      LIVE.pitch = -ax * s + ay * c;
      // sudden change in the gravity vector => a shake
      if (this.pgx != null) {
        const d = Math.hypot(gx - this.pgx, gy - this.pgy, gz - this.pgz);
        LIVE.shake = d;
        const now = performance.now();
        if (d > CFG.shakeDelta && now - lastShake > 120) {
          lastShake = now;
          if (this.onShake) this.onShake(d);
        }
      }
      this.pgx = gx; this.pgy = gy; this.pgz = gz;
      if (this.onGravity) this.onGravity(gx, gy, gz);
    });
  }
}

const audio = new AudioMonitor();
const motion = new MotionMonitor();

// Route sensor callbacks through the current page's action
function curAction() {
  return PAGES[idx] && PAGES[idx].action;
}

// Raw reported angle (device-dependent: some iPads use landscape as 0).
function orientationAngle() {
  if (screen.orientation && typeof screen.orientation.angle === 'number') return screen.orientation.angle;
  if (typeof window.orientation === 'number') return ((window.orientation % 360) + 360) % 360;
  return 0;
}

// Rotation of the screen relative to PORTRAIT, derived from the orientation TYPE
// (portrait-referenced on every device — unlike the raw angle). The motion sensor
// axes are portrait-referenced too, so this is what the rotation math needs.
function screenRotationFromPortrait() {
  const o = (typeof screen !== 'undefined') ? screen.orientation : null;
  const t = o && o.type;
  if (t === 'portrait-primary') return 0;
  if (t === 'landscape-primary') return 90;
  if (t === 'portrait-secondary') return 180;
  if (t === 'landscape-secondary') return 270;
  if (typeof window.orientation === 'number') return ((window.orientation % 360) + 360) % 360;
  return 0;
}

motion.onShake = () => trySensor('shake');
motion.onGravity = () => {
  const a = curAction();
  if (!armed || !a) return;
  const roll = LIVE.roll, pitch = LIVE.pitch;

  if ((a.type === 'tiltLeft' || a.type === 'tiltRight' || a.type === 'upright') &&
      DEBUG && ++gDbgCount % 10 === 0) {
    dbg('roll=' + roll.toFixed(1) + ' pitch=' + pitch.toFixed(1) + ' ang=' + LIVE.angle);
  }

  // Directional and held for a few frames (so a passing shake doesn't count).
  if (a.type === 'tiltLeft') {
    if (roll < -CFG.tiltG) { if (++tiltFrames >= CFG.tiltFrames) advance(); }
    else tiltFrames = 0;
  } else if (a.type === 'tiltRight') {
    if (roll > CFG.tiltG) { if (++tiltFrames >= CFG.tiltFrames) advance(); }
    else tiltFrames = 0;
  } else if (a.type === 'upright') {
    if (Math.abs(pitch) > CFG.uprightG) advance();
  }
};
audio.onClap = () => {
  const a = curAction();
  if (!armed || !a || a.type !== 'clap') return;
  clapProgress++;
  flash();
  if (clapProgress >= (a.count || 1)) advance();
};
audio.onBlow = () => trySensor('blow');

function trySensor(type) {
  const a = curAction();
  if (armed && a && a.type === type) advance();
}

// ================= Rendering =================

function colorHex(c) {
  return c === 'r' ? 'var(--red)' : c === 'y' ? 'var(--yellow)' : c === 'b' ? 'var(--blue)' : 'var(--paper)';
}

function render(i) {
  idx = i;
  armed = false;
  tapProgress = 0;
  clapProgress = 0;
  tiltFrames = 0;
  tappedSet.clear();
  const p = PAGES[i];

  // Background
  stage.classList.toggle('dark', p.bg === 'dark');
  stage.classList.toggle('half', p.bg === 'half');
  stage.classList.toggle('blend', !!p.blend);

  // Reset entrance animation classes
  dotsEl.className = '';

  if (p.kind === 'cover') {
    renderCover();
  } else {
    coverEl.hidden = true;
    coverEl.innerHTML = '';
    renderDots(p);
    renderText(p.text);
  }

  dbg('render ' + p.id + ' (' + (p.action ? p.action.type : p.kind) + ')');

  // Arm the page after the entrance animation settles
  window.setTimeout(() => { armed = true; dbg('armed ' + p.id); }, 380);

  // Skip button
  clearTimeout(skipTimer);
  skipBtn.hidden = true;
  if (i >= 1) {
    const delay = isSensorAction(p.action) ? SKIP_DELAY_SENSOR : SKIP_DELAY_OTHER;
    skipTimer = window.setTimeout(() => { skipBtn.hidden = false; }, delay);
  }

  // "Enable Motion" button on tilt/shake/upright pages when not yet permitted
  const needsMotion = p.action && ['tiltLeft', 'tiltRight', 'upright', 'shake'].includes(p.action.type);
  enableBtn.hidden = !(needsMotion && !motion.granted);

  // Number pad for the counting quizzes
  if (p.action && p.action.type === 'countQuiz') showNumpad(p.action.max || 5);
  else numpad.hidden = true;
}

function isSensorAction(a) {
  return a && ['shake', 'tiltLeft', 'tiltRight', 'upright', 'blow', 'clap'].includes(a.type);
}

function renderText(text) {
  const parts = String(text).split('\n');
  instrEl.innerHTML = parts
    .map((line, k) => (k === 0 ? `<span>${line}</span>` : `<span class="sub">${line}</span>`))
    .join('');
}

function renderDots(p) {
  dotsEl.innerHTML = '';
  dotEls = [];
  const enter = p.enter && p.enter !== 'none' ? `enter-${p.enter}` : '';
  if (enter) dotsEl.classList.add(enter);

  p.dots.forEach((d, k) => {
    const el = document.createElement('div');
    el.className = `dot ${d.c} shape-${d.shape || 'circle'}`;
    el.style.left = d.x + '%';
    el.style.top = d.y + '%';
    // size in vmin so dots stay perfectly round on any screen shape
    el.style.width = 2 * d.r + 'vmin';
    el.style.height = 2 * d.r + 'vmin';
    el.style.setProperty('--i', k);
    el.dataset.color = d.c;
    el.dataset.index = k;
    dotsEl.appendChild(el);
    dotEls.push(el);
  });

  attachTouchHandlers(p);
}

function renderCover() {
  coverEl.hidden = false;
  coverEl.innerHTML = `
    <div class="covershapes">
      <span class="chip b shape-circle"></span>
      <span class="chip o shape-triangle"></span>
      <span class="chip g shape-square"></span>
      <span class="chip p shape-star"></span>
    </div>
    <div class="title">Boop!</div>
    <div class="nyt">a poking game for little hands</div>
    <div class="taphint">tap anywhere to start</div>`;
  dotsEl.innerHTML = '';
  instrEl.innerHTML = '';
}

// ================= Interaction wiring =================

function attachTouchHandlers(p) {
  const a = p.action;
  if (['tapDot', 'tapCount', 'tapAll', 'tapWhite'].includes(a.type)) {
    dotEls.forEach((el) => {
      el.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onDotTap(el);
      });
    });
  } else if (a.type === 'rub') {
    setupRub(p);
  } else if (a.type === 'hold') {
    setupHold(p);
  } else if (a.type === 'countQuiz') {
    // shapes just give a friendly bounce; the answer is chosen on the number pad
    dotEls.forEach((el) => {
      el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); popDot(el); });
    });
  }
}

function onDotTap(el) {
  const a = PAGES[idx].action;
  const color = el.dataset.color;
  dbg('dotTap ' + color + ' armed=' + armed + ' type=' + a.type);
  if (!armed) return;

  if (a.type === 'tapDot') {
    if (a.target != null && Number(el.dataset.index) !== a.target) { wobbleDot(el); return; }
    popDot(el);
    advance();
  } else if (a.type === 'tapWhite') {
    if (color === 'w') { popDot(el); advance(); } else { wobbleDot(el); }
  } else if (a.type === 'tapCount') {
    if (a.target != null) { if (Number(el.dataset.index) !== a.target) return; }
    else if (a.color && color !== a.color) return;
    popDot(el);
    tapProgress++;
    spawnCopy(el);              // a friend pops out on each tap
    if (tapProgress >= a.count) advance();
  } else if (a.type === 'tapAll') {
    if (a.color && color !== a.color) { wobbleDot(el); return; }
    const key = el.dataset.index;
    if (tappedSet.has(key)) return;
    tappedSet.add(key);
    el.classList.add('done');
    popDot(el);
    const targets = a.color ? dotEls.filter((d) => d.dataset.color === a.color) : dotEls;
    if (tappedSet.size >= targets.length) advance();
  }
}

function popDot(el) {
  el.classList.remove('tapped');
  // force reflow to restart animation
  void el.offsetWidth;
  el.classList.add('tapped');
}

// "not that one" wiggle for wrong taps in the find games
function wobbleDot(el) {
  el.classList.remove('wobble');
  void el.offsetWidth;
  el.classList.add('wobble');
}

// a copy of the tapped shape pops out at a random spot (for the counting games)
function spawnCopy(src) {
  const el = document.createElement('div');
  el.className = src.className.replace(/\btapped\b/, '').trim() + ' spawned';
  el.style.width = src.style.width;
  el.style.height = src.style.height;
  el.style.left = (14 + Math.random() * 72) + '%';
  el.style.top = (16 + Math.random() * 52) + '%';
  dotsEl.appendChild(el);
}

// press-and-hold a shape until it grows, then advance
function setupHold(p) {
  const target = dotEls[p.action.target || 0];
  const ms = p.action.ms || 900;
  target.classList.add('holdtarget');
  target.style.setProperty('--holdms', ms + 'ms');
  let timer = null;
  const start = (ev) => {
    if (!armed) return;
    ev.preventDefault();
    ev.stopPropagation();
    target.classList.add('holding');
    timer = window.setTimeout(() => { target.classList.remove('holdtarget'); advance(); }, ms);
  };
  const cancel = () => {
    target.classList.remove('holding');
    if (timer) { clearTimeout(timer); timer = null; }
  };
  target.addEventListener('pointerdown', start);
  target.addEventListener('pointerup', cancel);
  target.addEventListener('pointercancel', cancel);
  target.addEventListener('pointerleave', cancel);
}

function setupRub(p) {
  const target = dotEls[p.action.target];
  target.classList.add('rubtarget');
  let rubbing = false;
  let travelled = 0;
  let lastX = 0, lastY = 0;

  const start = (ev) => {
    if (!armed) return;
    rubbing = true; travelled = 0;
    lastX = ev.clientX; lastY = ev.clientY;
  };
  const move = (ev) => {
    if (!rubbing) return;
    travelled += Math.hypot(ev.clientX - lastX, ev.clientY - lastY);
    lastX = ev.clientX; lastY = ev.clientY;
    if (travelled > CFG.rub) {
      rubbing = false;
      target.classList.remove('rubtarget');
      advance();
    }
  };
  const end = () => { rubbing = false; };

  target.addEventListener('pointerdown', start);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
}

// ================= Navigation =================

function advance() {
  if (!armed) return;
  armed = false;
  dbg('advance from ' + PAGES[idx].id);
  const p = PAGES[idx];
  let next = p.action && p.action.restart ? 0 : idx + 1;
  if (next >= PAGES.length) next = 0;
  transitionTo(next);
}

function goTo(i) {
  armed = false;
  let n = i;
  if (n < 0) n = 0;
  if (n >= PAGES.length) n = PAGES.length - 1;
  transitionTo(n);
}

function transitionTo(i) {
  stage.classList.add('fade');
  window.setTimeout(() => {
    render(i);
    // next frame, fade back in
    requestAnimationFrame(() => stage.classList.remove('fade'));
  }, 260);
}

function flash() {
  stage.animate(
    [{ filter: 'brightness(1)' }, { filter: 'brightness(1.15)' }, { filter: 'brightness(1)' }],
    { duration: 200 }
  );
}

// ================= First-gesture permission priming =================

function primePermissions() {
  // Must be called from within a user gesture (iOS requirement).
  // Retry motion each gesture until granted; prime the mic once.
  if (!motion.granted) motion.init();
  if (!audioPrimed) { audioPrimed = true; audio.init(); }
}

// The cover / first tap primes sensors, then advances.
stage.addEventListener('pointerdown', (ev) => {
  dbg('stage down kind=' + PAGES[idx].kind + ' armed=' + armed);
  primePermissions();
  if (PAGES[idx].kind === 'cover') {
    // advance off the cover regardless of where they tap
    if (!armed) return;
    advance();
  }
});

// ================= Controls =================

skipBtn.addEventListener('click', () => { armed = true; advance(); });

enableBtn.addEventListener('click', async () => {
  await motion.init();          // fresh user gesture -> triggers the iOS prompt
  if (motion.granted) enableBtn.hidden = true;
});

// ---- Number pad for the counting quizzes ----
const numpad = document.createElement('div');
numpad.id = 'numpad';
numpad.hidden = true;
document.body.appendChild(numpad);

function showNumpad(max) {
  numpad.innerHTML = '';
  for (let n = 1; n <= max; n++) {
    const b = document.createElement('button');
    b.className = 'numbtn';
    b.textContent = n;
    b.dataset.n = n;
    numpad.appendChild(b);
  }
  numpad.hidden = false;
}

numpad.addEventListener('click', (ev) => {
  const n = Number(ev.target.dataset.n);
  if (!n) return;
  const a = curAction();
  if (!armed || !a || a.type !== 'countQuiz') return;
  if (n === a.answer) {
    ev.target.classList.add('right');
    flash();
    advance();
  } else {
    ev.target.classList.remove('wrongbtn');
    void ev.target.offsetWidth;
    ev.target.classList.add('wrongbtn');
  }
});

menuToggle.addEventListener('click', () => { menuBar.hidden = !menuBar.hidden; });
menuBar.addEventListener('click', (ev) => {
  const act = ev.target.dataset.act;
  if (!act) return;
  menuBar.hidden = true;
  if (act === 'prev') goTo(idx - 1);
  else if (act === 'next') goTo(idx + 1);
  else if (act === 'restart') goTo(0);
  else if (act === 'skip') { armed = true; advance(); }
  else if (act === 'tune') toggleSettings(true);
});

// ---- Live sensitivity tuning panel ----
const TUNABLES = [
  { key: 'blow', label: 'Blow', min: 0.01, max: 0.15, step: 0.005, fmt: (v) => v.toFixed(3), live: () => LIVE.rms },
  { key: 'clap', label: 'Clap', min: 0.05, max: 0.40, step: 0.01, fmt: (v) => v.toFixed(2), live: () => LIVE.rms },
  { key: 'shakeDelta', label: 'Shake', min: 5, max: 30, step: 1, fmt: (v) => v.toFixed(0), live: () => LIVE.shake },
  { key: 'tiltG', label: 'Tilt (− left / + right)', min: 1, max: 9, step: 0.5, fmt: (v) => v.toFixed(1), live: () => LIVE.roll },
  { key: 'uprightG', label: 'Stand up', min: 3, max: 9, step: 0.5, fmt: (v) => v.toFixed(1), live: () => LIVE.pitch },
];
let settingsEl = null;

function buildSettings() {
  settingsEl = document.createElement('div');
  settingsEl.id = 'settings';
  settingsEl.hidden = true;
  let html = '<h3>Sensitivity</h3>';
  TUNABLES.forEach((t) => {
    html += '<div class="row" data-k="' + t.key + '">' +
      '<div class="lbl"><span>' + t.label + '</span><span class="live">–</span></div>' +
      '<input type="range" min="' + t.min + '" max="' + t.max + '" step="' + t.step + '" value="' + CFG[t.key] + '" />' +
      '<div class="val">set: ' + t.fmt(CFG[t.key]) + '</div></div>';
  });
  html += '<div class="tip">Watch the green number while you blow / shake / tilt, then set the slider just below the level you reach. For tilt, the value goes negative when leaning left and positive leaning right.</div>';
  html += '<div class="tip" id="orient">orientation: –</div>';
  html += '<div class="btns"><button data-a="reset">Reset</button><button data-a="close">Done</button></div>';
  settingsEl.innerHTML = html;
  document.body.appendChild(settingsEl);

  settingsEl.addEventListener('input', (ev) => {
    const row = ev.target.closest('.row');
    if (!row) return;
    const t = TUNABLES.find((x) => x.key === row.dataset.k);
    CFG[t.key] = parseFloat(ev.target.value);
    saveCfg();
    row.querySelector('.val').textContent = 'set: ' + t.fmt(CFG[t.key]);
  });
  settingsEl.addEventListener('click', (ev) => {
    const a = ev.target.dataset.a;
    if (a === 'close') toggleSettings(false);
    else if (a === 'reset') { Object.assign(CFG, DEFAULTS); saveCfg(); refreshSettings(); }
  });
}

function refreshSettings() {
  TUNABLES.forEach((t) => {
    const row = settingsEl.querySelector('.row[data-k="' + t.key + '"]');
    row.querySelector('input').value = CFG[t.key];
    row.querySelector('.val').textContent = 'set: ' + t.fmt(CFG[t.key]);
  });
}

function toggleSettings(show) {
  if (!settingsEl) buildSettings();
  settingsEl.hidden = !show;
  if (show) tickSettings();
}

function tickSettings() {
  if (!settingsEl || settingsEl.hidden) return;
  TUNABLES.forEach((t) => {
    settingsEl.querySelector('.row[data-k="' + t.key + '"] .live').textContent = t.fmt(t.live());
  });
  const o = settingsEl.querySelector('#orient');
  if (o) o.textContent = (LIVE.otype || '?') + ' · raw ' + LIVE.angle + '° · φ ' + LIVE.phi +
    '° · roll ' + LIVE.roll.toFixed(1) + ' · pitch ' + LIVE.pitch.toFixed(1);
  requestAnimationFrame(tickSettings);
}

// Prevent Safari double-tap-to-zoom (which triggers on quick multi-taps) and
// pinch-zoom. Taps are handled on pointerdown, so cancelling these is harmless.
let _lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - _lastTouchEnd <= 350) e.preventDefault();
  _lastTouchEnd = now;
}, { passive: false });
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) =>
  document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));

// Keyboard for desktop testing
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') goTo(idx + 1);
  else if (e.key === 'ArrowLeft') goTo(idx - 1);
});

// ================= Boot =================

// Service worker: caches the app so the installed web app keeps working even if
// the GitHub Pages site is taken offline (e.g. repo made private). It fetches
// fresh when the site is reachable and falls back to the cache otherwise.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Persistent version stamp (small, bottom-left) so you can confirm the latest deploy loaded.
const verEl = document.createElement('div');
verEl.id = 'version';
verEl.textContent = VERSION;
document.body.appendChild(verEl);

render(0);
window.setTimeout(() => { armed = true; }, 100); // arm the cover
