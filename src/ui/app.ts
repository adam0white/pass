/**
 * The Pass UI: plain DOM and inline SVG over the pure sim. The UI reads state and queues inputs; it never
 * changes the sim directly. Real time drives sim minutes (continuous, with slowdown while a consequential
 * request is open). The save is the chef's notebook: the seed, the input log, and the Sunday pages to turn back to.
 */
import { FRAMEWORK_VERSION, readPerson } from '@adam0white/human-framework';
import {
  isLastOfWeek,
  LAST_NIGHT,
  planOf,
  REGULARS,
  regularOf,
  STAMPS,
  WEEKDAYS,
  weekOf,
} from '../sim/campaign.ts';
import { type CookId, hireTemplate, STATIONS, type Station } from '../sim/cooks.ts';
import {
  activeCrew,
  type BoardRow,
  boardDefaults,
  canReplay,
  closeAt,
  cookOf,
  coverLine,
  type Export,
  exportRun,
  fingerprint,
  GAME_VERSION,
  type GameState,
  gasOut,
  type Hint,
  helpOptions,
  hints,
  type Input,
  memberOf,
  nameOf,
  newGame,
  OVEN_HOT,
  onShift,
  openAt,
  owed,
  pendingCoverLine,
  personOf,
  queueInput,
  replay,
  requestText,
  staffingOptions,
  stationOf,
  stationRequestLine,
  stationsTonight,
  step,
  trustOf,
  type Verb,
} from '../sim/kitchen.ts';
import { boardReplies, breakSlots, sameBoard } from './board.ts';
import { clockPlayback, SPEED_NAMES } from './clock.ts';
import { lab } from './lab.ts';
import { serviceStatus } from './status.ts';
import { gloss, lira } from './words.ts';

const SAVE = 'pass-save-v3';
const OLD_SAVES = ['pass-save-v1', 'pass-save-v2'];

interface Save {
  game: string;
  seed: number;
  inputs: Input[];
  minute: number;
  /** Sunday pages: how many inputs had been given when each week's Sunday opened. */
  pages: { week: number; k: number }[];
}

const app = document.getElementById('app') as HTMLElement;
let s: GameState | null = null;
let pages: { week: number; k: number }[] = [];
let speed = 1;
let selected: CookId | null = null;
let cachedHints: { at: number; id: CookId; list: Hint[] } | null = null;
let raf = 0;
let last = 0;
let carry = 0;
let shownSaid = 0;
const bubbles: Record<string, { text: string; until: number; minute: number }> = {};
let wake: { release(): Promise<void> } | null = null;
const seenHint = { tap: false, job: false };
let boardActionsObserver: ResizeObserver | null = null;

// ---------- save ----------

function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE);
    const sv = raw ? (JSON.parse(raw) as Save) : null;
    return sv && canReplay(sv.game) ? sv : null;
  } catch {
    return null;
  }
}
function oldSave(): boolean {
  try {
    return OLD_SAVES.some((k) => localStorage.getItem(k) !== null);
  } catch {
    return false;
  }
}
function writeSave() {
  if (!s) return;
  if (s.phase === 'sunday' && s.sunday && !pages.some((p) => p.week === s?.sunday?.week)) {
    // The page is turned at the moment Sunday opens: count only the inputs that brought us here.
    const k = s.inputs.length - Object.keys(s.sunday.chosen).length;
    pages.push({ week: s.sunday.week, k });
  }
  try {
    const sv: Save = { game: s.version, seed: s.seed, inputs: s.inputs, minute: s.minute, pages };
    localStorage.setItem(SAVE, JSON.stringify(sv));
  } catch {}
}
function clearSave() {
  pages = [];
  try {
    localStorage.removeItem(SAVE);
    for (const k of OLD_SAVES) localStorage.removeItem(k);
  } catch {}
}

// ---------- helpers ----------

const esc = (x: string) =>
  x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
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
  `<div class="footer"><a href="https://human.adamwhite.work/games/">◇ all notebooks</a><br/>People by the Human Framework ${FRAMEWORK_VERSION}. Everything they say comes from it.</div>`;
const markLink = '<a class="mark" href="https://human.adamwhite.work">◇ human framework</a>';
const weekTitle = (n: number) => `${planOf(n).title}, week ${planOf(n).week}`;
/** What the week's bill comes to so far: the bill, anything carried over, and the new hands' wages. */
/** Saturday's bill as it will stand: the week's bill, what was carried, and the hires' wages for the whole week. */
function billNow(st: GameState): number {
  const week = planOf(st.night).week;
  let left = 0;
  for (let n = st.night + (st.phase === 'service' ? 0 : 1); n <= LAST_NIGHT && planOf(n).week === week; n++)
    left++;
  const wages = st.crew.filter((m) => !m.founder && !m.left).reduce((a, m) => a + m.wage, 0);
  return weekOf(week).bill + st.carry + st.wagesDue + wages * left;
}

// ---------- title ----------

export function start() {
  if ('serviceWorker' in navigator && location.hostname !== 'localhost')
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  title();
}

function title() {
  lab.screen('title');
  cancelAnimationFrame(raf);
  const save = readSave();
  const old = !save && oldSave();
  const w1 = weekOf(1);
  const turnBack = (save?.pages ?? [])
    .map((p) => `<button data-page="${p.week}">Turn back to Sunday, week ${p.week}</button>`)
    .join('');
  app.innerHTML = `<div class="page">
    ${markLink}
    <h1>The Pass</h1>
    <p class="soft">a kitchen, four weeks of dinner services</p>
    <p>${esc(gloss(w1.intro[0] ?? '', true))}</p>
    <p>The bank wants ${lira(w1.bill)} (Turkish lira) by Saturday close.</p>
    ${old ? '<p class="soft">The kitchen has been rebuilt since your last visit, and last week’s notebook can’t be reopened. Start a fresh one.</p>' : ''}
    <div class="actions">
      ${save ? `<button class="primary" id="cont">Back to the kitchen <span class="soft">(${esc(weekTitle(replayNight(save)))})</span></button>` : ''}
      ${turnBack}
      <button class="${save ? '' : 'primary'}" id="new">${save ? 'A new notebook' : 'Open the doors'}</button>
      <button id="load">Load a playtest run</button>
      <input type="file" id="file" accept="application/json" hidden />
    </div>
    <details><summary>More about the kitchen</summary>
      <p>Tap a cook, then a job. Hold the job to insist. They can say no. The job dot marks their current station.</p>
      <p>Each ticket lists what the grill and the cold side owe it; ● is ready. Money is in Turkish lira (${lira(1)}).</p>
    </details>
    ${footer()}
  </div>`;
  document.getElementById('cont')?.addEventListener('click', () => {
    if (!save) return;
    pages = save.pages ?? [];
    s = replay(save.seed, save.inputs, save.minute, save.game);
    enter();
  });
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-page]'))
    b.addEventListener('click', () => {
      if (!save) return;
      const week = Number(b.dataset.page);
      const page = save.pages.find((p) => p.week === week);
      if (!page) return;
      if (!confirm(`Turn back to Sunday of week ${week}? Everything after that page is torn out.`)) return;
      pages = save.pages.filter((p) => p.week <= week);
      s = replay(save.seed, save.inputs.slice(0, page.k), undefined, save.game);
      writeSave();
      enter();
    });
  document.getElementById('new')?.addEventListener('click', () => {
    if (save && !confirm('Start a new notebook? This one is put away for good.')) return;
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
      const ex = JSON.parse(await f.text()) as Export;
      if (!canReplay(ex.game)) {
        alert(
          `That run is from an earlier edition of The Pass (${ex.game ?? 'unknown'}). This kitchen (${GAME_VERSION}) cooks differently, so it can’t be replayed here.`,
        );
        return;
      }
      const r = replay(ex.seed, ex.inputs, ex.state?.minute, ex.game);
      const same = ex.state ? fingerprint(r) === fingerprint(ex.state) : true;
      s = r;
      pages = [];
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

/** Which night a save is on, without replaying it: the number of 'open' inputs that moved to a new night. */
function replayNight(sv: Save): number {
  let n = 1;
  let sunday = false;
  let atBoard = sv.game === 'pass@5';
  for (const i of sv.inputs) {
    if (i.kind !== 'open') continue;
    if (atBoard) {
      atBoard = false;
      continue;
    }
    if (isLastOfWeek(n) && !sunday) sunday = true;
    else {
      sunday = false;
      n = Math.min(LAST_NIGHT, n + 1);
      atBoard = sv.game === 'pass@5';
    }
  }
  return n;
}

function enter() {
  if (!s) return;
  boardActionsObserver?.disconnect();
  shownSaid = s.said.length;
  if (s.phase === 'service') service();
  else if (s.phase === 'board') board();
  else if (s.phase === 'sunday') sunday();
  else if (s.phase === 'end') ending();
  else evening();
}

// ---------- the board ----------

function board(draft?: BoardRow[], editing: string | null = null) {
  if (s?.phase !== 'board') return;
  boardActionsObserver?.disconnect();
  const st = s;
  cancelAnimationFrame(raf);
  lab.screen(`night ${st.night}: board`);
  const agreed = boardReplies(st);
  const rows =
    draft ?? agreed.map(({ cook, station, breakAt, cover }) => ({ cook, station, breakAt, cover }));
  const changed = !sameBoard(rows, agreed);
  const stationName: Record<Station, string> = {
    grill: 'grill',
    cold: 'cold side',
    dish: 'dish pit',
    oven: 'oven',
  };
  const chips = (
    row: BoardRow,
    field: string,
    label: string,
    choices: { value: string; label: string }[],
    value: string,
  ) =>
    `<div class="board-choice" role="group" aria-label="${esc(nameOf(st, row.cook))} ${label}"><span class="board-label">${label}</span><div class="board-chips">${choices.map((choice) => `<button type="button" data-field="${field}" data-value="${esc(choice.value)}" aria-pressed="${value === choice.value}">${esc(choice.label)}</button>`).join('')}</div></div>`;
  app.innerHTML = `<div class="page board-page">${markLink}<h1>Tonight’s board</h1><p>${esc(weekTitle(st.night))} · doors at ${clock(openAt(st.night))}</p><form id="board-form"><div class="board-rows">${rows
    .map((row) => {
      const answer = agreed.find((r) => r.cook === row.cook);
      const revised = changed;
      const coverRow = rows.find((r) => r.cook === row.cover);
      const station = stationName[row.station];
      const tradeoff = coverRow ? `the ${stationName[coverRow.station]} waits` : '';
      // Keep an imported choice visible even if another edit makes its interval conflict.
      const covers = rows.filter(
        (other) =>
          other.cook !== row.cook &&
          (other.cook === row.cover || Math.abs(other.breakAt - row.breakAt) >= 20),
      );
      const alternatives = covers.map(
        (other) => `${nameOf(st, other.cook)} could cover; the ${stationName[other.station]} would wait.`,
      );
      const gap = row.cover
        ? revised
          ? `Ask ${nameOf(st, row.cover)} to cover; ${tradeoff} for twenty minutes.`
          : answer?.coverAccepted
            ? `${nameOf(st, row.cover)} covers; ${tradeoff} for twenty minutes.`
            : `${nameOf(st, row.cover)} has not agreed to cover; the ${station} waits while ${nameOf(st, row.cook)} eats.`
        : `${covers.length ? 'No cover chosen' : 'No one to cover'}; the ${station} waits while ${nameOf(st, row.cook)} eats.${alternatives.length ? ` ${alternatives.join(' ')}` : ''}`;
      const coverSummary = row.cover
        ? revised
          ? `ask ${nameOf(st, row.cover)} to cover`
          : answer?.coverAccepted
            ? `${nameOf(st, row.cover)} covers`
            : `${nameOf(st, row.cover)} not agreed; ${station} waits`
        : `${station} waits`;
      const summary = `${VERB_LABEL[row.station]} · break ${breakSlots(row.breakAt).find((slot) => slot.minute === row.breakAt)?.label} · ${coverSummary}`;
      return `<fieldset class="board-row${editing === row.cook ? ' is-editing' : ''}" data-board-cook="${esc(row.cook)}"><legend>${esc(nameOf(st, row.cook))}</legend><p class="board-summary">${esc(summary)}</p><button class="board-change" type="button" aria-expanded="${editing === row.cook}" aria-controls="board-fields-${esc(row.cook)}">${editing === row.cook ? 'Done' : 'Change'}</button><div class="board-editor" id="board-fields-${esc(row.cook)}"><div class="board-fields">${chips(
        row,
        'station',
        'Station',
        stationsTonight(st).map((station) => ({ value: station, label: VERB_LABEL[station] })),
        row.station,
      )}${chips(
        row,
        'break',
        'Break · twenty minutes',
        breakSlots(answer?.breakAt ?? row.breakAt).map((slot) => ({
          value: String(slot.minute),
          label: slot.label,
        })),
        String(row.breakAt),
      )}${chips(row, 'cover', 'Cover', [...covers.map((other) => ({ value: other.cook, label: nameOf(st, other.cook) })), { value: '', label: 'Leave it' }], row.cover ?? '')}</div><p class="board-gap">${esc(gap)}</p></div>${answer?.answer ? `<div class="board-answer hand"><b>${revised ? 'Changes not answered. Previous answer' : answer.accepted ? 'Agreed' : 'Counter / no'}.</b> “${esc(gloss(answer.answer))}”</div>` : ''}</fieldset>`;
    })
    .join(
      '',
    )}</div><div class="actions"><button class="primary" type="button" id="open-service" ${changed ? 'disabled' : ''}>Open the doors</button>${changed ? '<button class="primary" id="ask-board" type="submit">Ask them about the changes</button>' : ''}${st.previousBoard?.length ? '<button type="button" id="same-board">Same as last night</button>' : ''}</div></form><details><summary>About the board</summary><p>Agreed stations last until close. Break cover lasts until the cook returns. A cook can refuse a part; their answer stays on the board. You may revise it or open with that gap.</p><p>Money is in Turkish lira (${lira(1)}).</p></details>${footer()}</div>`;
  const actions = app.querySelector<HTMLElement>('#board-form > .actions');
  if (actions) {
    const measure = () =>
      document.documentElement.style.setProperty('--board-actions-height', `${actions.offsetHeight}px`);
    measure();
    boardActionsObserver = new ResizeObserver(measure);
    boardActionsObserver.observe(actions);
  }
  for (const button of app.querySelectorAll<HTMLButtonElement>('.board-change')) {
    button.addEventListener('click', () => {
      const cook = button.closest<HTMLElement>('[data-board-cook]')?.dataset.boardCook ?? null;
      const top = button.getBoundingClientRect().top;
      board(rows, editing === cook ? null : cook);
      const replacement = app.querySelector<HTMLButtonElement>(`[data-board-cook="${cook}"] .board-change`);
      replacement?.focus({ preventScroll: true });
      if (replacement) window.scrollBy(0, replacement.getBoundingClientRect().top - top);
    });
  }
  const submit = (next: BoardRow[]) => {
    queueInput(st, { kind: 'board', rows: next });
    writeSave();
    const scroll = window.scrollY;
    board();
    document.getElementById('open-service')?.focus({ preventScroll: true });
    window.scrollTo(0, scroll);
  };
  for (const button of app.querySelectorAll<HTMLButtonElement>('[data-field]')) {
    button.addEventListener('click', () => {
      const cook = button.closest<HTMLElement>('[data-board-cook]')?.dataset.boardCook;
      const { field, value = '' } = button.dataset;
      const next = rows.map((row) =>
        row.cook !== cook
          ? row
          : {
              ...row,
              ...(field === 'station'
                ? { station: value as Station }
                : field === 'break'
                  ? { breakAt: Number(value) }
                  : { cover: value || null }),
            },
      );
      const scroll = window.scrollY;
      board(next, editing);
      const replacement = Array.from(app.querySelectorAll<HTMLButtonElement>('[data-field]')).find(
        (el) =>
          el.closest<HTMLElement>('[data-board-cook]')?.dataset.boardCook === cook &&
          el.dataset.field === field &&
          el.dataset.value === value,
      );
      replacement?.focus({ preventScroll: true });
      window.scrollTo(0, scroll);
    });
  }
  document.getElementById('board-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (changed) submit(rows);
  });
  document.getElementById('same-board')?.addEventListener('click', () => submit(boardDefaults(st)));
  document.getElementById('open-service')?.addEventListener('click', () => {
    if (changed) return;
    if (!st.board?.agreed) queueInput(st, { kind: 'board', rows });
    queueInput(st, { kind: 'open' });
    writeSave();
    enter();
  });
  if (!draft) window.scrollTo(0, 0);
}

// ---------- service ----------

function service() {
  if (!s) return;
  lab.screen(`night ${s.night}: service`);
  selected = null;
  sheetKey = '';
  captionKey = '';
  cachedHints = null;
  shownSaid = Math.max(0, s.said.length - 3);
  requestWake();
  app.innerHTML = `<div class="service" style="--sheet-height:${s.version === 'pass@5' || stationsTonight(s).length === 4 ? 342 : 276}px">
    <div class="top">${markLink}<span class="grow"></span><span id="night"></span><span class="clock" id="clock"></span></div>
    <div class="top" style="min-height:36px;padding-top:0"><span class="money" id="till"></span><span class="grow"></span><span class="speed" id="speed"></span></div>
    <div class="clock-rate" id="clock-rate"></div>
    <div class="service-status" id="status" role="status" aria-live="polite"></div>
    <div class="rail" id="rail"></div>
    <div class="scene" id="scene"></div>
    <div class="caption" id="caption"></div>
    <div class="sheet" id="sheet"></div>
  </div>`;
  const sp = document.getElementById('speed') as HTMLElement;
  sp.innerHTML = SPEED_NAMES.map(
    (n, i) => `<button data-i="${i}" aria-label="${n.toLowerCase()}">${['▸', '▸▸', '▸▸▸'][i]}</button>`,
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
  document.getElementById('caption')?.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-counter]');
    if (!b || !s?.lastAnswer) return;
    queueInput(s, { kind: 'ask', cook: s.lastAnswer.who, verb: b.dataset.counter as Verb, counter: true });
    drawStatus();
    writeSave();
    drawCaption();
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
    const { rate } = clockPlayback(s, speed);
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
    if (x.who !== 'narrator' && x.kind !== 'journal')
      bubbles[x.who] = { text: x.text, until: performance.now() + 4000, minute: x.at };
  }
  shownSaid = s.said.length;
}

function drawAll() {
  drawStatus();
  drawTop();
  drawRail();
  drawScene();
  drawCaption();
  drawSheet();
}

function drawTop() {
  if (!s) return;
  const pl = planOf(s.night);
  (document.getElementById('night') as HTMLElement).textContent = `${pl.title} · wk ${pl.week}`;
  (document.getElementById('clock') as HTMLElement).textContent = clock(s.minute);
  (document.getElementById('till') as HTMLElement).innerHTML =
    `till <b>${lira(s.till)}</b> <span class="soft">/ ${lira(billNow(s))} by Sat</span>`;
  const playback = clockPlayback(s, speed);
  const rate = document.getElementById('clock-rate') as HTMLElement;
  rate.innerHTML = `<span>${esc(playback.label)}</span><span>${esc(playback.reason)}</span>`;
  document.querySelectorAll<HTMLButtonElement>('#speed button').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.i) === speed);
  });
}

function drawStatus() {
  if (!s) return;
  const el = document.getElementById('status');
  if (!el) return;
  const status = serviceStatus(s);
  if (el.textContent !== status.text) el.textContent = status.text;
  el.classList.toggle('needs-response', status.needsResponse);
  drawTop();
}

function drawRail() {
  if (!s) return;
  const st = s;
  const open = st.tickets.filter((t) => t.status === 'open');
  const rail = document.getElementById('rail') as HTMLElement;
  if (open.length === 0) {
    rail.innerHTML = '';
    rail.classList.add('empty');
    return;
  }
  rail.classList.remove('empty');
  rail.innerHTML = open
    .map((t) => {
      const wait = st.minute - t.at;
      const row = (name: string, done: number, n: number) =>
        n === 0 ? '' : `<div class="d">${name} ${'●'.repeat(done)}${'○'.repeat(n - done)}</div>`;
      const dish =
        row('grill', t.doneGrill, t.grill) +
        row('cold', t.doneCold, t.cold) +
        row('pide', t.doneOven, t.oven);
      if (t.due !== undefined) {
        const left = t.due - st.minute;
        return `<div class="slip wedding ${left < 15 ? 'late' : ''}"><div class="t">wedding trays</div>${dish}<div class="st">${left > 0 ? `by ${clock(t.due)}` : 'late'}</div></div>`;
      }
      const reg = t.regular ? regularOf(t.regular) : undefined;
      const who = reg ? (t.friend ? `${reg.name}’s friend` : reg.name) : `table ${t.table}`;
      const patience = t.patience;
      return `<div class="slip ${wait > patience * 0.65 ? 'late' : ''} ${reg ? 'regular' : ''}" style="opacity:${Math.max(0.55, 1 - wait / 80)}"><div class="t">${esc(who)}</div>${dish}<div class="st">${wait < 10 ? 'new' : wait < patience * 0.65 ? 'waiting' : 'restless'}</div></div>`;
    })
    .join('');
}

/** Where the stations stand tonight, left to right. */
function layout(st: GameState): Record<string, number> {
  const list = stationsTonight(st);
  const gap = 360 / list.length;
  const out: Record<string, number> = {};
  list.forEach((x, i) => {
    out[x] = Math.round(gap / 2 + gap * i);
  });
  return out;
}

/** Side-by-side offsets for cooks sharing a place. */
const SPREAD = [0, -36, 36, -72, 72];

const FIXTURES: Record<string, { x: number; y: number }> = {
  yard: { x: 318, y: 22 },
  table: { x: 46, y: 22 },
  store: { x: 180, y: 22 },
};

function placeOf(id: CookId): string {
  if (!s) return 'idle';
  const a = personOf(s, id).activity;
  if (!a) return 'idle';
  if ((STATIONS as readonly string[]).includes(a.affordanceId)) return a.affordanceId;
  if (a.affordanceId === 'apron') return stationsTonight(s).includes('grill') ? 'grill' : 'idle';
  if (['break', 'smoke', 'phone', 'skim'].includes(a.affordanceId)) return 'yard';
  if (a.affordanceId === 'eat') return 'table';
  if (a.affordanceId === 'pray') return 'store';
  return 'idle';
}

function drawScene() {
  if (!s) return;
  const st = s;
  const el = document.getElementById('scene') as HTMLElement;
  const parts: string[] = [];
  const ink = 'var(--ink)';
  const soft = 'var(--ink-soft)';
  const pos = layout(st);
  const list = stationsTonight(st);
  const half = Math.min(46, 360 / list.length / 2 - 6);
  const dark = gasOut(st);
  parts.push(`<path d="${wob(8, 50, 352, 50, 1, 0.8)}" stroke="${soft}" stroke-width="1.5" fill="none"/>`);
  parts.push(
    `<path d="${wob(300, 50, 300, 6, 2, 0.6)} ${wob(336, 50, 336, 6, 3, 0.6)}" stroke="${soft}" stroke-width="1.5" fill="none"/>`,
  );
  parts.push(`<text x="318" y="62" text-anchor="middle" font-size="11" fill="${soft}">back door</text>`);
  parts.push(
    `<path d="${wob(22, 34, 72, 34, 4)}" stroke="${soft}" stroke-width="1.5" fill="none"/><text x="46" y="62" text-anchor="middle" font-size="11" fill="${soft}">staff table</text>`,
  );
  parts.push(
    `<path d="${wob(162, 50, 162, 6, 5, 0.6)} ${wob(198, 50, 198, 6, 6, 0.6)}" stroke="${soft}" stroke-width="1.5" fill="none"/><text x="180" y="62" text-anchor="middle" font-size="11" fill="${soft}">storeroom</text>`,
  );
  const o = owed(st);
  const manned = new Set(st.cooks.filter((c) => c.here && !c.gone).map((c) => placeOf(c.id)));
  list.forEach((name, i) => {
    const x = pos[name] as number;
    const key = 10 + i * 10;
    const off = dark && (name === 'grill' || name === 'oven');
    const stroke = off ? soft : ink;
    const fill = name === 'oven' && !off ? ovenFill(st.oven.heat) : 'var(--paper-2)';
    parts.push(
      `<path d="${wob(x - half, 160, x + half, 160, key)} ${wob(x + half, 160, x + half, 178, key + 1, 0.6)} ${wob(x + half, 178, x - half, 178, key + 2)} ${wob(x - half, 178, x - half, 160, key + 3, 0.6)}" stroke="${stroke}" stroke-width="1.5" fill="${fill}"/>`,
    );
    const label =
      name === 'oven'
        ? off
          ? 'oven, dark'
          : st.oven.heat >= OVEN_HOT
            ? 'oven, hot'
            : st.oven.heat > 0.15
              ? 'oven, warming'
              : 'oven, cold'
        : off
          ? 'grill, dark'
          : name;
    parts.push(`<text x="${x}" y="194" text-anchor="middle" font-size="12" fill="${stroke}">${label}</text>`);
    const waiting =
      name === 'grill'
        ? o.grill
        : name === 'cold'
          ? o.cold
          : name === 'oven'
            ? o.oven
            : st.plates.pile >= 4 && st.plates.clean <= 2
              ? 1
              : 0;
    if (waiting > 0 && !off && !manned.has(name))
      parts.push(
        `<text x="${Math.min(290, Math.max(70, x))}" y="146" text-anchor="middle" class="hand" font-size="14" fill="var(--rope)">${name === 'oven' && st.oven.heat < OVEN_HOT ? 'pide waiting' : 'nobody on it'}</text>`,
      );
    if (name === 'grill' && !off)
      for (let k = 0; k < Math.min(6, o.grill); k++)
        parts.push(
          `<path d="M${x - half + 10 + k * 9} 158 q3 -7 0 -12" stroke="var(--rope)" stroke-width="1.3" fill="none" opacity="0.8"/>`,
        );
    if (name === 'cold')
      for (let k = 0; k < Math.min(7, o.cold); k++)
        parts.push(`<path d="M${x - half + 8 + k * 8} 156 l4 -8" stroke="var(--sky)" stroke-width="1.3"/>`);
    if (name === 'oven' && !off)
      for (let k = 0; k < Math.min(5, o.oven); k++)
        parts.push(
          `<path d="M${x - half + 10 + k * 10} 156 q5 -6 10 0" stroke="var(--rope)" stroke-width="1.2" fill="none"/>`,
        );
    if (name === 'dish')
      for (let k = 0; k < Math.min(12, st.plates.pile); k++)
        parts.push(
          `<ellipse cx="${x - 14 + (k % 3) * 14}" cy="${154 - Math.floor(k / 3) * 4}" rx="7" ry="2" stroke="${soft}" stroke-width="1.2" fill="var(--paper)"/>`,
        );
  });
  parts.push(`<path d="${wob(20, 244, 340, 244, 40)}" stroke="${ink}" stroke-width="2" fill="none"/>`);
  parts.push(`<text x="24" y="260" font-size="12" fill="${soft}">the pass</text>`);
  for (let i = 0; i < Math.min(14, st.plates.clean); i++)
    parts.push(
      `<ellipse cx="96" cy="${240 - i * 3}" rx="14" ry="3" stroke="${ink}" stroke-width="1.1" fill="var(--paper)"/>`,
    );
  if (st.plates.clean === 0)
    parts.push(
      `<text x="96" y="234" text-anchor="middle" class="hand" font-size="16" fill="var(--rope)">no plates</text>`,
    );
  if (planOf(st.night).week >= 3)
    parts.push(
      `<rect x="200" y="226" width="22" height="15" stroke="${soft}" stroke-width="1.1" fill="var(--paper-2)"/><text x="211" y="258" text-anchor="middle" font-size="10" fill="${soft}">ledger</text>`,
    );
  if (st.night >= 2) {
    const jx = st.jarPlace === 'pass' ? 250 : 270;
    const jy = st.jarPlace === 'pass' ? 238 : 40;
    const coins = Math.min(9, Math.round(st.jar / 12));
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
  const at: Record<string, number> = {};
  const here = st.crew.filter((m) => cookOf(st, m.id).here && !m.left);
  let goneRow = 0;
  here.forEach((m, idx) => {
    const c = cookOf(st, m.id);
    if (c.gone) {
      parts.push(
        `<text x="352" y="${92 + goneRow * 13}" text-anchor="end" font-size="11" fill="${soft}">${esc(m.name)}: gone</text>`,
      );
      goneRow += 1;
      return;
    }
    const pl = placeOf(m.id);
    const k = at[pl] ?? 0;
    at[pl] = k + 1;
    let x: number;
    let y: number;
    if (pos[pl] !== undefined) {
      x = (pos[pl] as number) + (SPREAD[k] ?? 0);
      y = 124;
    } else if (FIXTURES[pl]) {
      x = (FIXTURES[pl] as { x: number }).x + (SPREAD[k] ?? 0);
      y = 22;
    } else {
      x = 60 + idx * 60;
      y = 212;
    }
    parts.push(figure(m.id, Math.max(16, Math.min(344, x)), y));
  });
  el.innerHTML = `<svg viewBox="0 -26 360 294" preserveAspectRatio="xMidYMax meet" role="img" aria-label="The kitchen">${parts.join('')}<g id="bub"></g></svg>`;
  drawBubbles();
}

/** The oven's warmth, as a colour: paper when cold, a deepening ember as it heats. */
function ovenFill(heat: number): string {
  const a = Math.min(0.55, heat * 0.6);
  return `color-mix(in srgb, var(--rope) ${Math.round(a * 100)}%, var(--paper-2))`;
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
  const ink = 'var(--ink)';
  const rad = (lean * Math.PI) / 180;
  const hx = x + Math.sin(rad) * 22;
  const hy = y - 30 + (tired > 0.7 ? 4 : 0);
  const stride = 9 - Math.min(5, tired * 6);
  const smoke =
    a?.affordanceId === 'smoke'
      ? `<path d="M${hx + 10} ${hy - 4} q4 -6 0 -10 q-4 -5 1 -9" stroke="var(--ink-soft)" stroke-width="1" fill="none"/>`
      : '';
  const apron =
    s.apron === id
      ? `<path d="M${x - 6} ${y - 14} L${x + 6} ${y - 14} L${x + 7} ${y + 2} L${x - 7} ${y + 2} Z" stroke="var(--ink)" stroke-width="1.2" fill="none"/>`
      : '';
  const arms = protest
    ? `<path d="M${x - 8} ${y - 16} L${x + 8} ${y - 12} M${x + 8} ${y - 16} L${x - 8} ${y - 12}" stroke="${ink}" stroke-width="1.5"/>`
    : `<path d="M${x} ${y - 18} L${x - 10} ${y - 8} M${x} ${y - 18} L${x + 10} ${y - 9}" stroke="${ink}" stroke-width="1.5"/>`;
  return `<g class="cook" data-cook="${id}">
    <rect x="${x - 22}" y="${y - 50}" width="44" height="76" fill="transparent"/>
    <circle cx="${hx}" cy="${hy - 8}" r="8" stroke="${ink}" stroke-width="1.5" fill="var(--paper)"/>
    <path d="M${hx} ${hy} L${x} ${y}" stroke="${ink}" stroke-width="1.6"/>
    ${arms}${apron}
    <path d="M${x} ${y} L${x - stride / 2} ${y + 16} M${x} ${y} L${x + stride / 2} ${y + 16}" stroke="${ink}" stroke-width="1.5"/>
    ${smoke}
    <text x="${x}" y="${y + 30}" text-anchor="middle" font-size="12" fill="${ink}" ${sel ? 'font-weight="600"' : ''}>${esc(nameOf(s, id))}</text>
  </g>`;
}

function drawBubbles() {
  const g = document.getElementById('bub');
  if (!g || !s) return;
  const st = s;
  const now = performance.now();
  const out: string[] = [];
  const pos = layout(st);
  const stack: Record<string, number> = {};
  for (const id of onShift(st)) {
    const b = bubbles[id];
    if (!b || b.until < now || st.minute - b.minute > 6) continue;
    const pl = placeOf(id);
    const bx = pos[pl] ?? FIXTURES[pl]?.x ?? 180;
    const n = (stack[pl] ?? -1) + 1;
    stack[pl] = n;
    const y = (pos[pl] !== undefined ? 82 : pl === 'idle' ? 160 : 96) - n * 18;
    const text = b.text.length > 34 ? `${b.text.slice(0, 33)}…` : b.text;
    const x = Math.max(70, Math.min(290, bx));
    out.push(
      `<text x="${x}" y="${y}" text-anchor="middle" font-family="Caveat, cursive" font-size="17" fill="var(--ink)" stroke="var(--paper)" stroke-width="4" paint-order="stroke">${esc(text)}</text>`,
    );
  }
  g.innerHTML = out.join('');
}

/** The last answer at the pass, in full, with the counter-offer as a button. */
let captionKey = '';
function drawCaption() {
  if (!s) return;
  const el = document.getElementById('caption');
  if (!el) return;
  const a = s.lastAnswer;
  const fresh = a && s.minute - a.at <= 10;
  const key = fresh && a ? `${a.at}${a.who}${a.counter ?? ''}${s.inputs.length}` : '';
  if (key === captionKey) return;
  captionKey = key;
  if (!fresh || !a) {
    el.innerHTML = '';
    return;
  }
  const taken = s.inputs.some((i) => i.kind === 'ask' && i.counter && i.at >= a.at && i.cook === a.who);
  const canTake = a.counter && !taken && cookOf(s, a.who).here && !cookOf(s, a.who).gone;
  el.innerHTML = `<span class="hand"><b>${esc(nameOf(s, a.who))}</b> at ${clock(a.at)}: “${esc(gloss(a.text))}”</span>${canTake ? `<button data-counter="${a.counter}">Take it: ${esc(VERB_LABEL[a.counter as Verb] ?? '')}</button>` : ''}`;
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
  if (!cachedHints || cachedHints.id !== id || s.minute !== cachedHints.at)
    cachedHints = { at: s.minute, id, list: hints(s, id) };
  return cachedHints;
}

const VERB_LABEL: Record<Verb, string> = {
  grill: 'Grill',
  cold: 'Cold side',
  dish: 'Dish pit',
  oven: 'Oven',
  break: 'Take ten',
  eat: 'Eat',
  home: 'Go home',
};

const ANSWERS: Record<string, [string, string]> = {
  mother: ['Go. Now.', 'Can you stay till nine?'],
  advance: [`Give him ${lira(50)} from the till`, 'Not this week'],
  phone: ['Go on, five minutes', 'After close'],
  'leave-early': ['Go at nine', 'I need you till close'],
  'eat-first': ['Eat first', 'After the rush'],
  'my-way': ['Your oven, your way', 'My kitchen, my way'],
};

/** Update sheet text and attributes in place so clock ticks keep focused and pressed controls. */
function renderPanel(el: HTMLElement, html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const key = (node: Node): string =>
    node instanceof HTMLElement
      ? `${node.tagName}:${node.id}:${node.dataset.pick ?? ''}:${node.dataset.v ?? ''}:${node.dataset.help ?? ''}:${node.dataset.station ?? ''}:${node.dataset.cover ?? 'no-cover-control'}`
      : node.nodeName;
  const sync = (target: Node, source: Node) => {
    for (let index = 0; index < source.childNodes.length; index++) {
      const fresh = source.childNodes[index] as Node;
      const old = target.childNodes[index];
      if (!old || key(old) !== key(fresh)) {
        if (old) target.replaceChild(fresh.cloneNode(true), old);
        else target.appendChild(fresh.cloneNode(true));
      } else if (old instanceof HTMLElement && fresh instanceof HTMLElement) {
        for (const attr of old.getAttributeNames())
          if (!fresh.hasAttribute(attr) && !(attr === 'open' && old instanceof HTMLDetailsElement))
            old.removeAttribute(attr);
        for (const attr of fresh.getAttributeNames())
          if (old.getAttribute(attr) !== fresh.getAttribute(attr))
            old.setAttribute(attr, fresh.getAttribute(attr) ?? '');
        sync(old, fresh);
      } else if (old.nodeValue !== fresh.nodeValue) old.nodeValue = fresh.nodeValue;
    }
    while (target.childNodes.length > source.childNodes.length) target.lastChild?.remove();
  };
  sync(el, template.content);
}

let sheetKey = '';
let pressingJob = false;
function drawSheet() {
  if (!s) return;
  if (pressingJob) return;
  const st = s;
  const el = document.getElementById('sheet') as HTMLElement;
  const rq = st.request;
  const staffing = st.staffing?.find((decision) => decision.state === 'asking');
  if (staffing) {
    const queued = st.inputs
      .slice(st.applied)
      .some((input) => input.kind === 'staff' && input.id === staffing.id);
    sheetKey = `staff${staffing.id}${st.inputs.length}`;
    renderPanel(
      el,
      `${crewHeader()}<div class="card staffing-card"><div><b>${esc(nameOf(st, staffing.who))}</b>: ${esc(staffing.reason)}</div><div>${esc(VERB_LABEL[staffing.station])} uncovered for about ${Math.max(1, staffing.until - st.minute)} min, until ${clock(staffing.until)}.</div><div class="staffing-options">${staffingOptions(
        st,
        staffing,
      )
        .map(
          (id) =>
            `<button data-cover="${esc(id)}" ${queued ? 'disabled' : ''}>Ask ${esc(nameOf(st, id))} to cover${stationOf(st, id) ? `<span class="cover-tradeoff">${esc(VERB_LABEL[stationOf(st, id) as Station])} waits</span>` : '<span class="cover-tradeoff">Free at present</span>'}</button>`,
        )
        .join(
          '',
        )}<button data-cover="" ${queued ? 'disabled' : ''}>Leave it uncovered</button></div>${queued ? '<div class="soft">They heard you. Waiting for the cover answer.</div>' : ''}</div>`,
    );
    bindCrew(el);
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-cover]'))
      button.onclick = () => {
        queueInput(st, { kind: 'staff', id: staffing.id, cover: button.dataset.cover || null });
        writeSave();
        drawAll();
      };
    return;
  }
  document.querySelector('.service')?.classList.toggle('choosing', !!selected || rq?.state === 'asking');
  if (rq?.state === 'asking') {
    const key = `rq${rq.kind}${rq.at}`;
    if (sheetKey === key) return;
    sheetKey = key;
    const [yes, no] = ANSWERS[rq.kind] ?? ['Yes', 'No'];
    renderPanel(
      el,
      `${crewHeader()}<div class="card ink-in"><div class="hand">${esc(nameOf(st, rq.who))}: “${esc(gloss(requestText(st, rq)))}”</div>
      <div class="row"><button class="primary" id="yes">${esc(yes)}</button><button class="primary" id="no">${esc(no)}</button></div></div>`,
    );
    const answer = (choice: 'yes' | 'no') => {
      for (const b of el.querySelectorAll<HTMLButtonElement>('button')) b.disabled = true;
      queueInput(st, { kind: 'answer', choice });
      drawStatus();
      writeSave();
      el.querySelector('.card')?.insertAdjacentHTML('beforeend', '<div class="soft">They heard you.</div>');
      sheetKey = 'answered';
    };
    bindCrew(el);
    (document.getElementById('yes') as HTMLButtonElement).onclick = () => answer('yes');
    (document.getElementById('no') as HTMLButtonElement).onclick = () => answer('no');
    return;
  }
  if (!selected) {
    const lines = st.said.filter((line) => line.at >= openAt(st.night) - 5).slice(-3);
    const key = `j${st.minute}${st.inputs.length}${st.said.length}${seenHint.tap}${onShift(st)
      .map((id) => placeOf(id))
      .join()}${st.crew.map((m) => cookOf(st, m.id).gone).join()}`;
    if (sheetKey === key) return;
    sheetKey = key;
    const openingNotes = st.night === 1 && lines.every((x) => x.at === openAt(1) - 5);
    renderPanel(
      el,
      `${crewHeader()}${tipLine(st)}${foodWork(st)}<div class="journal">${openingNotes ? '<details><summary>Opening notes</summary>' : ''}${lines
        .map((x) =>
          x.who === 'narrator'
            ? `<div>${esc(gloss(x.text))}</div>`
            : `<div class="hand">${esc(nameOf(st, x.who))}: “${esc(gloss(x.text))}”</div>`,
        )
        .join('')}${openingNotes ? '</details>' : ''}</div>`,
    );
    bindCrew(el);
    return;
  }
  const h = hintsFor(selected);
  if (!h) return;
  const c = cookOf(st, selected);
  const m = memberOf(st, selected);
  const doing = personOf(st, selected).activity?.affordance.label ?? 'between jobs';
  const queued = st.inputs.slice(st.applied).some((i) => i.kind === 'ask' && i.cook === selected);
  const waiting = !!c.pending || queued;
  const absent = !c.here || c.gone;
  const key = `c${selected}${h.at}${waiting}${absent}${doing}${st.inputs.length}`;
  if (sheetKey === key) return;
  sheetKey = key;
  const guess = h.list.some((v) => v.guess);
  renderPanel(
    el,
    `${crewHeader()}
    <div class="station-duration">${esc(absent ? `${m.name} has left. Ask again next service.` : (pendingCoverLine(st, selected) ?? coverLine(st, selected) ?? stationRequestLine(st, selected) ?? ''))}</div>
    <div class="verbs" role="group" aria-label="Ask for a job">${h.list
      .map(
        (v) =>
          `<button data-v="${v.verb}" ${waiting || absent ? 'disabled' : ''}>${VERB_LABEL[v.verb]}${v.verb === stationOf(st, selected as CookId) ? ' ·' : ''}<span class="h ${v.verdict === 'refused' ? 'no' : ''} ${v.guess ? 'guess' : ''}">${absent ? 'left the kitchen' : `${esc(v.short)}${v.guess ? '?' : ''}`}</span><span class="fill"></span></button>`,
      )
      .join('')}</div>
    <div class="hint">${
      absent
        ? 'This cook has left the kitchen.'
        : guess
          ? `I don’t know ${esc(m.name)} yet: these are guesses, in pencil.`
          : seenHint.job
            ? waiting
              ? 'They heard you.'
              : 'Hold a job to insist. On a yes it only presses.'
            : 'Tap a job to ask. Hold it to insist.'
    }</div>`,
  );
  bindCrew(el);
  for (const b of el.querySelectorAll<HTMLButtonElement>('.verbs button')) bindHold(b);
}

/** One-time tips, said when the thing they explain first appears. */
function tipLine(st: GameState): string {
  const mm = st.minute - openAt(st.night);
  const pl = planOf(st.night);
  let t = '';
  if (st.night === 1 && !seenHint.tap) t = 'Tap a cook.';
  else if (st.night === 2 && mm < 40) t = 'Plates come back dirty. Someone has to wash them.';
  else if (pl.week === 2 && pl.weekday === 2 && mm < 50)
    t = 'Pide bakes only in a hot oven. Someone has to warm it before the rush, and it cools if left.';
  else if (pl.week === 2 && pl.weekday === 2 && mm < 90)
    t = 'Regulars come on their own nights. Keep them waiting and they stop coming.';
  else if (pl.week === 3 && pl.weekday === 3 && mm < 40 && st.crew.some((m) => !m.founder && m.since === 4))
    t = 'A new cook: you don’t know them yet. What they’ll say is a guess, in pencil, until you do.';
  return t ? `<div class="hint">${t}</div>` : '';
}

const WHERE: Record<string, string> = {
  grill: 'on grill',
  cold: 'on cold',
  dish: 'on dish',
  oven: 'on oven',
  yard: 'out back',
  table: 'eating',
  store: 'storeroom',
  idle: 'free',
};

function crewRow(): string {
  if (!s) return '';
  const st = s;
  return `<div class="crew">${st.crew
    .filter((m) => !m.left && cookOf(st, m.id).here)
    .map((m) => {
      const c = cookOf(st, m.id);
      return `<button data-pick="${m.id}" aria-pressed="${selected === m.id}" ${c.gone ? 'disabled' : ''}><b>${esc(m.name)}</b><span class="soft">${c.gone ? 'gone' : (WHERE[placeOf(m.id)] ?? '')}</span></button>`;
    })
    .join('')}</div>`;
}

function crewHeader(): string {
  return `<div class="who">${crewRow()}<button class="x" id="close" aria-label="close" ${selected ? '' : 'style="visibility:hidden"'}>×</button></div>`;
}

function foodWork(st: GameState): string {
  if (st.inputs.slice(st.applied).some((i) => i.kind === 'help'))
    return '<div class="food-work">Starting your portion on the next kitchen minute.</div>';
  if (st.help)
    return `<div class="food-work">You’re preparing ${st.help.station === 'grill' ? 'a grill portion' : 'a cold plate'} for table ${st.tickets.find((t) => t.id === st.help?.ticket)?.table ?? ''}, until ${clock(st.help.until)}.</div>`;
  const options = helpOptions(st);
  if (!options.length) return '';
  return `<div class="food-work">${options
    .slice(0, 2)
    .map((o) => `<button data-help="${o.ticket}" data-station="${o.station}">${esc(o.text)}</button>`)
    .join('')}</div>`;
}

function bindCrew(el: HTMLElement) {
  const close = document.getElementById('close');
  if (close) close.onclick = () => select(null);
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-pick]'))
    b.onclick = () => select(b.dataset.pick as CookId);
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-help]'))
    b.onclick = () => {
      if (!s) return;
      queueInput(s, {
        kind: 'help',
        ticket: Number(b.dataset.help),
        station: b.dataset.station as 'grill' | 'cold',
      });
      writeSave();
      sheetKey = '';
      drawSheet();
      drawStatus();
    };
}

const boundJobs = new WeakSet<HTMLButtonElement>();
function bindHold(b: HTMLButtonElement) {
  if (boundJobs.has(b)) return;
  boundJobs.add(b);
  let timer = 0;
  let fired = false;
  const verb = b.dataset.v as Verb;
  b.addEventListener('click', (event) => {
    if (event.detail === 0) ask(verb, false);
  });
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('pointerdown', () => {
    pressingJob = true;
    fired = false;
    b.classList.add('holding');
    timer = window.setTimeout(() => {
      fired = true;
      pressingJob = false;
      b.classList.remove('holding');
      ask(verb, true);
    }, 450);
  });
  const cancel = () => {
    pressingJob = false;
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
  drawStatus();
  writeSave();
  sheetKey = '';
  cachedHints = null;
  drawScene();
  drawSheet();
}

// ---------- evening ----------

const STAMP_ICON =
  '<svg width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="7" stroke="var(--rope)" stroke-width="1.4" fill="none"/><path d="M5 9.5 L8 12 L13 6" stroke="var(--rope)" stroke-width="1.4" fill="none"/></svg>';
const stampList = (ids: string[]) =>
  ids.length === 0
    ? ''
    : `<div class="stamps">${ids.map((id) => `<div>${STAMP_ICON} ${esc(STAMPS[id] ?? id)}</div>`).join('')}</div>`;

function evening() {
  if (!s) return;
  const st = s;
  cancelAnimationFrame(raf);
  sheetKey = '';
  const r = st.reports.at(-1);
  if (!r) return;
  lab.screen(`night ${r.night}: evening`);
  lab.milestone(`service ${r.night} done`);
  const pl = planOf(r.night);
  const next = r.night < LAST_NIGHT ? planOf(r.night + 1) : null;
  const total = r.served + r.walked;
  const plates = Array.from({ length: total }, (_, i) =>
    i < r.served
      ? '<svg width="16" height="16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>'
      : '<svg width="16" height="16"><path d="M3 3 L13 13 M13 3 L3 13" stroke="var(--rope)" stroke-width="1.4"/></svg>',
  ).join('');
  const prevSkim = st.reports.at(-2)?.skimmed ?? 0;
  const lightJar = r.skimmed > 0 && r.skimmed >= prevSkim;
  const crit =
    r.critic === 'pleased'
      ? '<p>The one with the notebook smiled at the door. Saturday’s paper will be kind.</p>'
      : r.critic === 'cold'
        ? '<p>The food writer ate and left without a word.</p>'
        : r.critic === 'walked'
          ? '<p>One of the tables that walked out had a notebook.</p>'
          : '';
  const wedding =
    r.wedding === 'on time'
      ? ''
      : r.wedding === 'late'
        ? '<p>The wedding trays went over late. We were paid less, and the street will hear.</p>'
        : r.wedding === 'lost'
          ? '<p>The wedding went to the place on the corner. Nevin catered every Yıldız wedding for twenty years.</p>'
          : '';
  const reviews = r.reviews
    .map((x) => {
      const lapse = x.line && !x.line.startsWith('Today I kept');
      return `<div class="cookline ink-in"><b>${esc(nameOf(st, x.id))}</b>${lapse ? `<div class="hand">“${esc(gloss(x.line))}”</div>` : ''}${x.aboutYou ? `<div class="hand">“${esc(gloss(x.aboutYou))}”</div>` : ''}</div>`;
    })
    .join('');
  const ended = st.phase === 'end';
  const toSunday = !ended && !st.lost && isLastOfWeek(r.night);
  const jarChoice =
    !ended && r.night === 3 && !st.jarDecided
      ? `<div class="card"><div>${lightJar ? 'The jar was light again tonight. Nevin used to say nothing about it.' : st.jarPlace === 'pass' ? 'The jar sits on the pass now.' : 'The jar sits by the back door, out of my sight.'}</div>
        <div class="row" style="flex-direction:column"><button data-jar="talk">Sit with Rafi on the back step</button><button data-jar="move">Move the jar to the pass</button><button data-jar="leave">Leave it</button></div></div>`
      : '';
  const bill = r.bill
    ? r.bill.paid
      ? `<p><b>Saturday close.</b> I counted out ${lira(r.bill.amount)} for ${esc(r.bill.owed)}. ${lira(st.till)} left in the till.</p>`
      : `<p><b>Saturday close.</b> ${esc(capital(r.bill.owed))} wanted ${lira(r.bill.amount)}. I had ${lira(r.bill.amount - r.bill.short)}. ${st.lost ? '' : `The rest, ${lira(r.bill.short)}, and a fee on top, is due next Saturday.`}</p>`
    : '';
  const tonight = stampList(r.stamps);
  const nextBtn = st.lost
    ? '<button class="primary" id="end">Monday morning</button>'
    : ended
      ? '<button class="primary" id="end">Close the notebook</button>'
      : toSunday
        ? '<button class="primary" id="open">Turn to Sunday</button>'
        : `<button class="primary" id="open" ${r.night === 3 ? 'disabled' : ''}>Open on ${esc(next?.title ?? '')}</button>`;
  app.innerHTML = `<div class="page">
    ${markLink}
    <h2>${esc(weekTitle(r.night))}, after close</h2>
    <div class="plates" aria-label="${r.served} tables served, ${r.walked} walked out">${plates}</div>
    <p>${r.served} of ${total} tables fed. ${lira(r.takings)} in the till tonight.${r.bill ? '' : ` ${lira(st.till)} towards ${lira(billNow(st))} for ${esc(weekOf(pl.week).owed)} on Saturday.`}</p>
    ${!ended && !r.bill ? `<p class="soft">${paceLine(st, r.night)}</p>` : ''}
    ${lightJar && r.night !== 3 && st.jarPlace === 'counter' ? '<p>The tip jar was lighter than it should have been.</p>' : ''}
    ${crit}${wedding}
    ${r.apron ? '<p>Selim wore Nevin’s apron until close. Nobody mentioned it.</p>' : ''}
    ${reviews}
    ${bill}
    ${tonight ? `<p class="soft">In the notebook tonight:</p>${tonight}` : ''}
    ${jarChoice}
    <div class="actions">
      ${nextBtn}
      ${!ended && !toSunday && !st.lost && next ? `<p class="soft" style="font-size:15px">${esc(next.intro.at(-1) ?? '')}</p>` : ''}
      <button id="export">Save a playtest file</button>
      <button id="send">Send this run to the notebook</button>
    </div>
    ${footer()}
  </div>`;
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-jar]'))
    b.addEventListener('click', () => {
      queueInput(st, { kind: 'jar', choice: b.dataset.jar as 'move' | 'talk' | 'leave' });
      writeSave();
      app.querySelectorAll<HTMLButtonElement>('[data-jar]').forEach((x) => {
        x.disabled = true;
      });
      b.classList.add('primary');
      (document.getElementById('open') as HTMLButtonElement).disabled = false;
    });
  document.getElementById('open')?.addEventListener('click', () => {
    queueInput(st, { kind: 'open' });
    writeSave();
    enter();
  });
  document.getElementById('end')?.addEventListener('click', () => {
    if (st.phase !== 'end') queueInput(st, { kind: 'open' });
    writeSave();
    ending();
  });
  document.getElementById('export')?.addEventListener('click', download);
  document.getElementById('send')?.addEventListener('click', sendRun);
  window.scrollTo(0, 0);
}

const capital = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

function paceLine(st: GameState, night: number): string {
  const week = planOf(night).week;
  const left = weekOf(week).weekdays.filter((d) => d > planOf(night).weekday).length;
  const need = billNow(st) - st.till;
  if (need <= 0)
    return `${capital(weekOf(week).owed)}’s money is already in the till. Everything now is ours.`;
  if (left === 0) return '';
  const per = Math.ceil(need / left / 10) * 10;
  return `I need about ${lira(per)} a night for the ${left} night${left > 1 ? 's' : ''} left this week.`;
}

// ---------- Sunday ----------

function sunday() {
  if (!s?.sunday) return;
  const st = s;
  const pg = st.sunday as NonNullable<GameState['sunday']>;
  lab.screen('sunday');
  lab.milestone(`week ${pg.week} done`);
  cancelAnimationFrame(raf);
  writeSave();
  const nextWeek = pg.week < 4 ? weekOf(pg.week + 1) : null;
  const card = (key: string, prompt: string, options: [string, string][]) => {
    const chosen = pg.chosen[key];
    return `<div class="card"><div>${prompt}</div><div class="row" style="flex-direction:column">${options
      .map(
        ([v, label]) =>
          `<button data-key="${esc(key)}" data-val="${esc(v)}" ${chosen !== undefined ? 'disabled' : ''} class="${chosen === v ? 'primary' : ''}">${esc(label)}</button>`,
      )
      .join('')}</div></div>`;
  };
  const parts: string[] = [];
  for (const q of pg.quits)
    parts.push(
      `<div class="cookline ink-in"><b>${esc(nameOf(st, q.id))}</b> didn’t come in on Sunday. A note under the door: <div class="hand">“${esc(q.words)}”</div></div>`,
    );
  if (pg.changes.length > 0)
    parts.push(
      `<p class="soft">What I noticed this week, writing it up:</p>${pg.changes.map((c) => `<p class="hand" style="font-size:20px">${esc(gloss(c.line))}</p>`).join('')}`,
    );
  if (pg.offday)
    parts.push(
      card(
        'offday',
        'Dilek stayed behind after Saturday close. “Wednesdays, Chef. My mother has her clinic on Wednesdays. Could I have them off?” Without her, the cold side is someone else’s on Wednesday.',
        [
          ['yes', 'Take Wednesdays'],
          ['no', 'I need you every night'],
        ],
      ),
    );
  if (pg.candidates.length > 0) {
    const opts: [string, string][] = pg.candidates.map((id) => {
      const t = hireTemplate(id);
      return [id, t ? `${t.name}, ${t.home} (${lira(t.wage)} a night)` : id];
    });
    opts.push(['none', 'Nobody this week']);
    parts.push(
      `<div class="card"><div>Two people came to the back door about the job.</div>${pg.candidates
        .map((id) => {
          const t = hireTemplate(id);
          return t
            ? `<div class="cand"><b>${esc(t.name)}</b> <span class="soft">${esc(t.looks)}</span><div class="hand">${esc(t.says)}</div></div>`
            : '';
        })
        .join('')}<div class="row" style="flex-direction:column">${opts
        .map(
          ([v, label]) =>
            `<button data-key="hire" data-val="${esc(v)}" ${pg.chosen.hire !== undefined ? 'disabled' : ''} class="${pg.chosen.hire === v ? 'primary' : ''}">${esc(label)}</button>`,
        )
        .join('')}</div></div>`,
    );
  }
  for (const id of pg.tabs) {
    const r = REGULARS.find((x) => x.id === id);
    if (!r) continue;
    parts.push(
      card(
        `tab:${id}`,
        `Nevin’s ledger: <b>${esc(r.name)}</b>, ${lira(r.owes)}.${r.margin ? ` In the margin, in her hand: <span class="hand" style="font-size:19px">“${esc(r.margin)}”</span>` : ''}`,
        [
          ['keep', 'Leave the tab as it is'],
          ['ask', 'Ask, gently, next time'],
          ['forgive', 'Cross it out'],
        ],
      ),
    );
  }
  if (pg.letgo) {
    const opts: [string, string][] = activeCrew(st)
      .filter((m) => m.since <= pg.week)
      .map((m) => [m.id, `Let ${m.name} go`]);
    opts.unshift(['none', 'Keep everyone on']);
    parts.push(card('letgo', 'The landlord’s rent goes up. Wages are the one thing I can cut.', opts));
  }
  if (pg.price)
    parts.push(
      card(
        'price',
        `Supper is ${lira(st.price)}. Nevin never changed it. More would help the bills; the street would notice.`,
        [
          ['keep', `Keep it at ${lira(st.price)}`],
          ['raise', `Raise it to ${lira(st.price + 5)}`],
        ],
      ),
    );
  if (pg.sell)
    parts.push(
      card(
        'sell',
        'The man from the döner chain came back on Sunday with a number on a card. It would clear everything, and the name over the door would go.',
        [
          ['keep', 'Keep Nevin’s name'],
          ['sell', 'Take the money'],
        ],
      ),
    );
  const stamps = stampList(pg.stamps);
  app.innerHTML = `<div class="page">
    ${markLink}
    <h2>Sunday, week ${pg.week}</h2>
    <p class="soft">${esc(weekOf(pg.week).title)}. The lokanta is closed. I sit at the staff table with the notebook.</p>
    ${parts.join('')}
    ${stamps ? `<p class="soft">This week in the notebook:</p>${stamps}` : ''}
    ${nextWeek ? `<p>Next week: ${lira(nextWeek.bill)} for ${esc(nextWeek.owed)}${st.carry ? `, and ${lira(st.carry)} carried over` : ''}.</p>` : ''}
    <div class="actions">
      <button class="primary" id="open">${pg.week < 4 ? 'Open on Wednesday' : 'Close the notebook'}</button>
      <button id="export">Save a playtest file</button>
      <button id="send">Send this run to the notebook</button>
    </div>
    ${footer()}
  </div>`;
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-key]'))
    b.addEventListener('click', () => {
      queueInput(st, { kind: 'choose', key: b.dataset.key as string, value: b.dataset.val as string });
      writeSave();
      sunday();
    });
  document.getElementById('open')?.addEventListener('click', () => {
    queueInput(st, { kind: 'open' });
    writeSave();
    enter();
  });
  document.getElementById('export')?.addEventListener('click', download);
  document.getElementById('send')?.addEventListener('click', sendRun);
  window.scrollTo(0, 0);
}

// ---------- the end ----------

function ending() {
  if (!s) return;
  const st = s;
  lab.screen('ending');
  lab.milestone('ending reached');
  cancelAnimationFrame(raf);
  const lines = st.reports.flatMap((r) => r.reviews.map((x) => ({ id: x.id, t: x.aboutYou })));
  const crew = activeCrew(st);
  const lastLines = crew.map((m) => lines.filter((l) => l.id === m.id && l.t).at(-1)).filter(Boolean) as {
    id: CookId;
    t: string;
  }[];
  const warm = crew.filter((m) => trustOf(personOf(st, m.id)) > 0.55).length;
  const nights = st.reports.length;
  let head: string;
  let body: string;
  if (st.lost) {
    const b = [...st.reports].reverse().find((r) => r.bill)?.bill;
    head = 'The letter came on Monday.';
    body = `${b ? `${capital(b.owed)} wanted ${lira(b.amount)}, and I was ${lira(b.short)} short. ` : ''}The man from the döner chain called the same afternoon. I said I would think about it. ${nights} nights at Nevin’s.`;
  } else if (st.sold) {
    head = 'The sign came down on a Tuesday.';
    body =
      'The chain paid everything, and some over. Selim took the ledger home. I don’t know what he did with it.';
  } else {
    head = 'Nevin’s name is still over the door.';
    body = `The last of the arrears went to the bank on Monday morning, with ${lira(st.till)} left in the till.${st.reports.some((r) => r.apron) ? ' Selim keeps the apron on the hook by the grill now.' : ''}`;
  }
  const together =
    warm >= Math.max(2, crew.length - 1)
      ? 'After the last close, the crew stayed and ate together at the staff table. Selim said Nevin would have laughed at me, then helped.'
      : warm >= 1
        ? 'After the last close, one of them stayed to help me stack the chairs.'
        : 'After the last close, they left without a word. The kitchen was very quiet.';
  const gone = st.crew.filter((m) => m.left);
  app.innerHTML = `<div class="page">
    ${markLink}
    <h2>${esc(head)}</h2>
    <p>${esc(body)}</p>
    <p>${esc(together)}</p>
    ${gone.length ? `<p class="soft">Gone from the kitchen: ${gone.map((m) => esc(m.name)).join(', ')}.</p>` : ''}
    <h2 class="hand" style="font-size:28px">What the crew said about me</h2>
    ${lastLines.map((l) => `<div class="cookline"><b>${esc(nameOf(st, l.id))}</b><div class="hand">“${esc(l.t)}”</div></div>`).join('')}
    ${st.stamps.length ? `<p class="soft">The notebook:</p>${stampList(st.stamps.map((x) => x.id))}` : ''}
    <div class="actions">
      <button id="export">Save a playtest file</button>
      <button id="send">Send this run to the notebook</button>
      <button class="primary" id="again">A new notebook</button>
    </div>
    ${footer()}
  </div>`;
  document.getElementById('export')?.addEventListener('click', download);
  document.getElementById('send')?.addEventListener('click', sendRun);
  document.getElementById('again')?.addEventListener('click', () => {
    clearSave();
    s = newGame((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    enter();
  });
  window.scrollTo(0, 0);
}

function sendRun() {
  if (!s) return;
  const st = s;
  lab.openSendDialog({ getRun: () => exportRun(st, FRAMEWORK_VERSION) });
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
  refresh: () => enter(),
  step: (n: number) => {
    for (let i = 0; i < n && s && s.phase === 'service'; i++) step(s);
  },
  get state() {
    return s;
  },
  closeAt,
  LAST_NIGHT,
  WEEKDAYS,
  Station: null as Station | null,
};
