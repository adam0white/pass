/**
 * The Pass UI: plain DOM and inline SVG over the pure sim. The UI reads state and queues inputs; it never
 * changes the sim directly. Real time drives sim minutes (continuous, with slowdown while a consequential
 * request is open). The save is the chef's notebook: the seed, the input log, and the Sunday pages to turn back to.
 */

import { FRAMEWORK_VERSION, readPerson } from '@adam0white/human-framework';
import { PRIVACY_URL } from '@adam0white/lab-client';
import { telemetryToggle } from '@adam0white/lab-kit';
import {
  isLastOfWeek,
  LAST_NIGHT,
  partyOf,
  planOf,
  REGULARS,
  regularOf,
  STAMPS,
  WEEKDAYS,
  weekOf,
} from '../sim/campaign.ts';
import { prepareReturn, replayExport, validateReplayFile } from '../sim/continuation.ts';
import { type CookId, hireTemplate, STATIONS, type Station } from '../sim/cooks.ts';
import { beginAtWeekTwo, firstPartyBoard, HANDOVER_LEAD, runToSeating } from '../sim/firstweek.ts';
import {
  activeCrew,
  type BoardRow,
  boardDefaults,
  bookingOf,
  canReplay,
  chefLine,
  closeAt,
  cookingChoice,
  cookingStep,
  cookOf,
  coverLine,
  type Export,
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
  partiesTonight,
  partyCard,
  pendingCoverLine,
  peopleRun,
  personOf,
  plateOptions,
  priorityOptions,
  queueInput,
  replay,
  requestText,
  type Said,
  staffingOptions,
  stationOf,
  stationRequestLine,
  stationsTonight,
  step,
  trustOf,
  type Verb,
} from '../sim/kitchen.ts';
import { zeynepDepartureStatus } from '../sim/one-cast.ts';
import { boardReplies, breakSlots, sameBoard } from './board.ts';
import { automaticClockPlayback, SPEED_NAMES } from './clock.ts';
import { type ContinuitySave, continuity, guardedContinuity } from './continuity.ts';
import { portionEdition } from './editions.ts';
import { openFeedback } from './feedback.ts';
import { handoverContext, handoverHands, sundayOpenLabel } from './first-party.ts';
import { lab } from './lab.ts';
import { endingTally } from './notebook.ts';
import { unseenSpeech } from './speech.ts';
import { journalWords, serviceStatus, tableAboutToLeave } from './status.ts';
import { gloss, lira } from './words.ts';

const SAVE = 'pass-save-v3';
const OLD_SAVES = ['pass-save-v1', 'pass-save-v2'];

interface PartyStart {
  party: string;
  night: number;
  at: number;
  promised: boolean;
  hands?: string;
}
let firstPartyStart = false;
let partyHandover: PartyStart | null = null;

interface Save {
  continuity?: ContinuitySave;
  returnChapter?: Export['returnChapter'];
  firstPartyStart?: boolean;
  partyHandover?: PartyStart | null;
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
let readingUntil = 0;
const READING_MS = 8_000;
let selected: CookId | null = null;
let cachedHints: { at: number; id: CookId; list: Hint[] } | null = null;
let raf = 0;
let last = 0;
let carry = 0;
let shownSaid: Said | undefined;
const bubbles: Record<string, { text: string; until: number; minute: number }> = {};
let wake: { release(): Promise<void> } | null = null;
const seenHint = { tap: false, job: false };
let menuOpen = false;
let menuOrigin: HTMLElement | null = null;
let boardActionsObserver: ResizeObserver | null = null;

const cast = continuity(
  () => s,
  () => writeSave(),
  (state) => {
    s = state;
    enter();
  },
);

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
    const sv: Save = {
      game: s.version,
      seed: s.seed,
      inputs: s.inputs,
      minute: s.minute,
      pages,
      firstPartyStart,
      partyHandover,
      continuity: cast.data(),
      returnChapter: s.returnChapter,
    };
    localStorage.setItem(SAVE, JSON.stringify(sv));
    lab.captureSave(structuredClone(sv));
    return true;
  } catch {
    return false;
  }
}
function clearSave() {
  pages = [];
  firstPartyStart = false;
  partyHandover = null;
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
const footer = () => `<div class="footer">People by the Human Framework ${FRAMEWORK_VERSION}.</div>`;
const markLink = '<button id="game-menu" class="menu-trigger" aria-label="Game menu">≡</button>';
const INFO: Record<string, [string, string]> = {
  title: [
    'The kitchen',
    'Tap a cook, then a job. Hold the job to insist. They can say no. Promises put a party first. Nevin’s pace gives tables longer to wait. Money is in Turkish lira.',
  ],
  board: [
    'The board',
    'Each cook gets a station, a twenty-minute break and a cover. While a cook eats, their station waits unless someone covers. The cover’s own station waits instead. Changes are proposals: cooks agree or push back before the doors open.',
  ],
  service: [
    'Running the pass',
    'Tap a cook and tap a job to ask. Hold to insist; it can cost trust. The pencil under each job is your guess at their answer. Ticket dots: ● is ready. The tick on the till bar is where tonight should end to stay on course for Saturday. The kitchen slows when someone speaks or needs you.',
  ],
  evening: [
    'The night',
    'The pace line divides the money still needed by the nights left this week. The bill is paid from the till at Saturday close.',
  ],
  sunday: [
    'Sunday',
    'Promises, a day off, hiring and prices take effect next week. A broken promise is a strike.',
  ],
  end: [
    'The tally',
    'The tally counts tables served minus tables walked out, plus ten per paid bill. This is the game’s own convention.',
  ],
};
function topBar(label: string, phase: string): string {
  const [heading, text] = INFO[phase] ?? INFO.title!;
  return `<header class="lab-topbar"><span class="bar-words">${phase === 'title' ? '<a href="https://human.adamwhite.work/games/">All games</a>' : esc(label)}</span>${phase === 'service' ? '<span class="clock" id="clock"></span>' : ''}<button class="info-button" popovertarget="phase-help" aria-label="Information">i</button><button id="game-menu" class="menu-trigger" aria-label="Game menu">≡</button></header><div id="phase-help" popover="auto" class="info-popover"><button class="info-close" popovertarget="phase-help" popovertargetaction="hide" aria-label="Close information">×</button><h2>${heading}</h2><p>${text}</p></div>`;
}
let tillStart = { key: '', amount: 0 };
function tillBar(st: GameState): string {
  const target = billNow(st);
  const day = planOf(st.night).weekday;
  const nights = weekOf(planOf(st.night).week).weekdays.filter((d) => d >= day).length;
  const start = openAt(st.night) - 5;
  const before = st.inputs.filter((input) => input.at <= start);
  const key = JSON.stringify([st.seed, st.version, st.night, before]);
  if (tillStart.key !== key)
    tillStart = {
      key,
      amount: st.phase === 'board' ? st.till : replay(st.seed, before, start, st.version).till,
    };
  const tonight = tillStart.amount;
  const per = Math.ceil(Math.max(0, target - tonight) / Math.max(1, nights) / 10) * 10;
  const tick = Math.min(100, Math.max(0, ((tonight + per) / target) * 100));
  const progress = Math.min(100, Math.max(0, (st.till / target) * 100));
  return `<div class="till-bar"><span>${lira(st.till)}</span><span class="till-track" aria-label="Progress toward Saturday’s bill"><span style="width:${progress}%"></span><i style="left:${tick}%"></i></span><span class="till-label">${lira(target)} by Sat</span></div>`;
}
function openGameMenu() {
  if (menuOpen) return;
  const saved = writeSave();
  menuOrigin = document.activeElement as HTMLElement;
  menuOpen = true;
  const dialog = document.createElement('dialog');
  dialog.className = 'game-menu-dialog';
  dialog.setAttribute('aria-label', 'Game menu');
  dialog.innerHTML = `<div class="menu-heading"><h2>Game menu <small>${s ? `· ${esc(planOf(s.night).title.slice(0, 3))} wk ${planOf(s.night).week} · ${clock(s.minute)}` : '· The Pass'}</small></h2><button id="menu-close" aria-label="Close menu">×</button></div><p id="save-result" role="status">${s ? (saved === false ? 'This device could not save the kitchen. Keep a copy through Send word.' : 'The kitchen waits while this menu is open.') : 'The kitchen is closed.'}</p><div class="menu-rows"><button id="send-run">Send word</button><button id="full-screen">Full screen</button><button id="to-title">To the title page</button><a href="https://human.adamwhite.work/games/">All games</a></div><div id="record-controls"><a href="${PRIVACY_URL}" target="_blank" rel="noopener">Lab privacy</a></div><button class="primary" id="menu-back">Back to the kitchen</button>`;
  let replacing = false;
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (replacing) return;
    menuOpen = false;
    last = performance.now();
    menuOrigin?.focus({ preventScroll: true });
  });
  for (const id of ['menu-back', 'menu-close'])
    dialog.querySelector(`#${id}`)?.addEventListener('click', () => dialog.close());
  dialog.querySelector('#to-title')?.addEventListener('click', () => {
    dialog.close();
    title();
  });
  dialog.querySelector('#full-screen')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  dialog.querySelector('#send-run')?.addEventListener('click', () => {
    replacing = true;
    dialog.close();
    openFeedback({
      lab,
      getRun: () => cast.run(),
      chooseRecording: cast.chooseRecording,
      download,
      onBack: () => {
        menuOpen = false;
        openGameMenu();
      },
    });
  });
  const recording = telemetryToggle(lab);
  const refreshRecording = () => {
    const input = recording.querySelector('input');
    if (input) input.checked = lab.telemetryOn;
  };
  window.addEventListener('pass-continuity', refreshRecording);
  window.addEventListener('hf-lab-preference', refreshRecording);
  dialog.addEventListener(
    'close',
    () => {
      window.removeEventListener('pass-continuity', refreshRecording);
      window.removeEventListener('hf-lab-preference', refreshRecording);
    },
    { once: true },
  );
  dialog.querySelector('#record-controls')?.prepend(recording, cast.controls());
  document.body.append(dialog);
  dialog.showModal();
}
document.addEventListener('click', (event) => {
  if ((event.target as Element).closest('#game-menu')) openGameMenu();
});
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

export async function start() {
  await cast.ready;
  await cast.restore();
  cast.track();
  cast.startWatching();
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
  app.innerHTML = `<div class="page title-page">
    ${topBar('The Pass', 'title')}
    <div class="page-body">
      <h1>The Pass</h1><p class="soft title-subtitle">a kitchen, four weeks of dinner services</p>
      <p>${esc(gloss(w1.intro[0] ?? '', true))}</p>
      <p>The bank wants ${lira(w1.bill)} (Turkish lira) by Saturday close.</p>
      ${old ? '<p class="soft">The kitchen has been rebuilt since your last visit, and last week’s notebook can’t be reopened. Start a fresh one.</p>' : ''}
      <fieldset class="start-approaches"><legend>Before the first service</legend>
        <label><input type="radio" name="pace" value="nevin" /><span>Selim: “I hope the regulars give us time.”<small>More time to get the lamb right. Nevin’s pace lasts all month.</small></span></label>
        <label><input type="radio" name="pace" value="normal" checked /><span>Dilek: “Leave it as it is.”<small>The usual wait. Learn the rush with the regulars watching.</small></span></label>
      </fieldset>
      <button id="fresh-authored">Begin a fresh kitchen without a returning person</button>
      <button id="other-ways" aria-haspopup="dialog">Other ways in</button>
      <p id="title-status" role="status" aria-live="polite"></p>
      <div id="title-confirm" class="inline-confirm" hidden><p id="title-confirm-message"></p><div class="row"><button id="title-confirm-yes">Continue</button><button id="title-confirm-no">Keep this notebook</button></div></div>
    </div>
    <div class="actions">
      ${save ? `<button class="primary" id="cont">Back to the kitchen <span class="soft">(${esc(weekTitle(replayNight(save)))})</span></button><button id="new">A new notebook</button>` : '<button class="primary" id="new">See tonight’s board</button>'}
    </div>
    <dialog id="other-ways-sheet" class="other-ways-sheet" aria-labelledby="other-ways-heading"><h2 id="other-ways-heading">Other ways in</h2><div class="actions">
      <button id="week-two">Begin at the second week</button><p class="soft">A steady hand runs the first week. You take over on its Sunday.</p>
      <button id="first-party">Begin at the first party</button><p class="soft">Choose the promises on Sunday and take the pass before the first party sits.</p>
      ${turnBack}<button id="load">Load a playtest run</button><button id="close-other-ways">Back</button>
    </div></dialog>
    <input type="file" id="file" accept="application/json" hidden />
    ${footer()}
  </div>`;
  const sheet = document.getElementById('other-ways-sheet') as HTMLDialogElement;
  const status = (message: string) => {
    (document.getElementById('title-status') as HTMLElement).textContent = message;
  };
  const enterWithStatus = (message = '') => {
    enter();
    if (!message) return;
    const note = document.createElement('p');
    note.className = 'run-status';
    note.setAttribute('role', 'status');
    note.textContent = message;
    const body = app.querySelector('.page-body, .journal, #sheet') ?? app.querySelector('.page') ?? app;
    body.prepend(note);
  };
  let confirmed: (() => void) | null = null;
  const ask = (message: string, action: () => void) => {
    if (sheet.open) sheet.close();
    confirmed = action;
    (document.getElementById('title-confirm-message') as HTMLElement).textContent = message;
    (document.getElementById('title-confirm') as HTMLElement).hidden = false;
    document.getElementById('title-confirm-yes')?.focus();
  };
  document.getElementById('title-confirm-yes')?.addEventListener('click', () => confirmed?.());
  document.getElementById('title-confirm-no')?.addEventListener('click', () => {
    confirmed = null;
    (document.getElementById('title-confirm') as HTMLElement).hidden = true;
    document.getElementById('new')?.focus();
  });
  document.getElementById('other-ways')?.addEventListener('click', () => sheet.showModal());
  document.getElementById('close-other-ways')?.addEventListener('click', () => sheet.close());
  document.getElementById('cont')?.addEventListener('click', async () => {
    if (!save) return;
    try {
      const restored = await validateReplayFile(save);
      await cast.restore(guardedContinuity(restored, save.continuity), false, true);
      firstPartyStart = save.firstPartyStart ?? false;
      partyHandover = save.partyHandover ?? null;
      pages = save.pages ?? [];
      s = restored;
      cast.track();
      enterWithStatus();
    } catch {
      status('This notebook could not be validated. It remains saved; a fresh kitchen is available.');
    }
  });
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-page]'))
    b.addEventListener('click', () => {
      if (!save) return;
      const week = Number(b.dataset.page);
      const page = save.pages.find((p) => p.week === week);
      if (!page) return;
      ask(`Turn back to Sunday of week ${week}? Everything after that page is torn out.`, () => {
        void (async () => {
          const restored = replayExport({
            ...save,
            inputs: save.inputs.slice(0, page.k),
            minute: undefined,
          } as unknown as Export);
          await cast.restore(guardedContinuity(restored, save.continuity), false, true);
          firstPartyStart = save.firstPartyStart ?? false;
          partyHandover = null;
          pages = save.pages.filter((p) => p.week <= week);
          s = restored;
          cast.track();
          writeSave();
          enterWithStatus();
        })().catch(() => status('That Sunday page could not be validated.'));
      });
    });
  const begin = (secondWeek: boolean, firstParty = false, authored = false) => {
    const start = () => {
      void (async () => {
        const nevin = app.querySelector<HTMLInputElement>('input[name="pace"]:checked')?.value === 'nevin';
        const returning = !secondWeek && !authored ? await cast.fresh(prepareReturn) : null;
        if (secondWeek || authored) await cast.restore();
        clearSave();
        firstPartyStart = firstParty;
        const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
        s = returning ?? (secondWeek ? beginAtWeekTwo(seed, nevin ? 'nevin' : undefined) : newGame(seed));
        cast.track();
        if (!secondWeek && !returning && nevin) queueInput(s, { kind: 'pace', value: 'nevin' });
        writeSave();
        enterWithStatus(cast.message);
      })().catch(() => status('This notebook could not be opened.'));
    };
    if (save) ask('Start a new notebook? This one is put away for good.', start);
    else start();
  };
  document.getElementById('new')?.addEventListener('click', () => begin(false));
  document.getElementById('fresh-authored')?.addEventListener('click', () => begin(false, false, true));
  document.getElementById('week-two')?.addEventListener('click', () => begin(true));
  document.getElementById('first-party')?.addEventListener('click', () => begin(true, true));
  const file = document.getElementById('file') as HTMLInputElement;
  document.getElementById('load')?.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    if (sheet.open) sheet.close();
    try {
      const ex = JSON.parse(await f.text()) as Export & { minute?: number };
      if (!canReplay(ex.game)) {
        status(
          `That run is from an earlier edition of The Pass (${ex.game ?? 'unknown'}). This kitchen (${GAME_VERSION}) cooks differently, so it can’t be replayed here.`,
        );
        return;
      }
      const r = await validateReplayFile(ex);
      const same = ex.state ? fingerprint(r) === fingerprint(ex.state) : true;
      const load = () => {
        void (async () => {
          if (!same) {
            status('The replay differs from the exported state. This file was not loaded.');
            return;
          }
          await cast.restore(
            guardedContinuity(r, (ex as Export & { continuity?: ContinuitySave }).continuity),
            true,
          );
          s = r;
          cast.track();
          firstPartyStart = false;
          partyHandover = null;
          pages = [];
          writeSave();
          enterWithStatus('Replayed the run: it matches the exported state.');
        })().catch(() => status('That file could not be validated.'));
      };
      if (save) ask('Load this run? It replaces the saved notebook.', load);
      else load();
    } catch {
      status('That file is not a run from The Pass.');
    }
  });
}

/** Which night a save is on, without replaying it: the number of 'open' inputs that moved to a new night. */
function replayNight(sv: Save): number {
  let n = 1;
  let sunday = false;
  let atBoard = ['pass@5', 'pass@6', 'pass@7', 'pass@8', 'pass@9', 'pass@10', 'pass@11', 'pass@12'].includes(
    sv.game,
  );
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
      atBoard = ['pass@5', 'pass@6', 'pass@7', 'pass@8', 'pass@9', 'pass@10', 'pass@11', 'pass@12'].includes(
        sv.game,
      );
    }
  }
  return n;
}

function enter() {
  if (!s) return;
  boardActionsObserver?.disconnect();
  shownSaid = s.said.at(-1);
  if (s.phase === 'return') returnPage();
  else if (s.phase === 'service') service();
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
  if (!peopleRun(st)) return legacyBoard(draft, editing);
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
  const parties = partiesTonight(st)
    .map((booking) => {
      const party = partyOf(booking.party);
      if (!party) return '';
      const localAt = booking.at % 1440;
      const localBy = booking.servedBy % 1440;
      const overlaps = (changed ? rows : agreed.filter((row) => row.accepted)).filter(
        (row) => row.breakAt < localBy && row.breakAt + 20 > localAt,
      );
      return `<p>${esc(party.host.charAt(0).toUpperCase() + party.host.slice(1))} at ${clock(booking.at)} · ${changed ? 'Proposed breaks: ' : ''}${overlaps.length ? `${overlaps.map((row) => `${esc(nameOf(st, row.cook))}’s break ${clock(row.breakAt)}–${clock(row.breakAt + 20)}`).join('; ')} overlaps.` : 'No breaks overlap.'}</p>`;
    })
    .join('');
  const chips = (
    row: BoardRow,
    field: string,
    label: string,
    choices: { value: string; label: string }[],
    value: string,
  ) =>
    `<div class="board-choice" role="group" aria-label="${esc(nameOf(st, row.cook))} ${label}"><span class="board-label">${label}</span><div class="board-chips">${choices.map((choice) => `<button type="button" data-field="${field}" data-value="${esc(choice.value)}" aria-pressed="${value === choice.value}">${esc(choice.label)}</button>`).join('')}</div></div>`;
  const bare = (['grill', 'cold', 'oven'] as const).filter(
    (place) => stationsTonight(st).includes(place) && !rows.some((row) => row.station === place),
  );
  const bareNote = bare.length
    ? `<p class="board-uncovered">Nobody is on the ${bare.map((place) => stationName[place]).join(' or the ')} tonight.${bare.includes('oven') ? ' Pide bakes only in a hot oven, and only a cook standing at it keeps it hot; I cannot tend it and cook.' : ''} Change someone’s station, or those tables wait.</p>`
    : '';
  const boardScroll = app.querySelector('.board-body')?.scrollTop ?? 0;
  const editorScroll = app.querySelector('.board-editor-body')?.scrollTop ?? 0;
  let editor = '';
  app.innerHTML = `<div class="board-page people-board">${topBar(`Board · ${planOf(st.night).title.slice(0, 3)} wk ${planOf(st.night).week} · doors ${clock(openAt(st.night))}`, 'board')}${tillBar(st)}<form id="board-form"><div class="board-body">${bareNote}${parties ? `<div class="board-parties">${parties}</div>` : ''}<div class="board-rows">${rows
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
      const summary = `${VERB_LABEL[row.station]} · break ${clock(row.breakAt)} · ${coverSummary}`;
      if (editing === row.cook) {
        editor = `<div class="board-editor-backdrop"><section class="board-editor" id="board-fields-${esc(row.cook)}" role="dialog" aria-modal="true" aria-labelledby="board-editor-title" data-board-cook="${esc(row.cook)}"><header><h2 id="board-editor-title">${esc(nameOf(st, row.cook))}’s plan</h2><button type="button" class="board-editor-close" aria-label="Close plan">×</button></header><div class="board-editor-body"><div class="board-fields">${chips(
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
            label: slot.label
              .replace(' before the rush', ' · before')
              .replace(' during the rush', ' · rush')
              .replace(' after the rush', ' · after'),
          })),
          String(row.breakAt),
        )}${chips(row, 'cover', 'Cover', [...covers.map((other) => ({ value: other.cook, label: nameOf(st, other.cook) })), { value: '', label: 'Leave it' }], row.cover ?? '')}</div><p class="board-gap">${esc(gap)}</p></div><footer><button type="button" id="board-done" class="primary">Done</button></footer></section></div>`;
      }
      return `<section class="board-row" data-board-cook="${esc(row.cook)}"><h2>${esc(nameOf(st, row.cook))}</h2><p class="board-summary">${esc(summary)}</p><button class="board-change" type="button" aria-expanded="${editing === row.cook}" aria-controls="board-fields-${esc(row.cook)}">Change</button>${answer?.answer ? `<div class="board-answer hand"><b>${revised ? 'Changes not answered. Previous answer' : answer.accepted ? 'Agreed' : 'Counter / no'}.</b> “${esc(gloss(answer.answer))}”</div>` : ''}</section>`;
    })
    .join(
      '',
    )}</div></div><div class="actions">${changed ? '<button class="primary" id="ask-board" type="submit">Ask them about the changes</button>' : '<button class="primary" type="button" id="open-service">Open the doors</button>'}${st.previousBoard?.length ? '<button type="button" id="same-board">Same as last night</button>' : ''}</div></form>${editor}</div>`;
  const boardBody = app.querySelector('.board-body');
  if (boardBody) boardBody.scrollTop = boardScroll;
  const editorBody = app.querySelector('.board-editor-body');
  if (editorBody) editorBody.scrollTop = editorScroll;
  const closeEditor = () => {
    board(rows);
    Array.from(app.querySelectorAll<HTMLButtonElement>('.board-change'))
      .find((button) => button.closest<HTMLElement>('[data-board-cook]')?.dataset.boardCook === editing)
      ?.focus({ preventScroll: true });
  };
  for (const button of app.querySelectorAll<HTMLButtonElement>('.board-change')) {
    button.addEventListener('click', () => {
      const cook = button.closest<HTMLElement>('[data-board-cook]')?.dataset.boardCook ?? null;
      board(rows, cook);
      app.querySelector<HTMLButtonElement>('.board-editor-close')?.focus({ preventScroll: true });
    });
  }
  document.getElementById('board-done')?.addEventListener('click', closeEditor);
  app.querySelector('.board-editor-close')?.addEventListener('click', closeEditor);
  const backdrop = app.querySelector('.board-editor-backdrop');
  backdrop?.addEventListener('click', (event) => {
    if (event.target === backdrop) closeEditor();
  });
  backdrop?.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeEditor();
    }
    if (event.key !== 'Tab') return;
    const buttons = Array.from(backdrop.querySelectorAll<HTMLButtonElement>('button'));
    const first = buttons[0];
    const last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  if (editing) {
    app.querySelector<HTMLElement>('#board-form')?.setAttribute('inert', '');
    app.querySelector<HTMLElement>('.lab-topbar')?.setAttribute('inert', '');
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
    if (partyHandover && st.night === partyHandover.night) {
      runToSeating(st, partyHandover);
      partyHandover.hands = handoverContext(st);
    }
    writeSave();
    enter();
  });
  if (!draft) window.scrollTo(0, 0);

  function legacyBoard(draft?: BoardRow[], editing: string | null = null) {
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
    const parties = partiesTonight(st)
      .map((booking) => {
        const party = partyOf(booking.party);
        if (!party) return '';
        const localAt = booking.at % 1440;
        const localBy = booking.servedBy % 1440;
        const overlaps = (changed ? rows : agreed.filter((row) => row.accepted)).filter(
          (row) => row.breakAt < localBy && row.breakAt + 20 > localAt,
        );
        return `<p>${esc(party.host.charAt(0).toUpperCase() + party.host.slice(1))} at ${clock(booking.at)} · ${changed ? 'Proposed breaks: ' : ''}${overlaps.length ? `${overlaps.map((row) => `${esc(nameOf(st, row.cook))}’s break ${clock(row.breakAt)}–${clock(row.breakAt + 20)}`).join('; ')} overlaps.` : 'No breaks overlap.'}</p>`;
      })
      .join('');
    const chips = (
      row: BoardRow,
      field: string,
      label: string,
      choices: { value: string; label: string }[],
      value: string,
    ) =>
      `<div class="board-choice" role="group" aria-label="${esc(nameOf(st, row.cook))} ${label}"><span class="board-label">${label}</span><div class="board-chips">${choices.map((choice) => `<button type="button" data-field="${field}" data-value="${esc(choice.value)}" aria-pressed="${value === choice.value}">${esc(choice.label)}</button>`).join('')}</div></div>`;
    const bare = (['grill', 'cold', 'oven'] as const).filter(
      (place) => stationsTonight(st).includes(place) && !rows.some((row) => row.station === place),
    );
    const bareNote = bare.length
      ? `<p class="board-uncovered">Nobody is on the ${bare.map((place) => stationName[place]).join(' or the ')} tonight.${bare.includes('oven') ? ' Pide bakes only in a hot oven, and only a cook standing at it keeps it hot; I cannot tend it and cook.' : ''} Change someone’s station, or those tables wait.</p>`
      : '';
    app.innerHTML = `<div class="page board-page">${markLink}<h1>Tonight’s board</h1><p>${esc(weekTitle(st.night))} · doors at ${clock(openAt(st.night))}</p>${bareNote}${parties ? `<div class="board-parties">${parties}</div>` : ''}<form id="board-form"><div class="board-rows">${rows
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
      )}</div><div class="actions"><button class="primary" type="button" id="open-service" ${changed ? 'disabled' : ''}>Open the doors</button>${changed ? '<button class="primary" id="ask-board" type="submit">Ask them about the changes</button>' : ''}${st.previousBoard?.length ? '<button type="button" id="same-board">Same as last night</button>' : ''}</div></form><button type="button" class="info-button" popovertarget="board-help" aria-label="About the board">i</button><div id="board-help" popover="auto" class="info-popover"><h2>About the board</h2><p>Agreed stations last until close. Break cover lasts until the cook returns. A cook can refuse a part; their answer stays on the board. You may revise it or open with that gap.</p><p>Money is in Turkish lira (${lira(1)}).</p></div>${footer()}</div>`;
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
      if (partyHandover && st.night === partyHandover.night) {
        runToSeating(st, partyHandover);
        partyHandover.hands = handoverContext(st);
      }
      writeSave();
      enter();
    });
    if (!draft) window.scrollTo(0, 0);
  }
}

// ---------- service ----------

function service() {
  if (!s) return;
  lab.screen(`night ${s.night}: service`);
  railOrder = [];
  railHeld = false;
  railGraceUntil = 0;
  selected = null;
  sheetKey = '';
  captionKey = '';
  cachedHints = null;
  shownSaid = s.said.at(-4);
  requestWake();
  if (!peopleRun(s)) {
    app.innerHTML = `<div class="service ${(!peopleRun(s) && s.version === 'pass@7') || portionEdition(s) ? 'hands-on' : ''} ${partiesTonight(s).length ? 'party-night' : ''}" style="--sheet-height:${s.version === 'pass@5' || (!peopleRun(s) && s.version === 'pass@6') || (!peopleRun(s) && s.version === 'pass@7') || portionEdition(s) || stationsTonight(s).length === 4 ? 342 : 276}px">
    <div class="top">${markLink}<span class="grow"></span><span id="night"></span><span class="clock" id="clock"></span></div>
    <div class="top" style="min-height:36px;padding-top:0"><span class="money" id="till"></span><span class="grow"></span><span class="speed" id="speed"></span></div>
    <div class="clock-rate" id="clock-rate"></div>
    <div class="service-status" id="status" role="status" aria-live="polite"></div>
    ${(!peopleRun(s) && s.version === 'pass@7') || portionEdition(s) ? '<div class="rail" id="rail"></div>' : ''}
    ${(!peopleRun(s) && s.version === 'pass@6') || ((!peopleRun(s) && s.version === 'pass@7') || portionEdition(s)) ? '<div class="chef-work" id="chef-work" aria-live="polite"></div>' : ''}
    ${(peopleRun(s) || s.version !== 'pass@7') && !portionEdition(s) ? '<div class="rail" id="rail"></div>' : ''}
    <div class="scene" id="scene"></div>
    <div class="caption" id="caption"></div>
    <div class="sheet" id="sheet"></div>
  </div>`;
    const sp = document.getElementById('speed') as HTMLElement;
    sp.innerHTML = SPEED_NAMES.map(
      (name, i) =>
        `<button data-i="${i}" aria-label="${name.toLowerCase()}">${['▸', '▸▸', '▸▸▸'][i]}</button>`,
    ).join(' ');
    sp.addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest('button');
      if (!button) return;
      speed = Number(button.dataset.i);
      carry = 0;
      drawTop();
      drawChefWork();
    });
  }
  if (peopleRun(s))
    app.innerHTML = `<div class="service people-service">
    ${topBar('', 'service')}<div class="state-strip" id="till"></div>
    <div class="rail" id="rail"></div><div class="scene" id="scene"></div>
    <div class="caption" id="caption" role="status"></div><div class="sheet" id="sheet"></div>
  </div>`;
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
  const rail = document.getElementById('rail');
  for (const surface of [rail, document.getElementById('chef-work')])
    surface?.addEventListener('pointerdown', () => {
      if (s?.version === 'pass@7' || portionEdition(s)) railHeld = true;
    });
  const releaseRail = () => {
    railHeld = false;
    railGraceUntil = performance.now() + 700;
    window.setTimeout(() => drawAll(), 710);
  };
  document.addEventListener('pointerup', () => {
    if (railHeld) releaseRail();
  });
  document.addEventListener('pointercancel', () => {
    if (railHeld) releaseRail();
  });
  window.addEventListener('blur', () => {
    if (railHeld) releaseRail();
  });
  rail?.addEventListener('lostpointercapture', () => {
    if (railHeld) releaseRail();
  });
  drawAll();
  window.scrollTo(0, 0);
  last = performance.now();
  carry = 0;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

function livePlayback(st: GameState, view: { reading: boolean; inspecting: boolean }) {
  return peopleRun(st) ? automaticClockPlayback(st, view) : automaticClockPlayback(st, view, speed);
}

function frame(t: number) {
  if (!s) return;
  const elapsed = Math.max(0, t - last);
  const dt = Math.min(0.25, elapsed / 1000);
  last = t;
  const held = menuOpen || !!document.querySelector('.hflab-veil, :popover-open');
  if (held) {
    if (readingUntil > t - elapsed) readingUntil += elapsed;
    for (const bubble of Object.values(bubbles)) if (bubble.until > t - elapsed) bubble.until += elapsed;
  }
  if (s.phase === 'service' && !held) {
    const { rate } = livePlayback(s, { reading: t < readingUntil, inspecting: selected !== null });
    carry += dt * rate;
    let stepped = false;
    while (carry >= 1 && s.phase === 'service') {
      carry -= 1;
      const saidBefore = s.said.at(-1);
      step(s);
      stepped = true;
      const speaking = unseenSpeech(s.said, saidBefore).some(
        (line) => line.who !== 'narrator' && line.kind !== 'journal',
      );
      if (speaking) readingUntil = t + READING_MS;
      const next = livePlayback(s, { reading: speaking, inspecting: selected !== null });
      if (speaking || next.rate < rate) {
        // Carry earned through an empty stretch cannot cross the first conversation or decision.
        carry = 0;
        break;
      }
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
  for (const x of unseenSpeech(s.said, shownSaid)) {
    if (x.who !== 'narrator' && x.kind !== 'journal')
      bubbles[x.who] = { text: x.text, until: performance.now() + READING_MS, minute: x.at };
  }
  shownSaid = s.said.at(-1);
}

function drawAll(force = false) {
  if (!force && (railHeld || performance.now() < railGraceUntil)) return;
  drawStatus();
  drawTop();
  drawRail();
  drawChefWork();
  drawScene();
  drawCaption();
  drawSheet();
}

function drawTop() {
  if (!s) return;
  if (!peopleRun(s)) {
    const pl = planOf(s.night);
    (document.getElementById('night') as HTMLElement).textContent = `${pl.title} · wk ${pl.week}`;
    (document.getElementById('clock') as HTMLElement).textContent = clock(s.minute);
    (document.getElementById('till') as HTMLElement).innerHTML =
      `till <b>${lira(s.till)}</b> <span class="soft">/ ${lira(billNow(s))} by Sat</span>`;
    const playback = automaticClockPlayback(
      s,
      {
        reading: performance.now() < readingUntil,
        inspecting: selected !== null,
      },
      speed,
    );
    document.querySelectorAll<HTMLButtonElement>('#speed button').forEach((b) => {
      b.classList.toggle('on', Number(b.dataset.i) === speed);
      b.setAttribute('aria-pressed', String(Number(b.dataset.i) === speed));
    });
    const rate = document.getElementById('clock-rate') as HTMLElement;
    rate.innerHTML = `<span>${esc(playback.label)}</span><span>${esc(playback.reason)}</span>`;
    return;
  }
  const pl = planOf(s.night);
  const label = `${pl.title} · wk ${pl.week}`;
  const night = document.getElementById('night');
  if (night) night.textContent = label;
  const words = app.querySelector('.people-service .bar-words');
  if (words) words.textContent = label;
  (document.getElementById('clock') as HTMLElement).textContent = clock(s.minute);
  const till = document.getElementById('till') as HTMLElement;
  till.innerHTML = tillBar(s);
  const playback = automaticClockPlayback(s, {
    reading: performance.now() < readingUntil,
    inspecting: selected !== null,
  });
  if (playback.rate <= 0.5) {
    const reason = selected
      ? `you’re with ${nameOf(s, selected)}`
      : performance.now() < readingUntil
        ? `${nameOf(s, s.said.filter((x) => x.who !== 'narrator').at(-1)?.who ?? 'selim')} is answering`
        : playback.reason;
    const label = till.querySelector('.till-label');
    if (label) label.textContent = `slowed: ${reason}`;
  }
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

let railHeld = false;
let railOrder: number[] = [];
let railGraceUntil = 0;
function drawRail() {
  if (!s) return;
  if (railHeld || performance.now() < railGraceUntil) return;
  const st = s;
  const active = st.tickets.filter((t) => t.status === 'open');
  railOrder = railOrder.filter((id) => active.some((t) => t.id === id));
  for (const ticket of active) if (!railOrder.includes(ticket.id)) railOrder.push(ticket.id);
  const open = railOrder.flatMap((id) => active.filter((t) => t.id === id));
  const leaving = tableAboutToLeave(st);
  const rail = document.getElementById('rail') as HTMLElement;
  if (open.length === 0) {
    renderPanel(rail, peopleRun(st) ? '<span class="rail-clear">Rail clear</span>' : '');
    rail.classList.add('empty');
    return;
  }
  rail.classList.remove('empty');
  renderPanel(
    rail,
    open
      .map((t) => {
        const wait = st.minute - t.at;
        const row = (name: string, done: number, n: number) =>
          n === 0
            ? ''
            : `<div class="d">${name} ${((!peopleRun(st) && st.version === 'pass@7') || portionEdition(st)) && n > 5 ? `${done}/${n}` : '●'.repeat(done) + '○'.repeat(n - done)}</div>`;
        const dish =
          row('grill', t.doneGrill, t.grill) +
          row('cold', t.doneCold, t.cold) +
          row('pide', t.doneOven, t.oven);
        if (t.due !== undefined) {
          const left = t.due - st.minute;
          return `<div class="slip wedding ${left < 15 ? 'late' : ''}"><div class="t">wedding trays</div>${dish}<div class="st">${left > 0 ? `by ${clock(t.due)}` : 'late'}</div></div>`;
        }
        const reg = t.regular ? regularOf(t.regular) : undefined;
        const party = t.party ? partyOf(t.party) : undefined;
        const booking = bookingOf(st, t.id);
        const partyLabel = party
          ? `<div class="party-label" id="party-label-${t.id}">${booking?.promised ? (peopleRun(st) ? `promised: first at the pass · out by ${clock(booking.servedBy)}` : `promised: <span class="chef-signature">${esc(party.signature.words)} (Chef’s)</span> · out by ${clock(booking.servedBy)}`) : 'as it comes'}</div>`
          : '';
        const who = party
          ? party.host
          : reg
            ? t.friend
              ? `${reg.name}’s friend`
              : reg.name
            : `table ${t.table}`;
        const patience = t.patience;
        const option =
          ((!peopleRun(st) && st.version === 'pass@6') ||
            (!peopleRun(st) && st.version === 'pass@7') ||
            portionEdition(st)) &&
          helpOptions(st).find((o) => o.ticket === t.id);
        const priority =
          st.passDecision?.ticket === t.id ? '<div class="priority-mark">First on the pass</div>' : '';
        if (
          (!peopleRun(st) && st.version === 'pass@6') ||
          (!peopleRun(st) && st.version === 'pass@7') ||
          portionEdition(st)
        )
          return `<button class="slip ${wait > patience * 0.65 ? 'late' : ''} ${reg || party ? 'regular' : ''} ${party ? 'party-slip' : ''}" data-ticket="${t.id}" data-portion-station="${option ? option.station : t.grill > t.doneGrill ? 'grill' : t.cold > t.doneCold ? 'cold' : 'oven'}" aria-label="Work ${esc(who)}${party || reg ? `, table ${t.table}` : ''}" ${party ? `aria-describedby="party-label-${t.id}"` : ''} ${(!peopleRun(st) && st.version === 'pass@6' && !option) || (portionEdition(st) && t.doneGrill >= t.grill && t.doneCold >= t.cold && t.doneOven >= t.oven) ? 'disabled' : ''}><div class="t">${esc(who)}${party || reg ? `<span class="table-no"> · table ${t.table}</span>` : ''}</div>${partyLabel}${dish}<div class="st ${leaving === t.id ? 'leaving' : ''}">${leaving === t.id ? 'about to leave' : option ? 'Tap to work a portion' : 'Cooking / ready'}</div>${priority}</button>`;
        return `<div class="slip ${wait > patience * 0.65 ? 'late' : ''} ${reg || party ? 'regular' : ''} ${party ? 'party-slip' : ''}" style="opacity:${Math.max(0.55, 1 - wait / 80)}"><div class="t">${esc(who)}${party || reg ? `<span class="table-no"> · table ${t.table}</span>` : ''}</div>${partyLabel}${dish}<div class="st ${leaving === t.id ? 'leaving' : ''}">${leaving === t.id ? 'about to leave' : wait < 10 ? 'new' : wait < patience * 0.65 ? 'waiting' : 'restless'}</div></div>`;
      })
      .join(''),
  );
  for (const ticket of rail.querySelectorAll<HTMLButtonElement>('[data-ticket]'))
    ticket.onclick = () => {
      const option = helpOptions(st).find((o) => o.ticket === Number(ticket.dataset.ticket));
      if (option) reservePortion(option.ticket, option.station);
      else if ((!peopleRun(st) && st.version === 'pass@7') || portionEdition(st))
        reservePortion(
          Number(ticket.dataset.ticket),
          ticket.dataset.portionStation as 'grill' | 'cold' | 'oven',
        );
    };
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
    <rect x="${x - (peopleRun(s) ? 34 : 22)}" y="${y - 50}" width="${peopleRun(s) ? 68 : 44}" height="76" fill="transparent"/>
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
    // Longer speech is already recorded in full in the journal.
    if (b.text.length > 34) continue;
    const text = b.text;
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
  let handover = '';
  if (partyHandover && s.night === partyHandover.night && s.minute <= partyHandover.at - HANDOVER_LEAD + 10) {
    const party = partyOf(partyHandover.party);
    if (party)
      handover = `<span class="hand">${esc(`${party.host.charAt(0).toUpperCase()}${party.host.slice(1)} sit at ${clock(partyHandover.at)}. ${partyHandover.promised ? (peopleRun(s) ? 'You promised their order first and on time.' : `You promised ${party.signature.words}.`) : 'You promised nothing; they come anyway.'} ${peopleRun(s) ? 'The steady hand ran the service until now. The crew cooks and sends plates.' : handoverHands(partyHandover.hands)} You have the pass.`)}</span>`;
  }
  const a = s.lastAnswer;
  const fresh = a && s.minute - a.at <= 10;
  const key =
    serviceStatus(s).text +
    handover +
    (fresh && a ? `${a.at}${a.who}${a.counter ?? ''}${s.inputs.length}` : '');
  if (key === captionKey) return;
  captionKey = key;
  if (!fresh || !a) {
    el.innerHTML =
      handover ||
      esc(
        peopleRun(s) && serviceStatus(s).text === 'Waiting for the next ticket.'
          ? 'Rail clear. The kitchen runs; nothing needs you.'
          : serviceStatus(s).text,
      );
    return;
  }
  const taken = s.inputs.some((i) => i.kind === 'ask' && i.counter && i.at >= a.at && i.cook === a.who);
  const canTake = a.counter && !taken && cookOf(s, a.who).here && !cookOf(s, a.who).gone;
  el.innerHTML = `${handover}<span class="hand"><b>${esc(nameOf(s, a.who))}</b> at ${clock(a.at)}: “${esc(gloss(a.text))}”</span>${canTake ? `<button data-counter="${a.counter}">${peopleRun(s) ? `Ask ${esc(nameOf(s, a.who))}` : 'Take it'}: ${esc(VERB_LABEL[a.counter as Verb] ?? '')}</button>` : ''}`;
}

function select(id: CookId | null) {
  if (!s) return;
  if (id && (!cookOf(s, id).here || cookOf(s, id).gone)) return;
  selected = selected === id ? null : id;
  carry = 0;
  drawTop();
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
      ? `${node.tagName}:${node.id}:${node.dataset.pick ?? ''}:${node.dataset.v ?? ''}:${node.dataset.help ?? ''}:${node.dataset.ticket ?? ''}:${node.dataset.callPlate ?? ''}:${node.dataset.cookStep ?? ''}:${node.dataset.cookChoice ?? ''}:${node.dataset.finishPortion ?? ''}:${node.dataset.priority ?? ''}:${node.dataset.chefStation ?? ''}:${node.dataset.station ?? ''}:${node.dataset.cover ?? 'no-cover-control'}`
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
  const priorityWaiting =
    st.passDecision?.state === 'asking' &&
    (!st.help || (!peopleRun(st) && st.version === 'pass@6')) &&
    !staffing &&
    rq?.state !== 'asking';
  document
    .querySelector('.service')
    ?.classList.toggle(
      'responding',
      priorityWaiting || rq?.state === 'asking' || !!st.staffing?.some((d) => d.state === 'asking'),
    );
  document
    .querySelector('.service')
    ?.classList.toggle('choosing', (!!selected && !priorityWaiting) || rq?.state === 'asking');
  document
    .querySelector('.service')
    ?.classList.toggle('inspecting', !!selected && !priorityWaiting && !staffing && rq?.state !== 'asking');
  if (priorityWaiting) {
    renderPanel(
      el,
      `${crewHeader()}<div class="card priority-card"><b>Call a table first</b><div>${st.help ? 'Your hands are full. Finish this portion before calling a table first.' : 'The other tables wait.'}</div><div class="priority-options">${priorityOptions(
        st,
      )
        .map((o) => `<button class="primary" data-priority="${o.ticket}">${esc(o.text)}</button>`)
        .join('')}</div></div>`,
    );
    bindCrew(el);
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-priority]'))
      button.onclick = () => {
        queueInput(st, { kind: 'pass-priority', ticket: Number(button.dataset.priority) });
        writeSave();
        drawAll();
      };
    return;
  }
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

  if (rq?.state === 'asking') {
    const key = `rq${rq.kind}${rq.at}`;
    if (sheetKey === key) return;
    sheetKey = key;
    const [yes, no] = ANSWERS[rq.kind] ?? ['Yes', 'No'];
    renderPanel(
      el,
      `${crewHeader()}<div class="card ink-in"><div class="hand">${esc(nameOf(st, rq.who))}: “${esc(gloss(requestText(st, rq)))}”</div>
      <div class="row"><button id="yes">${esc(yes)}</button><button id="no">${esc(no)}</button></div></div>`,
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
    const lines = st.said.filter((line) => line.at >= openAt(st.night) - 5);
    const key = `j${st.minute}${st.inputs.length}${st.said.length}${seenHint.tap}${onShift(st)
      .map((id) => placeOf(id))
      .join()}${st.crew.map((m) => cookOf(st, m.id).gone).join()}`;
    if (sheetKey === key) return;
    sheetKey = key;
    const lineHTML = (x: Said) =>
      x.who === 'narrator'
        ? `<div>${peopleRun(st) ? `<time>${clock(x.at)}</time> ` : ''}${esc(gloss(journalWords(st, x)))}</div>`
        : `<div class="hand">${peopleRun(st) ? `<time>${clock(x.at)}</time> ` : ''}${esc(nameOf(st, x.who))}: “${esc(gloss(x.text))}”</div>`;
    const opening = lines.filter((x) => x.at === openAt(st.night) - 5 && x.who === 'narrator');
    const legacyOpening = st.night === 1 && lines.slice(-3).every((x) => x.at === openAt(1) - 5);
    const journal = peopleRun(st)
      ? `<div class="journal-heading">Tonight’s journal · earlier words</div>${opening.length ? `<details><summary>Opening notes</summary>${opening.map(lineHTML).join('')}</details>` : ''}${lines
          .filter((x) => x.at !== openAt(st.night) - 5 || x.who !== 'narrator')
          .map(lineHTML)
          .join('')}`
      : `${legacyOpening ? '<details><summary>Opening notes</summary>' : ''}${lines.slice(-3).map(lineHTML).join('')}${legacyOpening ? '</details>' : ''}`;
    renderPanel(
      el,
      `${crewHeader()}${tipLine(st)}${(!peopleRun(st) && st.version === 'pass@6') || ((!peopleRun(st) && st.version === 'pass@7') || portionEdition(st)) ? '' : foodWork(st)}<div class="journal">${journal}</div>`,
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
  const answer =
    st.lastAnswer?.who === selected
      ? st.lastAnswer
      : peopleRun(st)
        ? st.said.findLast((line) => line.who === selected && line.kind === 'answer')
        : null;
  const key = `c${selected}${h.at}${waiting}${absent}${doing}${st.inputs.length}${answer?.at}${answer?.text}`;
  if (sheetKey === key) return;
  sheetKey = key;
  const guess = h.list.some((v) => v.guess);
  renderPanel(
    el,
    `${crewHeader()}
    <div class="station-duration">${esc(absent ? `${m.name} has left. Ask again next service.` : `${peopleRun(st) && !stationOf(st, selected) ? `Now: ${doing} · ${WHERE[placeOf(selected)] ?? 'free'}. ` : ''}${pendingCoverLine(st, selected) ?? coverLine(st, selected) ?? stationRequestLine(st, selected) ?? ''}`)}</div>
    <div class="verbs" role="group" aria-label="Ask for a job">${h.list
      .map(
        (v) =>
          `<button data-v="${v.verb}" ${waiting || absent ? 'disabled' : ''}>${queued && st.inputs.slice(st.applied).some((i) => i.kind === 'ask' && i.cook === selected && i.verb === v.verb) ? 'asked…' : VERB_LABEL[v.verb]}${v.verb === stationOf(st, selected as CookId) ? ' ·' : ''}<span class="h ${v.verdict === 'refused' ? 'no' : ''} ${v.guess ? 'guess' : ''}">${absent ? 'left the kitchen' : `${esc(v.short)}${v.guess ? '?' : ''}`}</span><span class="fill"></span></button>`,
      )
      .join('')}</div>
    <div class="panel-reply" role="status">${answer ? `“${esc(gloss(answer.text))}”` : ''}</div><div class="hint">${
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
/** The chef cannot warm the oven: only a cook standing at it does (simulation: stepCooks). */
function ovenTended(st: GameState) {
  return onShift(st).some((id) => stationOf(st, id) === 'oven');
}

function ovenWait(st: GameState) {
  return ovenTended(st) ? 'Oven warming' : 'Cold. Nobody on it';
}

function tipLine(st: GameState): string {
  const mm = st.minute - openAt(st.night);
  const pl = planOf(st.night);
  let t = '';
  if (st.night === 1 && !seenHint.tap) t = 'Tap a cook.';
  else if (st.night === 2 && mm < 40) t = 'Plates come back dirty. Someone has to wash them.';
  else if (pl.week === 2 && pl.weekday === 2 && mm < 50)
    t = 'Pide bakes only in a hot oven. A cook has to stand at it to warm it, and it cools if left.';
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
  if (peopleRun(st)) return '';
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

function reservePortion(ticket: number, station: 'grill' | 'cold' | 'oven') {
  if (!s) return;
  const saidBefore = s.said.at(-1);
  queueInput(s, { kind: 'help', ticket, station });
  writeSave();
  sheetKey = '';
  drawAll(true);
  immediateReply(saidBefore);
}

function immediateReply(saidBefore: GameState['said'][number] | undefined, text?: string) {
  if (!s || ((peopleRun(s) || s.version !== 'pass@7') && !portionEdition(s)) || s.said.at(-1) === saidBefore)
    return;
  const reply = s.said.at(-1);
  const caption = document.getElementById('caption');
  if (reply && caption) {
    captionKey = 'immediate-reply';
    caption.textContent = text ?? reply.text;
    caption.setAttribute('role', 'status');
  }
}

function handsInput(input: Parameters<typeof queueInput>[1]) {
  if (!s) return;
  const saidBefore = s.said.at(-1);
  queueInput(s, input);
  writeSave();
  sheetKey = '';
  drawAll(true);
  immediateReply(
    saidBefore,
    input.kind === 'call-plate'
      ? s.said
          .slice(-2)
          .map((line) => line.text)
          .join(' ')
      : undefined,
  );
}

function drawChefWork() {
  if (!s || peopleRun(s) || (s.version !== 'pass@6' && s.version !== 'pass@7' && !portionEdition(s))) return;
  const el = document.getElementById('chef-work');
  if (!el) return;
  const st = s;
  const options = helpOptions(st);
  if ((!peopleRun(st) && st.version === 'pass@7') || portionEdition(st)) {
    const act = cookingStep(st);
    const plates = plateOptions(st);
    el.classList.toggle('crowded-pass', plates.length > 2);
    const active = act && st.help && !st.help.instinct;
    const station = act?.station ?? st.help?.station;
    const activeTicket = st.tickets.find((t) => t.id === st.help?.ticket);
    const table = activeTicket?.table;
    const activeParty = activeTicket?.party ? partyOf(activeTicket.party) : undefined;
    const activeBooking = activeTicket ? bookingOf(st, activeTicket.id) : undefined;
    const partyContext =
      activeParty && activeBooking
        ? `<b>${esc(activeParty.host)}</b><span>${activeBooking.promised ? `Promised: ${esc(activeParty.signature.words)}.` : 'As it comes; no promise.'} · out by ${clock(activeBooking.servedBy)}</span>`
        : '';
    const next = portionEdition(st) ? st.chefNext : null;
    const choice = portionEdition(st) ? cookingChoice(st) : null;
    const actText =
      act?.station === 'oven' && st.oven.heat < OVEN_HOT && !gasOut(st) && !ovenTended(st)
        ? 'Waiting for the oven. Nobody is on it to warm it.'
        : (act?.text ?? '');
    const actControl = choice
      ? `<div class="food-choices"><button class="primary" data-cook-choice="now" data-choice-ticket="${choice.ticket}">${esc(choice.plain)}<span class="work-duration">Plain. Ready sooner.</span></button><button class="primary" data-cook-choice="careful" data-choice-ticket="${choice.ticket}">${esc(gloss(choice.careful))}<span class="work-duration">${choice.minutes} more kitchen minutes. Other tables wait.</span></button></div>`
      : act
        ? `<button class="portion-act ${act.ready ? 'ready' : ''}" data-cook-step="${act.ticket}" aria-label="${esc(actText)}" ${act.ready ? '' : 'disabled'}>${esc(actText)}</button>`
        : '';
    renderPanel(
      el,
      `${active ? `<section class="active-portion" aria-label="Your active portion"><div class="portion-heading"><b>Table ${table} · ${station === 'cold' ? 'cold side' : station}</b><span class="work-duration">${st.chef.body.exertion > 0.45 ? 'My arms are tired.' : 'Working my arms.'}</span></div><div class="active-party">${partyContext}</div><div class="food-surface food-${station}"><div class="food-drawing" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="food-acts">${actControl}</div></div>${portionEdition(st) ? `<button class="finish-portion" data-finish-portion="${st.help?.ticket}">Finish on instinct<span class="work-duration">Plain food. Keep the room’s speed.</span></button>` : ''}</section>` : `<div class="chef-line">${esc(st.help?.instinct ? 'My hands finish this portion on instinct. Plain food.' : chefLine(st))}</div>`}
      ${next ? `<div class="chef-next">Chef’s next: table ${st.tickets.find((t) => t.id === next.ticket)?.table} · ${next.station === 'cold' ? 'cold side' : next.station}</div>` : ''}
      <div class="chef-stations">${(['grill', 'cold', 'oven'] as const)
        .filter((place) => stationsTonight(st).includes(place))
        .map((place) => {
          const option = options.find((o) => o.station === place);
          return `<button data-chef-station="${place}" data-portion-ticket="${option?.ticket ?? ''}" aria-label="Work ${place === 'cold' ? 'cold side' : place}" ${(st.help && !portionEdition(st)) || !option ? 'disabled' : ''}>${st.help && portionEdition(st) ? 'Next: ' : 'Work '}${place === 'cold' ? 'cold side' : place}<span class="work-duration">${option ? `Table ${st.tickets.find((t) => t.id === option.ticket)?.table}${st.help ? '. Reserve it.' : '. Take a portion.'}` : st.help ? 'Hands full' : owed(st)[place] > 0 && place !== 'cold' && gasOut(st) ? 'Waiting for gas' : owed(st)[place] > 0 && place === 'oven' && st.oven.heat < OVEN_HOT ? ovenWait(st) : 'Nothing waiting'}</span></button>`;
        })
        .join(
          '',
        )}</div><div class="pass-plates" aria-label="Plates at the pass">${plates.map((plate) => `<button data-call-plate="${plate.ticket}">${esc(plate.text.split('!')[0] ?? plate.text)}!<span class="work-duration">${plate.text.includes('cooling') ? 'Cooling.' : 'Out hot.'}</span></button>`).join('')}</div>`,
    );
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-cook-choice]'))
      button.onclick = () =>
        handsInput({
          kind: 'cook-choice',
          ticket: Number(button.dataset.choiceTicket),
          choice: button.dataset.cookChoice as 'now' | 'careful',
        });
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-finish-portion]'))
      button.onclick = () =>
        handsInput({ kind: 'finish-portion', ticket: Number(button.dataset.finishPortion) });
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-cook-step]'))
      button.onclick = () => handsInput({ kind: 'cook-step', ticket: Number(button.dataset.cookStep) });
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-call-plate]'))
      button.onclick = () => handsInput({ kind: 'call-plate', ticket: Number(button.dataset.callPlate) });
    for (const button of el.querySelectorAll<HTMLButtonElement>('[data-chef-station]'))
      button.onclick = () => {
        const station = button.dataset.chefStation as 'grill' | 'cold' | 'oven';
        const option = helpOptions(st).find((o) => o.station === station);
        reservePortion(option?.ticket ?? Number(button.dataset.portionTicket || -1), station);
      };
    return;
  }
  renderPanel(
    el,
    `<div class="chef-line">${esc(chefLine(st))}</div><div class="chef-stations">${(
      ['grill', 'cold', 'oven'] as const
    )
      .filter((station) => stationsTonight(st).includes(station))
      .map(
        (station) =>
          `<button data-chef-station="${station}" aria-label="Work ${station === 'cold' ? 'cold side' : station}" ${options.some((o) => o.station === station) ? '' : 'disabled'}>Work ${station === 'cold' ? 'cold side' : station}<span class="work-duration">${
            options
              .find((o) => o.station === station)
              ?.text.split(' · ')
              .at(-1) ??
            (st.help
              ? 'Hands full'
              : owed(st)[station] > 0 && station !== 'cold' && gasOut(st)
                ? 'Waiting for gas'
                : owed(st)[station] > 0 && station === 'oven' && st.oven.heat < OVEN_HOT
                  ? ovenWait(st)
                  : 'Nothing waiting')
          }</span></button>`,
      )
      .join(
        '',
      )}</div><div class="chef-tradeoff">${st.help ? 'Your hands are full. Finish this portion before calling a table first.' : options.length ? 'One portion takes your hands away from managing the pass.' : 'No portion is waiting. The cooks keep working.'}</div>`,
  );
  for (const button of el.querySelectorAll<HTMLButtonElement>('[data-chef-station]'))
    button.onclick = () => {
      const option = helpOptions(st).find((o) => o.station === button.dataset.chefStation);
      if (option) reservePortion(option.ticket, option.station);
    };
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
  void cast.checkpoint();
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
  const parties = (r.parties ?? [])
    .map((result) => {
      const party = partyOf(result.party);
      if (!party || !result.outcome) return '';
      if (peopleRun(st)) {
        const words =
          result.outcome === 'kept'
            ? `${party.host}: “On time, as promised. Thank you.”`
            : result.outcome === 'broken'
              ? `${party.host}: “We had agreed a time.”`
              : party[result.outcome];
        return `<p class="party-outcome">${result.walked ? `${esc(party.walked)}${result.promised ? ' I had promised them.' : ''}` : esc(words)}</p>`;
      }
      return `<p class="party-outcome">${result.walked ? `${esc(party.walked)}${result.promised ? ' I had promised them.' : ''}` : `${esc(party[result.outcome])}${(result.outcome === 'kept' || result.outcome === 'broken') && result.waited !== undefined ? ` Table ${result.waited} waited longest while I ${esc(party.doing)}.` : ''}`}</p>`;
    })
    .join('');
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
  // Jar answers are already authored by the simulation after the shift closes.
  const jarReply =
    r.night === 3 && st.jarDecided
      ? `<div class="card jar-reply" role="status">${st.said
          .filter((line) => line.at > closeAt(r.night))
          .map(
            (line) =>
              `<p>${line.who === 'narrator' ? '' : `<b>${esc(nameOf(st, line.who))}:</b> `}${esc(gloss(line.text))}</p>`,
          )
          .join('')}</div>`
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
        : `<button class="primary" id="open" ${r.night === 3 && !st.jarDecided ? 'disabled' : ''}>Open on ${esc(next?.title ?? '')}</button>`;
  app.innerHTML = `<div class="page evening-page">
    ${topBar(`After close · ${weekTitle(r.night)}`, 'evening')}
    <div class="page-body">
    <h2>${esc(weekTitle(r.night))}, after close</h2>
    <div class="plates" aria-label="${r.served} tables served, ${r.walked} walked out">${plates}</div>
    ${!ended && !r.bill ? `<p class="evening-pace">${paceLine(st, r.night)}</p>` : ''}
    ${tillBar(st)}
    <p>${r.served} of ${total} tables fed. ${lira(r.takings)} earned tonight.</p>
    ${lightJar && r.night !== 3 && st.jarPlace === 'counter' ? '<p>The tip jar was lighter than it should have been.</p>' : ''}
    ${crit}${wedding}${parties}
    ${r.apron ? '<p>Selim wore Nevin’s apron until close. Nobody mentioned it.</p>' : ''}
    ${reviews}
    ${bill}${r.bill?.promiseBroken ? '<p>A promise broken this week: one strike.</p>' : ''}
    ${tonight ? `<p class="soft">In the notebook tonight:</p>${tonight}` : ''}
    ${jarChoice}${jarReply}
    ${zeynepDepartureStatus(st).canRelease ? '<section class="card"><p>Zeynep’s stint can end here. Chef can release her remaining kitchen shifts.</p><button id="zeynep-release">Chef: “Your shifts here are finished, Zeynep.”</button></section>' : ''}
    </div>
    <div class="actions">
      ${nextBtn}
      ${!ended && !toSunday && !st.lost && next ? `<p class="soft" style="font-size:15px">${esc(next.intro.at(-1) ?? '')}</p>` : ''}
    </div>
  </div>`;
  document.getElementById('zeynep-release')?.addEventListener('click', () => {
    queueInput(st, { kind: 'zeynep-release' });
    writeSave();
    lab.milestone('zeynep source released');
    void cast.checkpoint();
    evening();
  });
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-jar]'))
    b.addEventListener('click', () => {
      queueInput(st, { kind: 'jar', choice: b.dataset.jar as 'move' | 'talk' | 'leave' });
      writeSave();
      evening();
      app.querySelector('.jar-reply')?.scrollIntoView({ block: 'nearest' });
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

const SEEN_WHO: Record<number, string> = { 1: 'Ahmet', 2: 'the landlord', 3: 'the bank' };

function sunday() {
  if (!s?.sunday) return;
  const st = s;
  const pg = st.sunday as NonNullable<GameState['sunday']>;
  lab.screen('sunday');
  lab.milestone(`week ${pg.week} done`);
  void cast.checkpoint();
  cancelAnimationFrame(raf);
  writeSave();
  const nextWeek = pg.week < 4 ? weekOf(pg.week + 1) : null;
  const card = (key: string, prompt: string, options: [string, string][]) => {
    const chosen = pg.chosen[key];
    return `<div class="card"><div>${prompt}</div><div class="row" style="flex-direction:column">${options
      .map(
        ([v, label]) =>
          `<button data-key="${esc(key)}" data-val="${esc(v)}" ${chosen !== undefined ? 'disabled' : ''} class="${chosen === v ? 'chosen' : ''}">${esc(label)}</button>`,
      )
      .join('')}</div></div>`;
  };
  const partyLinks = (pg.parties ?? []).flatMap((id) => {
    const detail = partyCard(st, id);
    return detail ? [`<a href="#party-${esc(id)}">${esc(detail.host)} (${esc(detail.night)})</a>`] : [];
  });
  const parts: string[] = [];
  if (pg.parties?.length) {
    parts.push(
      '<p class="soft party-note">A promise kept pays and brings them back; a promise broken is a strike on Saturday.</p>',
    );
    for (const id of pg.parties) {
      const party = partyOf(id);
      const detail = partyCard(st, id);
      if (!party || !detail) continue;
      const key = `promise:${id}`;
      parts.push(
        `<section class="card party-card" id="party-${esc(id)}" tabindex="-1" aria-label="${esc(detail.host)}"><p>${esc(party.booked)}</p><p class="party-time">${esc(detail.night)} · ${clock(detail.at)} · out by ${clock(detail.servedBy)}</p><p>${esc(detail.order)}</p><p>Promise: ${esc(detail.signature)}</p>${detail.cook ? `<p class="hand"><b>${esc(nameOf(st, detail.cook.who))}</b>: “${esc(detail.cook.text)}”</p>` : ''}<div class="row">${[
          ['promise', 'Promise it'],
          ['plain', 'As it comes'],
        ]
          .map(
            ([value, label]) =>
              `<button data-key="${esc(key)}" data-val="${value}" aria-pressed="${pg.chosen[key] === value}" ${pg.chosen[key] !== undefined ? 'disabled' : ''} class="${pg.chosen[key] === value ? 'chosen' : ''}">${label}</button>`,
          )
          .join('')}</div></section>`,
      );
    }
  }
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
            `<button data-key="hire" data-val="${esc(v)}" ${pg.chosen.hire !== undefined ? 'disabled' : ''} class="${pg.chosen.hire === v ? 'chosen' : ''}">${esc(label)}</button>`,
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
  app.innerHTML = `<div class="page sunday-page">
    ${topBar(`Sunday · week ${pg.week}`, 'sunday')}
    <div class="page-body">
    <h2>Sunday, week ${pg.week}</h2>
    ${partyLinks.length ? `<nav class="party-jumps" aria-label="Next week’s parties">Two parties next week: ${partyLinks.join(' and ')}. Choose on each card.</nav>` : ''}
    <p class="soft">${esc(weekOf(pg.week).title)}. The lokanta is closed. I sit at the staff table with the notebook.</p>
    ${parts.join('')}
    ${stamps ? `<p class="soft">This week in the notebook:</p>${stamps}` : ''}
    ${nextWeek ? `<p>Next week: ${lira(nextWeek.bill)} for ${esc(nextWeek.owed)}${st.carry ? `, and ${lira(st.carry)} carried over` : ''}${st.seen ? `, and ${lira(st.seen)} more: ${esc(SEEN_WHO[pg.week] ?? 'they')} saw the queue on Saturday` : ''}.</p>` : ''}
    </div>
    <div class="actions">
      <button class="primary" id="open">${esc(sundayOpenLabel(st, firstPartyStart))}</button>
    </div>
  </div>`;
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-key]'))
    b.addEventListener('click', () => {
      queueInput(st, { kind: 'choose', key: b.dataset.key as string, value: b.dataset.val as string });
      writeSave();
      const scroll = window.scrollY;
      sunday();
      window.scrollTo(0, scroll);
    });
  document.getElementById('open')?.addEventListener('click', () => {
    queueInput(st, { kind: 'open' });
    if (firstPartyStart && pg.week === 1) {
      const target = firstPartyBoard(st);
      partyHandover = { party: target.party, night: target.night, at: target.at, promised: target.promised };
    }
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
    body = `${b && b.short > 0 ? `${capital(b.owed)} wanted ${lira(b.amount)}, and I was ${lira(b.short)} short. ` : ''}${b?.promiseBroken ? 'A promise broken this week: one strike. ' : ''}The man from the döner chain called the same afternoon. I said I would think about it. ${nights} nights at Nevin’s.`;
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
  app.innerHTML = `<div class="page ending-page">
    ${topBar('The notebook', 'end')}
    <div class="page-body">
    <h2>${esc(head)}</h2>
    <p>${esc(body)}</p>
    <p>${esc(together)}</p>
    <details class="ending-reckoning"><summary>See the tally</summary><div id="ending-tally">${endingTally(st, true)}</div></details>
    ${gone.length ? `<p class="soft">Gone from the kitchen: ${gone.map((m) => esc(m.name)).join(', ')}.</p>` : ''}
    <h2 class="hand" style="font-size:28px">What the crew said about me</h2>
    ${lastLines.map((l) => `<div class="cookline"><b>${esc(nameOf(st, l.id))}</b><div class="hand">“${esc(l.t)}”</div></div>`).join('')}
    ${st.stamps.length ? `<p class="soft">The notebook:</p>${stampList(st.stamps.map((x) => x.id))}` : ''}
    </div>
    <div class="actions">
      <div class="end-secondaries"><button id="send">Send word</button><button id="export">Download this run</button></div>
      <button class="primary" id="again">A new notebook</button>
    </div>
  </div>`;
  document.getElementById('export')?.addEventListener('click', download);
  document.getElementById('send')?.addEventListener('click', sendRun);
  document.getElementById('again')?.addEventListener('click', () => title());
  window.scrollTo(0, 0);
}

function sendRun() {
  if (!s) return;
  menuOpen = true;
  openFeedback({
    lab,
    getRun: () => cast.run(),
    chooseRecording: cast.chooseRecording,
    download,
    onBack: () => {
      menuOpen = false;
      last = performance.now();
    },
  });
}

function download() {
  if (!s) return;
  const ex = cast.run();
  const blob = new Blob([JSON.stringify(ex)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `the-pass-${s.seed}-night${s.night}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function returnPage() {
  if (!s?.returnChapter) return;
  cancelAnimationFrame(raf);
  app.innerHTML = `<div class="page"><div class="page-body">${topBar('Zeynep returns', 'end')}
    <h1>Zeynep returns</h1><p>Her cold-food trial is over. What she learned stays with her. Her sons still expect her home each evening.</p>
    <p>${esc(String((s.returnChapter.envelope.transfer.history as { id: string; summary: string }[]).find((f) => f.id === 'goodhands-encounter')?.summary ?? 'The household answer remains in this chapter’s notebook.'))}</p><p>Chef has released her kitchen shifts. This chapter gives her no new job.</p>
    <div class="actions"><button id="export">Download this chapter</button><button id="send">Send word</button><button id="fresh">Begin a fresh kitchen</button></div></div></div>`;
  document.getElementById('export')?.addEventListener('click', download);
  document.getElementById('send')?.addEventListener('click', sendRun);
  document.getElementById('fresh')?.addEventListener('click', () => title());
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
  draw: () => drawAll(),
  step: (n: number) => {
    for (let i = 0; i < n && s && s.phase === 'service'; i++) step(s);
  },
  get state() {
    return s;
  },
  closeAt,
  chefLine,
  LAST_NIGHT,
  WEEKDAYS,
  Station: null as Station | null,
};
