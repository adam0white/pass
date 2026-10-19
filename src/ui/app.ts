/**
 * The Pass UI: plain DOM and inline SVG over the pure sim. The UI reads state and queues inputs; it never
 * changes the sim directly. Real time drives sim minutes (continuous, with slowdown while a cook's sheet is open).
 */
import { FRAMEWORK_VERSION, readPerson } from '@adam0white/human-framework';
import { COOKS, type CookId, HOME_STATION, NAMES } from '../sim/cooks.ts';
import {
  BANK_TARGET,
  closeAt,
  cookOf,
  type Export,
  exportRun,
  fingerprint,
  forecastLine,
  type GameState,
  type Hint,
  hints,
  type Input,
  NIGHTS,
  newGame,
  openAt,
  PLANS,
  personOf,
  queueInput,
  replay,
  stationOf,
  step,
  type Verb,
} from '../sim/kitchen.ts';

const SAVE = 'pass-save-v1';
const SPEEDS = [0.6, 2, 5] as const;
const SPEED_NAMES = ['slow', 'steady', 'fast'];
const SLOWDOWN = 0.6;

interface Save {
  seed: number;
  inputs: Input[];
  minute: number;
}

const app = document.getElementById('app') as HTMLElement;
let s: GameState | null = null;
let speed = 1;
let selected: CookId | null = null;
let cachedHints: { at: number; id: CookId; list: Hint[]; forecast: string | null } | null = null;
let raf = 0;
let last = 0;
let carry = 0;
let shownSaid = 0;
const bubbles: Record<string, { text: string; until: number }> = {};
let wake: { release(): Promise<void> } | null = null;
const seenHint = { tap: false, job: false };

// ---------- save ----------

function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE);
    return raw ? (JSON.parse(raw) as Save) : null;
  } catch {
    return null;
  }
}
function writeSave() {
  if (!s) return;
  try {
    localStorage.setItem(SAVE, JSON.stringify({ seed: s.seed, inputs: s.inputs, minute: s.minute }));
  } catch {}
}
function clearSave() {
  try {
    localStorage.removeItem(SAVE);
  } catch {}
}

// ---------- helpers ----------

const esc = (x: string) =>
  x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const lira = (n: number) => `₺${n.toLocaleString('en-GB')}`;
const clock = (m: number) => {
  const d = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
};
/** A hand-drawn line: a few jittered points between two ends, deterministic per key. */
function wob(x1: number, y1: number, x2: number, y2: number, key: number, amp = 1.4): string {
  let d = `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i === n ? 0 : Math.sin(key * 12.9898 + i * 78.233) * amp;
    d += ` L${(x1 + (x2 - x1) * t + j * 0.4).toFixed(1)} ${(y1 + (y2 - y1) * t + j).toFixed(1)}`;
  }
  return d;
}
const footer = () =>
  `<div class="footer">other notebooks: <a href="https://neighbours.adamwhite.work">neighbours</a><a href="https://rope.adamwhite.work">the rope</a><a href="https://repair.adamwhite.work">repair</a><a href="https://human.adamwhite.work">human framework</a><br/>People by the Human Framework ${FRAMEWORK_VERSION}. Everything they say comes from it.</div>`;
const markLink = '<a class="mark" href="https://human.adamwhite.work">◇ human framework</a>';

// ---------- title ----------

export function start() {
  if ('serviceWorker' in navigator && location.hostname !== 'localhost')
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  title();
}

function title() {
  cancelAnimationFrame(raf);
  const save = readSave();
  app.innerHTML = `<div class="page">
    ${markLink}
    <h1>The Pass</h1>
    <p class="soft">a kitchen, six dinner services</p>
    <p>${esc(PLANS[0]?.intro[0] ?? '')}</p>
    <p>${esc(PLANS[0]?.intro[1] ?? '')}</p>
    <div class="actions">
      ${save ? '<button class="primary" id="cont">Back to the kitchen</button>' : ''}
      <button class="${save ? '' : 'primary'}" id="new">${save ? 'Start the week again' : 'Open the doors'}</button>
      <button id="load">Load a playtest run</button>
      <input type="file" id="file" accept="application/json" hidden />
    </div>
    <p class="soft" style="font-size:14px">Tap a cook, then a job. Hold the job to insist. They can say no.</p>
    ${footer()}
  </div>`;
  document.getElementById('cont')?.addEventListener('click', () => {
    if (!save) return;
    s = replay(save.seed, save.inputs, save.minute);
    enter();
  });
  document.getElementById('new')?.addEventListener('click', () => {
    clearSave();
    s = newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    enter();
  });
  const file = document.getElementById('file') as HTMLInputElement;
  document.getElementById('load')?.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const ex = JSON.parse(await f.text()) as Export & { until?: number };
      const r = replay(ex.seed, ex.inputs, ex.state?.minute);
      const same = ex.state ? fingerprint(r) === fingerprint(ex.state) : true;
      s = r;
      writeSave();
      alert(
        same
          ? 'Replayed the run: it matches the exported state.'
          : 'Replayed the run, but it differs from the export.',
      );
      enter();
    } catch {
      alert('That file is not a run from The Pass.');
    }
  });
}

function enter() {
  if (!s) return;
  shownSaid = s.said.length;
  if (s.phase === 'service') service();
  else evening();
}

// ---------- service ----------

function service() {
  if (!s) return;
  selected = null;
  cachedHints = null;
  shownSaid = Math.max(0, s.said.length - 3);
  requestWake();
  app.innerHTML = `<div class="service">
    <div class="top">${markLink}<span class="grow"></span><span id="night"></span><span class="clock" id="clock"></span></div>
    <div class="top" style="min-height:36px;padding-top:0"><span class="money" id="till"></span><span class="grow"></span><span class="speed" id="speed"></span></div>
    <div class="rail" id="rail"></div>
    <div class="scene" id="scene"></div>
    <div class="sheet" id="sheet"></div>
  </div>`;
  const sp = document.getElementById('speed') as HTMLElement;
  sp.innerHTML = SPEED_NAMES.map(
    (n, i) => `<button data-i="${i}" aria-label="${n}">${['▸', '▸▸', '▸▸▸'][i]}</button>`,
  ).join(' ');
  sp.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    speed = Number(b.dataset.i);
    drawTop();
  });
  document.getElementById('scene')?.addEventListener('click', (e) => {
    const g = (e.target as Element).closest('[data-cook]');
    const id = g?.getAttribute('data-cook') as CookId | null;
    if (id) select(id);
  });
  drawAll();
  last = performance.now();
  carry = 0;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

function frame(t: number) {
  if (!s) return;
  const dt = Math.min(0.25, (t - last) / 1000);
  last = t;
  if (s.phase === 'service') {
    const rate =
      selected || s.call === 'asking' ? Math.min(SPEEDS[speed] ?? 2, SLOWDOWN) : (SPEEDS[speed] ?? 2);
    carry += dt * rate;
    let stepped = false;
    while (carry >= 1 && s.phase === 'service') {
      carry -= 1;
      step(s);
      stepped = true;
    }
    if (stepped) {
      collectSaid();
      drawAll();
      if (s.minute % 10 === 0) writeSave();
    } else drawBubbles();
  }
  if (s.phase !== 'service') {
    writeSave();
    releaseWake();
    evening();
    return;
  }
  raf = requestAnimationFrame(frame);
}

function collectSaid() {
  if (!s) return;
  for (const x of s.said.slice(shownSaid)) {
    if (x.who !== 'narrator') bubbles[x.who] = { text: x.text, until: performance.now() + 5200 };
  }
}

function drawAll() {
  drawTop();
  drawRail();
  drawScene();
  drawSheet();
}

function drawTop() {
  if (!s) return;
  const plan = PLANS[s.night - 1];
  (document.getElementById('night') as HTMLElement).textContent = plan?.title ?? '';
  (document.getElementById('clock') as HTMLElement).textContent = clock(s.minute);
  (document.getElementById('till') as HTMLElement).innerHTML =
    `till <b>${lira(s.till)}</b> <span class="soft">/ ${lira(BANK_TARGET)}</span>`;
  document.querySelectorAll<HTMLButtonElement>('#speed button').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.i) === speed);
  });
}

function drawRail() {
  if (!s) return;
  const open = s.tickets.filter((t) => t.status === 'open');
  const rail = document.getElementById('rail') as HTMLElement;
  if (open.length === 0) {
    rail.innerHTML = `<span class="soft hand" style="align-self:center">${s.minute < openAt(s.night) + 2 ? 'Doors open…' : 'The rail is clear.'}</span>`;
    return;
  }
  rail.innerHTML = open
    .map((t) => {
      const wait = s ? s.minute - t.at : 0;
      const dish = `${'▲'.repeat(t.doneGrill)}${'△'.repeat(t.grill - t.doneGrill)} ${'●'.repeat(t.doneCold)}${'○'.repeat(t.cold - t.doneCold)}`;
      return `<div class="slip ${wait > 24 ? 'late' : ''}" style="opacity:${Math.max(0.55, 1 - wait / 80)}"><div class="t">T${t.table}</div><div class="d">${dish}</div><div class="soft" style="font-size:11px">${wait < 10 ? 'new' : wait < 24 ? 'waiting' : 'restless'}</div></div>`;
    })
    .join('');
}

const PLACES: Record<string, { x: number; y: number; label: string }> = {
  grill: { x: 62, y: 128, label: 'grill' },
  cold: { x: 180, y: 128, label: 'cold' },
  dish: { x: 298, y: 128, label: 'dish' },
  yard: { x: 318, y: 36, label: 'back door' },
  table: { x: 46, y: 36, label: 'staff table' },
  store: { x: 180, y: 36, label: 'storeroom' },
  idle: { x: 130, y: 200, label: '' },
};

function placeOf(id: CookId): string {
  if (!s) return 'idle';
  const a = personOf(s, id).activity;
  if (!a) return 'idle';
  if (a.affordanceId === 'grill' || a.affordanceId === 'cold' || a.affordanceId === 'dish')
    return a.affordanceId;
  if (a.affordanceId === 'break' || a.affordanceId === 'smoke') return 'yard';
  if (a.affordanceId === 'eat') return 'table';
  if (a.affordanceId === 'pray') return 'store';
  if (a.affordanceId === 'skim') return 'yard';
  return 'idle';
}

function drawScene() {
  if (!s) return;
  const el = document.getElementById('scene') as HTMLElement;
  const n = s.night;
  const parts: string[] = [];
  const ink = 'var(--ink)';
  const soft = 'var(--ink-soft)';
  // Walls and fixtures.
  parts.push(`<path d="${wob(8, 62, 352, 62, 1, 0.8)}" stroke="${soft}" stroke-width="1.5" fill="none"/>`);
  parts.push(
    `<path d="${wob(300, 62, 300, 14, 2, 0.6)} ${wob(336, 62, 336, 14, 3, 0.6)}" stroke="${soft}" stroke-width="1.5" fill="none"/>`,
  );
  parts.push(`<text x="318" y="76" text-anchor="middle" font-size="11" fill="${soft}">back door</text>`);
  parts.push(
    `<path d="${wob(22, 44, 72, 44, 4)}" stroke="${soft}" stroke-width="1.5" fill="none"/><text x="46" y="76" text-anchor="middle" font-size="11" fill="${soft}">staff table</text>`,
  );
  parts.push(
    `<path d="${wob(162, 62, 162, 18, 5, 0.6)} ${wob(198, 62, 198, 18, 6, 0.6)}" stroke="${soft}" stroke-width="1.5" fill="none"/><text x="180" y="76" text-anchor="middle" font-size="11" fill="${soft}">storeroom</text>`,
  );
  // Stations.
  const st = (x: number, label: string, key: number, on: boolean, heat: number) => {
    parts.push(
      `<path d="${wob(x - 46, 150, x + 46, 150, key)} ${wob(x + 46, 150, x + 46, 168, key + 1, 0.6)} ${wob(x + 46, 168, x - 46, 168, key + 2)} ${wob(x - 46, 168, x - 46, 150, key + 3, 0.6)}" stroke="${on ? ink : soft}" stroke-width="1.5" fill="var(--paper-2)"/>`,
    );
    parts.push(
      `<text x="${x}" y="184" text-anchor="middle" font-size="12" fill="${on ? ink : soft}">${label}</text>`,
    );
    for (let i = 0; i < heat; i++)
      parts.push(
        `<path d="M${x - 30 + i * 9} 148 q3 -7 0 -12" stroke="var(--rope)" stroke-width="1.3" fill="none" opacity="0.8"/>`,
      );
  };
  const backlog = (k: 'grill' | 'cold') =>
    s
      ? s.tickets
          .filter((t) => t.status === 'open')
          .reduce((a, t) => a + (k === 'grill' ? t.grill - t.doneGrill : t.cold - t.doneCold), 0)
      : 0;
  st(62, 'grill', 10, true, Math.min(7, backlog('grill')));
  st(180, 'cold', 20, true, 0);
  // Cold backlog as small hatch marks.
  for (let i = 0; i < Math.min(8, backlog('cold')); i++)
    parts.push(`<path d="M${150 + i * 8} 146 l4 -8" stroke="var(--sky)" stroke-width="1.3"/>`);
  if (n >= 2) {
    st(298, 'dish', 30, true, 0);
    for (let i = 0; i < Math.min(12, s.plates.pile); i++)
      parts.push(
        `<ellipse cx="${280 + (i % 3) * 14}" cy="${144 - Math.floor(i / 3) * 4}" rx="7" ry="2" stroke="${soft}" stroke-width="1.2" fill="var(--paper)"/>`,
      );
  }
  // The pass and its clean plates.
  parts.push(`<path d="${wob(20, 232, 340, 232, 40)}" stroke="${ink}" stroke-width="2" fill="none"/>`);
  parts.push(`<text x="24" y="250" font-size="12" fill="${soft}">the pass</text>`);
  for (let i = 0; i < Math.min(14, s.plates.clean); i++)
    parts.push(
      `<ellipse cx="96" cy="${228 - i * 3}" rx="14" ry="3" stroke="${ink}" stroke-width="1.1" fill="var(--paper)"/>`,
    );
  if (s.plates.clean === 0)
    parts.push(
      `<text x="96" y="222" text-anchor="middle" class="hand" font-size="16" fill="var(--rope)">no plates</text>`,
    );
  // The jar.
  if (n >= 2) {
    const jx = s.jarPlace === 'pass' ? 250 : 270;
    const jy = s.jarPlace === 'pass' ? 226 : 52;
    const coins = Math.min(9, Math.round(s.jar / 12));
    parts.push(
      `<path d="M${jx - 8} ${jy - 18} L${jx - 9} ${jy} L${jx + 9} ${jy} L${jx + 8} ${jy - 18}" stroke="${ink}" stroke-width="1.3" fill="none"/>`,
    );
    for (let i = 0; i < coins; i++)
      parts.push(
        `<circle cx="${jx - 5 + (i % 3) * 5}" cy="${jy - 3 - Math.floor(i / 3) * 4}" r="2" fill="${soft}"/>`,
      );
    parts.push(
      `<text x="${jx}" y="${jy + 12}" text-anchor="middle" font-size="10" fill="${soft}">tips</text>`,
    );
  }
  // Cooks.
  const at: Record<string, number> = {};
  for (const id of COOKS) {
    const c = cookOf(s, id);
    if (!c.here) continue;
    if (c.gone) {
      parts.push(
        `<text x="${330}" y="${100 + COOKS.indexOf(id) * 14}" text-anchor="end" font-size="11" fill="${soft}">${NAMES[id]}: gone home</text>`,
      );
      continue;
    }
    const pl = placeOf(id);
    const base = PLACES[pl] ?? (PLACES.idle as { x: number; y: number });
    const k = at[pl] ?? 0;
    at[pl] = k + 1;
    const x = pl === 'idle' ? 150 + COOKS.indexOf(id) * 64 : base.x + 30 * k;
    const y = pl === 'grill' || pl === 'cold' || pl === 'dish' ? 108 : pl === 'idle' ? 196 : 40;
    parts.push(figure(id, x, y));
  }
  el.innerHTML = `<svg viewBox="0 0 360 262" preserveAspectRatio="xMidYMid meet" role="img" aria-label="The kitchen">${parts.join('')}<g id="bub"></g></svg>`;
  drawBubbles();
}

function figure(id: CookId, x: number, y: number): string {
  if (!s) return '';
  const p = personOf(s, id);
  const body = readPerson(p).body;
  const tired = body.perceived.fatigue;
  const lean = Math.min(16, tired * 18) * (id === 'dilek' ? -1 : 1);
  const a = p.activity;
  const protest = !!a?.protest;
  const sel = selected === id;
  const ink = sel ? 'var(--rope)' : 'var(--ink)';
  const rad = (lean * Math.PI) / 180;
  const hx = x + Math.sin(rad) * 22;
  const hy = y - 30 + (tired > 0.7 ? 4 : 0);
  const stride = 9 - Math.min(5, tired * 6);
  const smoke =
    a?.affordanceId === 'smoke'
      ? `<path d="M${hx + 10} ${hy - 4} q4 -6 0 -10 q-4 -5 1 -9" stroke="var(--ink-soft)" stroke-width="1" fill="none"/>`
      : '';
  const arms = protest
    ? `<path d="M${x - 8} ${y - 16} L${x + 8} ${y - 12} M${x + 8} ${y - 16} L${x - 8} ${y - 12}" stroke="${ink}" stroke-width="1.5"/>`
    : `<path d="M${x} ${y - 18} L${x - 10} ${y - 8} M${x} ${y - 18} L${x + 10} ${y - 9}" stroke="${ink}" stroke-width="1.5"/>`;
  return `<g class="cook" data-cook="${id}">
    <rect x="${x - 24}" y="${y - 50}" width="48" height="76" fill="transparent"/>
    <circle cx="${hx}" cy="${hy - 8}" r="8" stroke="${ink}" stroke-width="1.5" fill="var(--paper)"/>
    <path d="M${hx} ${hy} L${x} ${y}" stroke="${ink}" stroke-width="1.6"/>
    ${arms}
    <path d="M${x} ${y} L${x - stride / 2} ${y + 16} M${x} ${y} L${x + stride / 2} ${y + 16}" stroke="${ink}" stroke-width="1.5"/>
    ${smoke}
    <text x="${x}" y="${y + 30}" text-anchor="middle" font-size="12" fill="${ink}" ${sel ? 'font-weight="600"' : ''}>${NAMES[id]}</text>
  </g>`;
}

function drawBubbles() {
  const g = document.getElementById('bub');
  if (!g || !s) return;
  const now = performance.now();
  const out: string[] = [];
  for (const id of COOKS) {
    const b = bubbles[id];
    if (!b || b.until < now) continue;
    const c = cookOf(s, id);
    if (!c.here) continue;
    const pl = placeOf(id);
    const base = PLACES[pl] ?? (PLACES.idle as { x: number; y: number });
    const y = pl === 'grill' || pl === 'cold' || pl === 'dish' ? 52 : pl === 'idle' ? 140 : 96;
    const text = b.text.length > 34 ? `${b.text.slice(0, 33)}…` : b.text;
    const x = Math.max(70, Math.min(290, base.x));
    out.push(
      `<text x="${x}" y="${y}" text-anchor="middle" font-family="Caveat, cursive" font-size="17" fill="var(--ink)" stroke="var(--paper)" stroke-width="4" paint-order="stroke">${esc(text)}</text>`,
    );
  }
  g.innerHTML = out.join('');
}

function select(id: CookId | null) {
  if (!s) return;
  if (id && (!cookOf(s, id).here || cookOf(s, id).gone)) return;
  selected = selected === id ? null : id;
  cachedHints = null;
  seenHint.tap = true;
  drawScene();
  drawSheet();
}

function hintsFor(id: CookId) {
  if (!s) return null;
  if (!cachedHints || cachedHints.id !== id || s.minute - cachedHints.at >= 3)
    cachedHints = { at: s.minute, id, list: hints(s, id), forecast: forecastLine(s, id) };
  return cachedHints;
}

const VERB_LABEL: Record<Verb, string> = {
  grill: 'Grill',
  cold: 'Cold side',
  dish: 'Dish pit',
  break: 'Take ten',
  eat: 'Eat',
  home: 'Go home',
};

let sheetKey = '';
function drawSheet() {
  if (!s) return;
  const el = document.getElementById('sheet') as HTMLElement;
  if (s.call === 'asking') {
    const key = 'call';
    if (sheetKey === key) return;
    sheetKey = key;
    el.innerHTML = `<div class="card ink-in"><div class="hand">Dilek: “That was my neighbour. Mum’s had a fall. Chef, can I go?”</div>
      <div class="row"><button class="primary" id="go">Go. Now.</button><button id="stay">Can you stay till nine?</button></div></div>`;
    document.getElementById('go')?.addEventListener('click', () => answerCall('go'));
    document.getElementById('stay')?.addEventListener('click', () => answerCall('stay'));
    return;
  }
  if (!selected) {
    const lines = s.said.slice(-3).reverse();
    const key = `j${s.said.length}${seenHint.tap}`;
    if (sheetKey === key) return;
    sheetKey = key;
    const tip =
      s.night === 1 && !seenHint.tap
        ? '<div class="hint">Tap Selim or Dilek in the kitchen.</div>'
        : s.night === 2 && s.minute < openAt(2) + 40
          ? '<div class="hint">Plates come back dirty. Someone has to wash them.</div>'
          : '';
    el.innerHTML = `${tip}<div class="journal">${lines
      .map((x) =>
        x.who === 'narrator'
          ? `<div>${esc(x.text)}</div>`
          : `<div class="hand">${NAMES[x.who as CookId]}: “${esc(x.text)}”</div>`,
      )
      .join('')}</div>`;
    return;
  }
  const h = hintsFor(selected);
  if (!h) return;
  const c = cookOf(s, selected);
  const doing = personOf(s, selected).activity?.affordance.label ?? 'between jobs';
  const key = `c${selected}${h.at}${c.pending ? 1 : 0}${doing}`;
  if (sheetKey === key) return;
  sheetKey = key;
  const verbs = h.list;
  el.innerHTML = `<div class="who"><b>${NAMES[selected]}</b><span class="soft" style="font-size:14px">${esc(doing)}</span><button class="x" id="close" aria-label="close">×</button></div>
    ${h.forecast ? `<div class="hand">“${esc(h.forecast)}”</div>` : ''}
    <div class="verbs">${verbs
      .map(
        (v) =>
          `<button data-v="${v.verb}" ${c.pending ? 'disabled' : ''}>${VERB_LABEL[v.verb]}${v.verb === HOME_STATION[selected as CookId] ? ' ·' : ''}<span class="h ${v.verdict === 'refused' ? 'no' : ''}">${esc(v.short)}</span><span class="fill"></span></button>`,
      )
      .join('')}</div>
    <div class="hint">${seenHint.job ? (c.pending ? 'They heard you.' : 'Hold a job to insist.') : 'Tap a job to ask. Hold it to insist.'}</div>`;
  document.getElementById('close')?.addEventListener('click', () => select(null));
  for (const b of el.querySelectorAll<HTMLButtonElement>('.verbs button')) bindHold(b);
}

function bindHold(b: HTMLButtonElement) {
  let timer = 0;
  let fired = false;
  const verb = b.dataset.v as Verb;
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('pointerdown', () => {
    fired = false;
    b.classList.add('holding');
    timer = window.setTimeout(() => {
      fired = true;
      b.classList.remove('holding');
      ask(verb, true);
    }, 450);
  });
  const cancel = () => {
    clearTimeout(timer);
    b.classList.remove('holding');
  };
  b.addEventListener('pointerleave', cancel);
  b.addEventListener('pointercancel', cancel);
  b.addEventListener('pointerup', () => {
    cancel();
    if (!fired) ask(verb, false);
  });
}

function ask(verb: Verb, insist: boolean) {
  if (!s || !selected) return;
  queueInput(s, { kind: 'ask', cook: selected, verb, insist });
  seenHint.job = true;
  writeSave();
  sheetKey = '';
  selected = null;
  drawScene();
  drawSheet();
}

function answerCall(choice: 'go' | 'stay') {
  if (!s) return;
  queueInput(s, { kind: 'call', choice });
  writeSave();
  sheetKey = '';
  drawSheet();
}

// ---------- evening ----------

function evening() {
  if (!s) return;
  cancelAnimationFrame(raf);
  sheetKey = '';
  const r = s.reports.at(-1);
  if (!r) return;
  const plan = PLANS[r.night - 1];
  const next = PLANS[r.night];
  const total = r.served + r.walked;
  const plates = Array.from({ length: total }, (_, i) =>
    i < r.served
      ? '<svg width="16" height="16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>'
      : '<svg width="16" height="16"><path d="M3 3 L13 13 M13 3 L3 13" stroke="var(--rope)" stroke-width="1.4"/></svg>',
  ).join('');
  const prevSkim = s.reports.at(-2)?.skimmed ?? 0;
  const lightJar = r.skimmed > prevSkim;
  const crit =
    r.critic === 'pleased'
      ? '<p>The one with the notebook smiled at the door. Saturday’s paper will be kind.</p>'
      : r.critic === 'cold'
        ? '<p>The food writer ate and left without a word.</p>'
        : r.critic === 'walked'
          ? '<p>One of the tables that walked out had a notebook.</p>'
          : '';
  const reviews = r.reviews
    .map((x) => {
      const lapse = x.line && !x.line.startsWith('Today I kept');
      return `<div class="cookline ink-in"><b>${NAMES[x.id]}</b>${lapse ? `<div class="hand">“${esc(x.line)}”</div>` : ''}${x.aboutYou ? `<div class="hand">“${esc(x.aboutYou)}”</div>` : ''}</div>`;
    })
    .join('');
  const ended = s.phase === 'end';
  const jarChoice =
    !ended && r.night === 3
      ? `<div class="card"><div>${lightJar ? 'The jar was light again tonight. Nevin used to say nothing about it.' : 'The jar sits by the back door, out of my sight.'}</div>
        <div class="row" style="flex-direction:column"><button data-jar="talk">Sit with Rafi on the back step</button><button data-jar="move">Move the jar to the pass</button><button data-jar="leave">Leave it</button></div></div>`
      : '';
  app.innerHTML = `<div class="page">
    ${markLink}
    <h2>${esc(plan?.title ?? '')}, after close</h2>
    <div class="plates" aria-label="${r.served} tables served, ${r.walked} walked out">${plates}</div>
    <p>${r.served} of ${total} tables fed. ${lira(r.takings)} in the till tonight; ${lira(s.till)} of ${lira(BANK_TARGET)} so far.</p>
    ${lightJar && r.night !== 3 ? '<p>The tip jar was lighter than it should have been.</p>' : ''}
    ${crit}
    ${reviews}
    ${jarChoice}
    <div class="actions">
      ${ended ? '<button class="primary" id="end">Saturday, after the bank</button>' : `<button class="primary" id="open" ${r.night === 3 ? 'disabled' : ''}>Open on ${esc(next?.title ?? '')}</button>`}
      ${!ended && next ? `<p class="soft" style="font-size:15px">${esc(next.intro[0] ?? '')}</p>` : ''}
      <button id="export">Save a playtest file</button>
    </div>
    ${footer()}
  </div>`;
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-jar]'))
    b.addEventListener('click', () => {
      if (!s) return;
      queueInput(s, { kind: 'jar', choice: b.dataset.jar as 'move' | 'talk' | 'leave' });
      writeSave();
      app.querySelectorAll<HTMLButtonElement>('[data-jar]').forEach((x) => {
        x.disabled = true;
      });
      b.classList.add('primary');
      (document.getElementById('open') as HTMLButtonElement).disabled = false;
    });
  document.getElementById('open')?.addEventListener('click', () => {
    if (!s) return;
    queueInput(s, { kind: 'open' });
    writeSave();
    service();
  });
  document.getElementById('end')?.addEventListener('click', ending);
  document.getElementById('export')?.addEventListener('click', download);
  window.scrollTo(0, 0);
}

function ending() {
  if (!s) return;
  const met = s.till >= BANK_TARGET;
  const lines = s.reports.flatMap((r) => r.reviews.map((x) => ({ id: x.id, t: x.aboutYou, n: r.night })));
  const lastLines = COOKS.map((id) => lines.filter((l) => l.id === id && l.t).at(-1)).filter(Boolean) as {
    id: CookId;
    t: string;
  }[];
  const trust = COOKS.map((id) => personOf(s as GameState, id).will.voices[0]?.trust ?? 0.5);
  const warm = trust.filter((t) => t > 0.5).length;
  app.innerHTML = `<div class="page">
    ${markLink}
    <h2>${met ? 'The bank got its money.' : 'The bank’s letter came on Monday.'}</h2>
    <p>${met ? `${lira(s.till)} in the till at close. I paid the arrears on Monday morning and kept Nevin’s name over the door.` : `${lira(s.till)} in the till at close, ${lira(BANK_TARGET - s.till)} short. The bank gave me a month, and a smaller number to call.`}</p>
    <p>${warm >= 2 ? 'The crew stayed after close on Saturday and ate together. Selim said Nevin would have laughed at me, then helped.' : warm === 1 ? 'Saturday, after close, one of them stayed to help me stack the chairs.' : 'Saturday, after close, they left without a word. The kitchen was very quiet.'}</p>
    <h2 class="hand" style="font-size:28px">What the crew said about me</h2>
    ${lastLines.map((l) => `<div class="cookline"><b>${NAMES[l.id]}</b><div class="hand">“${esc(l.t)}”</div></div>`).join('')}
    <div class="actions">
      <button id="export">Save a playtest file</button>
      <button class="primary" id="again">Another week</button>
    </div>
    ${footer()}
  </div>`;
  document.getElementById('export')?.addEventListener('click', download);
  document.getElementById('again')?.addEventListener('click', () => {
    clearSave();
    s = newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    enter();
  });
}

function download() {
  if (!s) return;
  const ex = exportRun(s, FRAMEWORK_VERSION);
  const blob = new Blob([JSON.stringify(ex)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `the-pass-${s.seed}-night${s.night}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- phone niceties ----------

async function requestWake() {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> };
    };
    if (nav.wakeLock && !wake) wake = await nav.wakeLock.request('screen');
  } catch {}
}
function releaseWake() {
  wake?.release().catch(() => {});
  wake = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    writeSave();
    // Leaving the page slows the kitchen to a stop: nothing happens while you are away.
    cancelAnimationFrame(raf);
  } else if (s && s.phase === 'service' && app.querySelector('.service')) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
    requestWake();
  }
});

export const _debug = {
  get state() {
    return s;
  },
  closeAt,
  NIGHTS,
};
