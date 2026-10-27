import { required } from '../required.ts';
import { episodeText, INVITATIONS } from '../sim/cast-scenes.ts';
import { attentionAvailable, FOLLOWUP_EDITION, heardTopic, kitchenEdition } from '../sim/kitchen-edition.ts';
import { NARRATION_EDITION } from '../sim/narration-edition.ts';
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
import { replayExport, validateReplayFile } from '../sim/continuation.ts';
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
  contactAvailable,
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
  inKitchen,
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
import { automaticClockPlayback, inspectingCook, SPEED_NAMES } from './clock.ts';
import { type ContinuitySave, continuity, guardedContinuity } from './continuity.ts';
import { portionEdition } from './editions.ts';
import { openFeedback } from './feedback.ts';
import { handoverContext, handoverHands, sundayOpenLabel } from './first-party.ts';
import { lab, mountNotice } from './lab.ts';
import { endingTally } from './notebook.ts';
import { closingChoices, offerUnavailable } from './people-offers.ts';
import { unseenSpeech } from './speech.ts';
import { actionableStaffing, availableStaffing } from './staffing.ts';
import { journalWords, noCoverWords, serviceStatus, tableAboutToLeave } from './status.ts';
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
  plainNarration?: boolean;
  continuity?: ContinuitySave;
  returnChapter?: Export['returnChapter'];
  castChapter?: Export['castChapter'];
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
const highlightedLines = new WeakSet<Said>();
const LOG_HIGHLIGHT_MS = 4_000;
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
      plainNarration: s.plainNarration === true,
      seed: s.seed,
      inputs: s.inputs,
      minute: s.minute,
      pages,
      firstPartyStart,
      partyHandover,
      continuity: cast.data(),
      returnChapter: s.returnChapter,
      castChapter: s.castChapter,
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
  (s?.version === 'pass@13' || (s && kitchenEdition(s)) ? episodeText(gloss(x)) : gloss(x)).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string,
  );
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
    'Tap a cook, then tap a job. Hold the job button to insist. A cook can say no. A promise means a party’s food comes first. With Nevin’s pace, tables wait longer before they leave. Money is in Turkish lira.',
  ],
  board: [
    'Tonight’s plan',
    'Each cook has a station and a 20-minute meal break. During a break, another cook can work at that station in their place. That cook leaves their own station empty while they do it. If you change the plan, each cook can agree or refuse before the doors open.',
  ],
  service: [
    'Running the pass',
    'The pass is the counter where finished food waits to be served. To give a cook a job, tap the cook and then tap the job. To insist, hold the job button down. Insisting can cost you some of the cook’s trust. The words under each job are your guess at how the cook will answer. A ● means a dish is ready to serve. The bar at the top shows the money taken tonight. The mark on the bar shows how much you need tonight to pay Saturday’s bill. Time slows down when someone speaks to you or needs an answer.',
  ],
  evening: [
    'The night',
    'The pace line shows the money still needed, divided by the nights left this week. The till is the money taken at the restaurant. The bill is paid from the till at closing time on Saturday.',
  ],
  sunday: [
    'Sunday',
    'Your Sunday choices take effect next week. A broken promise counts as a strike against the restaurant.',
  ],
  end: [
    'The tally',
    'The tally is the number of tables served, minus the tables that left without eating, plus ten for each bill you paid. This is the game’s own way of scoring.',
  ],
};
function topBar(label: string, phase: string): string {
  const [heading, text] = INFO[phase] ?? required(INFO.title);
  return `<header class="lab-topbar"><span class="bar-words">${phase === 'title' ? '<a href="https://human.adamwhite.work/games/">All games</a>' : esc(label)}</span>${phase === 'service' ? '<span class="clock" id="clock"></span>' : ''}${s && (s.version === 'pass@13' || kitchenEdition(s)) && phase !== 'title' ? '<button id="people">People</button>' : ''}<button class="info-button" popovertarget="phase-help" aria-label="Information">i</button><button id="game-menu" class="menu-trigger" aria-label="Game menu">≡</button></header><div id="phase-help" popover="auto" class="info-popover"><button class="info-close" popovertarget="phase-help" popovertargetaction="hide" aria-label="Close information">×</button><h2>${heading}</h2><p>${esc(text)}</p></div>`;
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
      amount:
        st.phase === 'board'
          ? st.till
          : replay(st.seed, before, start, st.version, st.castChapter, st.plainNarration === true).till,
    };
  const tonight = tillStart.amount;
  const per = Math.ceil(Math.max(0, target - tonight) / Math.max(1, nights) / 10) * 10;
  const tick = Math.min(100, Math.max(0, ((tonight + per) / target) * 100));
  const progress = Math.min(100, Math.max(0, (st.till / target) * 100));
  return `<div class="till-bar"><span>${lira(st.till)}</span><span class="till-track" aria-label="Progress toward Saturday’s bill"><span style="width:${progress}%"></span><i style="left:${tick}%"></i></span><span class="till-label">${lira(target)} due Saturday</span></div>`;
}
function openGameMenu() {
  if (menuOpen) return;
  const saved = writeSave();
  menuOrigin = document.getElementById('game-menu') ?? (document.activeElement as HTMLElement);
  menuOpen = true;
  const dialog = document.createElement('dialog');
  dialog.className = 'game-menu-dialog';
  dialog.setAttribute('aria-label', 'Game menu');
  dialog.innerHTML = `<div class="menu-heading"><h2>Game menu <small>${s ? `· ${esc(planOf(s.night).title)}, week ${planOf(s.night).week} · ${clock(s.minute)}` : '· The Pass'}</small></h2><button id="menu-close" aria-label="Close menu">×</button></div><p id="save-result" role="status">${s ? (saved === false ? 'This device could not save your game. You can keep a copy of it through Feedback.' : 'The game is paused while this menu is open.') : 'No game has started.'}</p><div class="menu-rows"><button id="send-run">Feedback</button><button id="full-screen">Full screen</button><button id="menu-new">New game</button><div id="menu-new-confirm" hidden><p>Start a new game? This replaces your saved game.</p><button id="menu-new-yes">Start new game</button><button id="menu-new-no">Cancel</button></div><a href="https://human.adamwhite.work/games/">All games</a></div><div id="record-controls"><a href="${PRIVACY_URL}" target="_blank" rel="noopener">Lab privacy</a></div><button class="primary" id="menu-back">Resume</button>`;
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
  dialog.querySelector('#menu-new')?.addEventListener('click', () => {
    (dialog.querySelector('#menu-new-confirm') as HTMLElement).hidden = false;
  });
  dialog.querySelector('#menu-new-no')?.addEventListener('click', () => {
    (dialog.querySelector('#menu-new-confirm') as HTMLElement).hidden = true;
  });
  dialog.querySelector('#menu-new-yes')?.addEventListener('click', async () => {
    const button = dialog.querySelector('#menu-new-yes') as HTMLButtonElement;
    button.disabled = true;
    try {
      const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
      const fresh = await cast.fresh(seed);
      clearSave();
      s = fresh;
      cast.track();
      writeSave();
      dialog.close();
      enter();
    } catch (error) {
      console.error('New game failed', error);
      button.disabled = false;
      (dialog.querySelector('#save-result') as HTMLElement).textContent =
        'The new game could not start. Your current game is safe. You can try New game again, or send Feedback.';
    }
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
  if (s?.phase === 'service') {
    const speeds = document.createElement('fieldset');
    speeds.id = 'menu-speed';
    speeds.innerHTML = `<legend>Kitchen speed</legend>${SPEED_NAMES.map((name, i) => `<button data-speed="${i}" aria-pressed="${i === speed}">${name}</button>`).join(' ')}`;
    speeds.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-speed]');
      if (!button) return;
      speed = Number(button.dataset.speed);
      carry = 0;
      for (const option of speeds.querySelectorAll<HTMLButtonElement>('[data-speed]'))
        option.setAttribute('aria-pressed', String(Number(option.dataset.speed) === speed));
      drawTop();
    });
    dialog.querySelector('.menu-rows')?.append(speeds);
  }
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
  dialog.querySelector('#record-controls')?.prepend(recording);
  const debug = document.createElement('details');
  debug.className = 'debug-tools';
  debug.innerHTML = `<summary>Debug</summary><div><button id="debug-export" ${s ? '' : 'disabled'}>Export run</button><button id="debug-verify" ${s ? '' : 'disabled'}>Verify replay</button><button id="debug-import">Import run</button><p>Seed: ${s?.seed ?? 'no game'}</p><p id="debug-result" role="status"></p></div>`;
  debug.querySelector('#debug-export')?.addEventListener('click', download);
  debug.querySelector('#debug-verify')?.addEventListener('click', async () => {
    try {
      const ex = cast.run();
      if (!ex) return;
      const replayed = await validateReplayFile(ex);
      required(debug.querySelector('#debug-result')).textContent =
        fingerprint(replayed) === fingerprint(required(s))
          ? 'The replay matches this game.'
          : 'The replay does not match this game.';
    } catch {
      required(debug.querySelector('#debug-result')).textContent = 'This run could not be verified.';
    }
  });
  debug.querySelector('#debug-import')?.addEventListener('click', () => {
    dialog.close();
    title();
    document.getElementById('file')?.click();
  });
  const privacy = required(dialog.querySelector('#record-controls a'));
  const diagnostics = document.createElement('div');
  diagnostics.style.display = 'flex';
  diagnostics.style.alignItems = 'baseline';
  diagnostics.style.gap = '12px';
  diagnostics.append(privacy, debug);
  dialog.querySelector('#record-controls')?.append(diagnostics);
  document.body.append(dialog);
  dialog.showModal();
}
function openPeople() {
  if (!s || menuOpen) return;
  menuOpen = true;
  const dialog = document.createElement('dialog');
  dialog.className = 'people-dialog';
  dialog.setAttribute('aria-label', 'People');
  dialog.innerHTML =
    '<h2>People</h2><p>You do not have to have these conversations or make these work offers.</p><button id="people-close">Resume</button>';
  dialog.querySelector('#people-close')?.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    dialog.remove();
    menuOpen = false;
    last = performance.now();
  });
  if (s?.version === 'pass@13' || (s && kitchenEdition(s))) {
    const actions = document.createElement('section');
    if (s.night === 1 && s.phase === 'board')
      for (const id of Object.keys(s.castChapter?.actors ?? {})) {
        if (s.crew.some((m) => m.id === id) || s.inputs.some((i) => i.kind === 'cast-invite' && i.who === id))
          continue;
        const invite = document.createElement('button');
        invite.textContent = `Offer ${required(required(s.castChapter).actors[id]).name} paid work in the kitchen. They keep their own hours for leaving.${required(s.castChapter).facts[id]?.startsAtHome ? ' First, offer to share a meal with them.' : ''}`;
        invite.onclick = () => {
          if (!s) return;
          queueInput(s, { kind: 'cast-invite', who: id });
          writeSave();
          dialog.close();
          enter();
        };
        actions.append(invite);
      }
    for (const m of s.crew.filter((m) => !m.left)) {
      if (cookOf(s, m.id).here && !cookOf(s, m.id).gone) {
        const b = document.createElement('button');
        b.textContent = INVITATIONS[m.id] ?? `Talk with ${m.name}`;
        const unavailable = offerUnavailable(s, m.id);
        b.disabled = unavailable !== null;
        const explanation = document.createElement('p');
        explanation.textContent = unavailable ?? '';
        explanation.id = `offer-reason-${m.id}`;
        if (unavailable) b.setAttribute('aria-describedby', explanation.id);
        b.onclick = () => {
          if (!s) return;
          const before = s.said.length;
          queueInput(s, { kind: 'cast-talk', who: m.id, choice: 'listen' });
          writeSave();
          const answer = document.createElement('section');
          answer.setAttribute('role', 'status');
          answer.setAttribute('tabindex', '-1');
          const lines = s.said.slice(before);
          answer.textContent = lines.length
            ? lines.map((line) => `${nameOf(s as GameState, line.who)}: ${gloss(line.text)}`).join(' ')
            : `${m.name} cannot talk now. Ask when they are free.`;
          b.after(answer);
          b.disabled = true;
          explanation.textContent = offerUnavailable(s, m.id) ?? '';
          answer.focus();
        };
        actions.append(b, explanation);
        const decline = document.createElement('button');
        decline.textContent = `Talk with ${m.name} another time`;
        decline.onclick = () => {
          if (!s) return;
          queueInput(s, { kind: 'cast-talk', who: m.id, choice: 'leave' });
          writeSave();
          dialog.close();
        };
        actions.append(decline);
      }
      if (['evening', 'sunday', 'end'].includes(s.phase)) {
        const release = document.createElement('button');
        release.textContent = `End ${m.name}’s time working in the kitchen`;
        release.onclick = () => {
          if (!s) return;
          queueInput(s, { kind: 'cast-release', who: m.id });
          writeSave();
          void cast.checkpoint();
          release.disabled = true;
        };
        actions.append(release);
      }
    }
    dialog.append(actions);
  }
  document.body.append(dialog);
  dialog.showModal();
}
document.addEventListener('click', (event) => {
  if ((event.target as Element).closest('#game-menu')) openGameMenu();
  if ((event.target as Element).closest('#people')) openPeople();
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
      <h1>The Pass</h1><p class="soft title-subtitle">Run a restaurant kitchen for four weeks.</p>
      <p>You have taken over Nevin’s small restaurant. You give the cooks their jobs. They can refuse.</p>
      <p>The bank wants ${lira(w1.bill)} (Turkish lira) by closing time on Saturday.</p>
      ${old ? '<p class="soft">The game has changed since you last played. Your old saved game cannot be opened. Start a new game instead.</p>' : ''}
      <fieldset class="start-approaches"><legend>How long will customers wait?</legend>
        <label><input type="radio" name="pace" value="nevin" /><span>Selim suggests a longer wait.<small>Nevin’s pace gives customers more time to wait for all four weeks.</small></span></label>
        <label><input type="radio" name="pace" value="normal" checked /><span>Dilek suggests the normal wait.<small>Customers wait the usual amount of time.</small></span></label>
      </fieldset>
      <button id="other-ways" aria-haspopup="dialog">Other ways to begin</button>
      <p id="title-status" role="status" aria-live="polite"></p>
      <div id="title-confirm" class="inline-confirm" hidden><p id="title-confirm-message"></p><div class="row"><button id="title-confirm-yes">Continue</button><button id="title-confirm-no">Keep this game</button></div></div>
    </div>
    <div class="actions">
      ${save ? `<button class="primary" id="cont">Resume <span class="soft">(${esc(weekTitle(replayNight(save)))})</span></button><button id="new">New game</button>` : '<button class="primary" id="new">New game</button>'}
    </div>
    <dialog id="other-ways-sheet" class="other-ways-sheet" aria-labelledby="other-ways-heading"><h2 id="other-ways-heading">Other ways to begin</h2><div class="actions">
      <button id="week-two">Begin at the second week</button><p class="soft">An experienced helper runs the first week for you. You take over on the Sunday after it.</p>
      <button id="first-party">Begin at the first party</button><p class="soft">Choose the promises on Sunday and take the pass before the first party sits.</p>
      ${turnBack}<button id="close-other-ways">Back</button>
    </div></dialog>
    <input type="file" id="file" accept="application/json" hidden />
    ${footer()}
  </div>`;
  mountNotice();
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
    if (sheet?.open) sheet.close();
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
      await cast.restore(guardedContinuity(restored, save.continuity), false, true, restored);
      firstPartyStart = save.firstPartyStart ?? false;
      partyHandover = save.partyHandover ?? null;
      pages = save.pages ?? [];
      s = restored;
      cast.track();
      enterWithStatus();
    } catch {
      status(
        'Your saved game could not be opened. It is still saved. You can try Resume again, start a new game, or send Feedback from the menu.',
      );
    }
  });
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-page]'))
    b.addEventListener('click', () => {
      if (!save) return;
      const week = Number(b.dataset.page);
      const page = save.pages.find((p) => p.week === week);
      if (!page) return;
      ask(`Go back to Sunday of week ${week}? Everything you played after that Sunday will be lost.`, () => {
        void (async () => {
          const restored = replayExport({
            ...save,
            inputs: save.inputs.slice(0, page.k),
            minute: undefined,
          } as unknown as Export);
          await cast.restore(undefined, true, true, restored);
          firstPartyStart = save.firstPartyStart ?? false;
          partyHandover = null;
          pages = save.pages.filter((p) => p.week <= week);
          s = restored;
          cast.track();
          writeSave();
          enterWithStatus();
        })().catch(() => status('That Sunday could not be loaded.'));
      });
    });
  const begin = (secondWeek: boolean, firstParty = false) => {
    const start = () => {
      void (async () => {
        const nevin = app.querySelector<HTMLInputElement>('input[name="pace"]:checked')?.value === 'nevin';
        const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
        const returning = !secondWeek ? await cast.fresh(seed) : null;
        if (secondWeek) await cast.local();
        clearSave();
        firstPartyStart = firstParty;
        s =
          returning ??
          (secondWeek
            ? beginAtWeekTwo(seed, nevin ? 'nevin' : undefined, 'pass@17')
            : newGame(seed, 'pass@17'));
        cast.track();
        if (!secondWeek && nevin && s.inputs.length === 0) queueInput(s, { kind: 'pace', value: 'nevin' });
        writeSave();
        enterWithStatus(cast.message);
      })().catch((error: unknown) => {
        console.error('New game failed', error);
        status(
          'The game could not start. Your saved game is safe. You can try New game again, or send Feedback from the menu.',
        );
      });
    };
    if (save) ask('Start a new game? This replaces your saved game.', start);
    else start();
  };
  document.getElementById('new')?.addEventListener('click', () => begin(false));
  document.getElementById('week-two')?.addEventListener('click', () => begin(true));
  document.getElementById('first-party')?.addEventListener('click', () => begin(true, true));
  const file = document.getElementById('file') as HTMLInputElement;
  document.getElementById('load')?.addEventListener('click', () => file.click());
  file?.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    if (sheet?.open) sheet.close();
    try {
      const ex = JSON.parse(await f.text()) as Export & { minute?: number };
      if (!canReplay(ex.game)) {
        status(
          `This file comes from an older version of The Pass (${ex.game ?? 'unknown'}). This version is ${GAME_VERSION}. The file cannot be loaded. Start a new game instead.`,
        );
        return;
      }
      const r = await validateReplayFile(ex);
      const same = ex.state ? fingerprint(r) === fingerprint(ex.state) : true;
      const load = () => {
        void (async () => {
          if (!same) {
            status(
              'This file does not replay the same way in this version of The Pass. It may come from an older version. The file was not loaded. Start a new game instead.',
            );
            return;
          }
          await cast.restore(
            guardedContinuity(r, (ex as Export & { continuity?: ContinuitySave }).continuity),
            true,
            false,
            r,
          );
          s = r;
          cast.track();
          firstPartyStart = false;
          partyHandover = null;
          pages = [];
          writeSave();
          enterWithStatus('The game was replayed. It matches the saved game in the file.');
        })().catch(() => status('That file could not be loaded.'));
      };
      if (save) ask('Load this game? It replaces your saved game.', load);
      else load();
    } catch {
      status('That file is not a saved game from The Pass.');
    }
  });
}

/** Which night a save is on, without replaying it: the number of 'open' inputs that moved to a new night. */
function replayNight(sv: Save): number {
  let n = 1;
  let sunday = false;
  let atBoard = [
    'pass@5',
    'pass@6',
    'pass@7',
    'pass@8',
    'pass@9',
    'pass@10',
    'pass@11',
    'pass@12',
    'pass@13',
    'pass@14',
    'pass@15',
    'pass@16',
    'pass@17',
  ].includes(sv.game);
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
      atBoard = [
        'pass@5',
        'pass@6',
        'pass@7',
        'pass@8',
        'pass@9',
        'pass@10',
        'pass@11',
        'pass@12',
        'pass@13',
        'pass@14',
        'pass@15',
        'pass@16',
        'pass@17',
      ].includes(sv.game);
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
    dish: 'dishes',
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
      return `<p>${esc(party.host.charAt(0).toUpperCase() + party.host.slice(1))}’s party arrives at ${clock(booking.at)}. ${overlaps.length ? `${changed ? 'Proposed breaks' : 'Breaks'} during the party: ${overlaps.map((row) => `${esc(nameOf(st, row.cook))}’s break, ${clock(row.breakAt)}–${clock(row.breakAt + 20)}`).join('; ')}.` : `${changed ? 'In your proposed plan, no' : 'No'} breaks fall during the party.`}</p>`;
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
    ? `<p class="board-uncovered">Nobody is working at the ${bare.map((place) => stationName[place]).join(' or the ')} tonight.${bare.includes('oven') ? ' Flatbread bakes only in a hot oven. The oven stays hot only while a cook stands at it. I cannot look after the oven and cook as well.' : ''} Give someone that station, or those tables will have to wait.</p>`
    : '';
  const boardScroll = app.querySelector('.board-body')?.scrollTop ?? 0;
  const editorScroll = app.querySelector('.board-editor-body')?.scrollTop ?? 0;
  let editor = '';
  app.innerHTML = `<div class="board-page people-board">${topBar(`${planOf(st.night).title}, week ${planOf(st.night).week} · Doors open at ${clock(openAt(st.night))}`, 'board')}${tillBar(st)}<form id="board-form"><div class="board-body">${bareNote}${parties ? `<div class="board-parties">${parties}</div>` : ''}<div class="board-rows">${rows
    .map((row) => {
      const answer = agreed.find((r) => r.cook === row.cook);
      const revised = changed;
      const coverRow = rows.find((r) => r.cook === row.cover);
      const station = stationName[row.station];
      const tradeoff = coverRow ? `Nobody will work at the ${stationName[coverRow.station]}` : '';
      // Keep an imported choice visible even if another edit makes its interval conflict.
      const covers = rows.filter(
        (other) =>
          other.cook !== row.cook &&
          (other.cook === row.cover || Math.abs(other.breakAt - row.breakAt) >= 20),
      );
      const alternatives = covers.map(
        (other) =>
          `${nameOf(st, other.cook)} could take over, but then nobody would work at the ${stationName[other.station]}.`,
      );
      const gap = row.cover
        ? revised
          ? `You will ask ${nameOf(st, row.cover)} to work at the ${station} in ${nameOf(st, row.cook)}’s place. ${tradeoff} for those twenty minutes.`
          : answer?.coverAccepted
            ? `${nameOf(st, row.cover)} will work at the ${station} in ${nameOf(st, row.cook)}’s place. ${tradeoff} for those twenty minutes.`
            : `${nameOf(st, row.cover)} has not agreed to take over. Nobody will work at the ${station} while ${nameOf(st, row.cook)} eats.`
        : `${covers.length ? 'You have not chosen anyone to take over' : 'Nobody is free to take over'}. Nobody will work at the ${station} while ${nameOf(st, row.cook)} eats.${alternatives.length ? ` ${alternatives.join(' ')}` : ''}`;
      const coverSummary = row.cover
        ? revised
          ? `you will ask ${nameOf(st, row.cover)} to take over`
          : answer?.coverAccepted
            ? `${nameOf(st, row.cover)} will take over`
            : `${nameOf(st, row.cover)} has not agreed to take over. Nobody will work at the ${station} during the break.`
        : `Nobody will work at the ${station} during the break.`;
      const summary = `${nameOf(st, row.cook)} will work at the ${station}. The meal break is at ${clock(row.breakAt)}, for 20 minutes. ${capital(coverSummary)}${coverSummary.endsWith('.') ? '' : '.'}`;
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
          'Meal break: 20 minutes',
          breakSlots(answer?.breakAt ?? row.breakAt).map((slot) => ({
            value: String(slot.minute),
            label: slot.label,
          })),
          String(row.breakAt),
        )}${chips(row, 'cover', 'Who takes over', [...covers.map((other) => ({ value: other.cook, label: nameOf(st, other.cook) })), { value: '', label: 'Nobody' }], row.cover ?? '')}</div><p class="board-gap">${esc(gap)}</p></div><footer><button type="button" id="board-done" class="primary">Done</button></footer></section></div>`;
      }
      return `<section class="board-row" data-board-cook="${esc(row.cook)}"><h2>${esc(nameOf(st, row.cook))}</h2><p class="board-summary">${esc(summary)}</p><button class="board-change" type="button" aria-expanded="${editing === row.cook}" aria-controls="board-fields-${esc(row.cook)}">Change</button>${answer?.answer ? `<div class="board-answer hand"><b>${revised ? 'Waiting for a new answer. Previous answer' : answer.accepted ? 'Agreed' : 'Refused or asked for a change'}.</b> “${esc(gloss(answer.answer))}”</div>` : ''}</section>`;
    })
    .join(
      '',
    )}</div></div><div class="actions">${changed ? '<button class="primary" id="ask-board" type="submit">Ask them about the changes</button>' : '<button class="primary" type="button" id="open-service">Open the doors</button>'}${st.previousBoard?.length ? '<button type="button" id="same-board">Same plan as last night</button>' : ''}</div></form>${editor}</div>`;
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
      dish: 'dishes',
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
        return `<p>${esc(party.host.charAt(0).toUpperCase() + party.host.slice(1))}’s party arrives at ${clock(booking.at)}. ${overlaps.length ? `${changed ? 'Proposed breaks' : 'Breaks'} during the party: ${overlaps.map((row) => `${esc(nameOf(st, row.cook))}’s break, ${clock(row.breakAt)}–${clock(row.breakAt + 20)}`).join('; ')}.` : `${changed ? 'In your proposed plan, no' : 'No'} breaks fall during the party.`}</p>`;
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
      ? `<p class="board-uncovered">Nobody is working at the ${bare.map((place) => stationName[place]).join(' or the ')} tonight.${bare.includes('oven') ? ' Flatbread bakes only in a hot oven. The oven stays hot only while a cook stands at it. I cannot look after the oven and cook as well.' : ''} Give someone that station, or those tables will have to wait.</p>`
      : '';
    app.innerHTML = `<div class="page board-page">${markLink}<h1>Tonight’s plan</h1><p>${esc(weekTitle(st.night))} · Doors open at ${clock(openAt(st.night))}</p>${bareNote}${parties ? `<div class="board-parties">${parties}</div>` : ''}<form id="board-form"><div class="board-rows">${rows
      .map((row) => {
        const answer = agreed.find((r) => r.cook === row.cook);
        const revised = changed;
        const coverRow = rows.find((r) => r.cook === row.cover);
        const station = stationName[row.station];
        const tradeoff = coverRow ? `Nobody will work at the ${stationName[coverRow.station]}` : '';
        // Keep an imported choice visible even if another edit makes its interval conflict.
        const covers = rows.filter(
          (other) =>
            other.cook !== row.cook &&
            (other.cook === row.cover || Math.abs(other.breakAt - row.breakAt) >= 20),
        );
        const alternatives = covers.map(
          (other) =>
            `${nameOf(st, other.cook)} could take over, but then nobody would work at the ${stationName[other.station]}.`,
        );
        const gap = row.cover
          ? revised
            ? `You will ask ${nameOf(st, row.cover)} to work at the ${station} in ${nameOf(st, row.cook)}’s place. ${tradeoff} for those twenty minutes.`
            : answer?.coverAccepted
              ? `${nameOf(st, row.cover)} will work at the ${station} in ${nameOf(st, row.cook)}’s place. ${tradeoff} for those twenty minutes.`
              : `${nameOf(st, row.cover)} has not agreed to take over. Nobody will work at the ${station} while ${nameOf(st, row.cook)} eats.`
          : `${covers.length ? 'You have not chosen anyone to take over' : 'Nobody is free to take over'}. Nobody will work at the ${station} while ${nameOf(st, row.cook)} eats.${alternatives.length ? ` ${alternatives.join(' ')}` : ''}`;
        const coverSummary = row.cover
          ? revised
            ? `you will ask ${nameOf(st, row.cover)} to take over`
            : answer?.coverAccepted
              ? `${nameOf(st, row.cover)} will take over`
              : `${nameOf(st, row.cover)} has not agreed to take over. Nobody will work at the ${station} during the break.`
          : `Nobody will work at the ${station} during the break.`;
        const summary = `${VERB_LABEL[row.station]} · Break at ${breakSlots(row.breakAt).find((slot) => slot.minute === row.breakAt)?.label} · ${coverSummary}`;
        return `<fieldset class="board-row${editing === row.cook ? ' is-editing' : ''}" data-board-cook="${esc(row.cook)}"><legend>${esc(nameOf(st, row.cook))}</legend><p class="board-summary">${esc(summary)}</p><button class="board-change" type="button" aria-expanded="${editing === row.cook}" aria-controls="board-fields-${esc(row.cook)}">${editing === row.cook ? 'Done' : 'Change'}</button><div class="board-editor" id="board-fields-${esc(row.cook)}"><div class="board-fields">${chips(
          row,
          'station',
          'Station',
          stationsTonight(st).map((station) => ({ value: station, label: VERB_LABEL[station] })),
          row.station,
        )}${chips(
          row,
          'break',
          'Meal break: 20 minutes',
          breakSlots(answer?.breakAt ?? row.breakAt).map((slot) => ({
            value: String(slot.minute),
            label: slot.label,
          })),
          String(row.breakAt),
        )}${chips(row, 'cover', 'Who takes over', [...covers.map((other) => ({ value: other.cook, label: nameOf(st, other.cook) })), { value: '', label: 'Nobody' }], row.cover ?? '')}</div><p class="board-gap">${esc(gap)}</p></div>${answer?.answer ? `<div class="board-answer hand"><b>${revised ? 'Waiting for a new answer. Previous answer' : answer.accepted ? 'Agreed' : 'Refused or asked for a change'}.</b> “${esc(gloss(answer.answer))}”</div>` : ''}</fieldset>`;
      })
      .join(
        '',
      )}</div><div class="actions"><button class="primary" type="button" id="open-service" ${changed ? 'disabled' : ''}>Open the doors</button>${changed ? '<button class="primary" id="ask-board" type="submit">Ask them about the changes</button>' : ''}${st.previousBoard?.length ? '<button type="button" id="same-board">Same plan as last night</button>' : ''}</div></form><button type="button" class="info-button" popovertarget="board-help" aria-label="About tonight’s plan">i</button><div id="board-help" popover="auto" class="info-popover"><h2>About tonight’s plan</h2><p>When a cook agrees to a station, they stay there until closing time. A cook who takes over during a break works there until the other cook comes back. A cook can refuse part of the plan. Their answer stays on the plan. You can change the plan, or open the doors with that station empty.</p><p>Money is in Turkish lira (${lira(1)}).</p></div>${footer()}</div>`;
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
    ${kitchenEdition(s) ? '<aside id="kitchen-stock" class="soft"></aside>' : ''}
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
    app.innerHTML = `<div class="service people-service ${kitchenEdition(s) ? 'kitchen-service' : ''}">
    ${topBar('', 'service')}<div class="state-strip" id="till"></div>
    ${kitchenEdition(s) ? '<aside id="kitchen-stock" class="soft"></aside>' : ''}
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

/** Seconds after tapping a cook during which the clock stays at reading pace while you choose. */
const SELECT_GRACE_MS = 6000;
let selectedAt = 0;

function inspectingNow() {
  if (!s || !selected) return false;
  const now = performance.now();
  const b = bubbles[selected];
  const speaking = !!b && b.until > now && s.minute - b.minute <= 6;
  return inspectingCook(s, selected, speaking || now - selectedAt < SELECT_GRACE_MS);
}

function livePlayback(st: GameState, view: { reading: boolean; inspecting: boolean }) {
  return automaticClockPlayback(st, view, speed);
}

function frame(t: number) {
  if (!s) return;
  const elapsed = Math.max(0, t - last);
  const dt = Math.min(0.25, elapsed / 1000);
  last = t;
  const held = menuOpen || !!document.querySelector('.hflab-veil, :popover-open');
  if (held) {
    if (readingUntil > t - elapsed) readingUntil += elapsed;
    if (selectedAt > t - elapsed - SELECT_GRACE_MS) selectedAt += elapsed;
    for (const bubble of Object.values(bubbles)) if (bubble.until > t - elapsed) bubble.until += elapsed;
  }
  if (s.phase === 'service' && !held) {
    const { rate } = livePlayback(s, { reading: t < readingUntil, inspecting: inspectingNow() });
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
      const next = livePlayback(s, { reading: speaking, inspecting: inspectingNow() });
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
  const fresh = unseenSpeech(s.said, shownSaid);
  for (const x of fresh) {
    highlightedLines.add(x);
    if (x.who !== 'narrator' && x.kind !== 'journal')
      bubbles[x.who] = { text: x.text, until: performance.now() + READING_MS, minute: x.at };
  }
  shownSaid = s.said.at(-1);
  if (fresh.length)
    window.setTimeout(() => {
      for (const line of fresh) highlightedLines.delete(line);
      sheetKey = '';
      if (s?.phase === 'service') drawSheet();
    }, LOG_HIGHLIGHT_MS);
}

function drawAll(force = false) {
  if (!force && (railHeld || performance.now() < railGraceUntil)) return;
  collectSaid();
  drawStatus();
  drawKitchenStock();
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
    (document.getElementById('night') as HTMLElement).textContent = `${pl.title}, week ${pl.week}`;
    (document.getElementById('clock') as HTMLElement).textContent = clock(s.minute);
    (document.getElementById('till') as HTMLElement).innerHTML =
      `Till: <b>${lira(s.till)}</b> <span class="soft">/ ${lira(billNow(s))} due Saturday</span>`;
    const playback = automaticClockPlayback(
      s,
      {
        reading: performance.now() < readingUntil,
        inspecting: inspectingNow(),
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
  const label = `${pl.title}, week ${pl.week}`;
  const night = document.getElementById('night');
  if (night) night.textContent = label;
  const words = app.querySelector('.people-service .bar-words');
  if (words) words.textContent = label;
  (document.getElementById('clock') as HTMLElement).textContent = clock(s.minute);
  const till = document.getElementById('till') as HTMLElement;
  till.innerHTML = tillBar(s);
  const playback = automaticClockPlayback(
    s,
    {
      reading: performance.now() < readingUntil,
      inspecting: inspectingNow(),
    },
    speed,
  );
  if (playback.rate <= 0.5) {
    const reason =
      selected && inspectingNow()
        ? `You are talking to ${nameOf(s, selected)}.`
        : performance.now() < readingUntil
          ? `${nameOf(s, s.said.filter((x) => x.who !== 'narrator').at(-1)?.who ?? 'selim')} is answering.`
          : playback.reason;
    const label = till.querySelector('.till-label');
    if (label) label.textContent = `Time is slowed. ${reason}`;
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
  drawKitchenStock();
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
    renderPanel(rail, peopleRun(st) ? '<span class="rail-clear">No orders are waiting.</span>' : '');
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
          row('cold side', t.doneCold, t.cold) +
          row('flatbread', t.doneOven, t.oven);
        if (t.due !== undefined) {
          const left = t.due - st.minute;
          return `<div class="slip wedding ${left < 15 ? 'late' : ''}"><div class="t">wedding trays</div>${dish}<div class="st">${left > 0 ? `due by ${clock(t.due)}` : 'late'}</div></div>`;
        }
        const reg = t.regular ? regularOf(t.regular) : undefined;
        const party = t.party ? partyOf(t.party) : undefined;
        const booking = bookingOf(st, t.id);
        const partyLabel = party
          ? `<div class="party-label" id="party-label-${t.id}">${booking?.promised ? (peopleRun(st) ? `promised: their food first · serve by ${clock(booking.servedBy)}` : `promised: <span class="chef-signature">${esc(party.signature.words)} (the Chef’s dish)</span> · serve by ${clock(booking.servedBy)}`) : 'no promise'}</div>`
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
          st.passDecision?.ticket === t.id ? '<div class="priority-mark">Served first</div>' : '';
        if (
          (!peopleRun(st) && st.version === 'pass@6') ||
          (!peopleRun(st) && st.version === 'pass@7') ||
          portionEdition(st)
        )
          return `<button class="slip ${wait > patience * 0.65 ? 'late' : ''} ${reg || party ? 'regular' : ''} ${party ? 'party-slip' : ''}" data-ticket="${t.id}" data-portion-station="${option ? option.station : t.grill > t.doneGrill ? 'grill' : t.cold > t.doneCold ? 'cold' : 'oven'}" aria-label="Cook for ${esc(who)}${party || reg ? `, table ${t.table}` : ''}" ${party ? `aria-describedby="party-label-${t.id}"` : ''} ${(!peopleRun(st) && st.version === 'pass@6' && !option) || (portionEdition(st) && t.doneGrill >= t.grill && t.doneCold >= t.cold && t.doneOven >= t.oven) ? 'disabled' : ''}><div class="t">${esc(who)}${party || reg ? `<span class="table-no"> · table ${t.table}</span>` : ''}</div>${partyLabel}${dish}<div class="st ${leaving === t.id ? 'leaving' : ''}">${leaving === t.id ? 'about to leave' : option ? 'Tap to cook a portion' : 'Cooking or ready'}</div>${priority}</button>`;
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
  room: { x: 46, y: 22 },
  conversation: { x: 180, y: 140 },
  'explain-wait': { x: 46, y: 22 },
  'no-replies': { x: 318, y: 22 },
};

function placeOf(id: CookId): string {
  if (!s) return 'idle';
  const a = personOf(s, id).activity;
  if (!a) return 'idle';
  if (['room', 'conversation', 'explain-wait', 'no-replies', 'resign'].includes(a.affordanceId))
    return a.affordanceId;
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
    `<path d="${wob(22, 34, 72, 34, 4)}" stroke="${soft}" stroke-width="1.5" fill="none"/><text x="46" y="62" text-anchor="middle" font-size="11" fill="${soft}">${kitchenEdition(st) ? 'dining room' : 'staff table'}</text>`,
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
          ? 'oven, no gas'
          : st.oven.heat >= OVEN_HOT
            ? 'oven, hot'
            : st.oven.heat > 0.15
              ? 'oven, warming'
              : 'oven, cold'
        : off
          ? 'grill, no gas'
          : (({ cold: 'cold side', dish: 'dishes' } as Record<string, string>)[name] ?? name);
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
        `<text x="${Math.min(290, Math.max(70, x))}" y="146" text-anchor="middle" class="hand" font-size="14" fill="var(--rope)">${name === 'oven' && st.oven.heat < OVEN_HOT ? 'flatbread waiting' : 'nobody here'}</text>`,
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
      `<text x="96" y="234" text-anchor="middle" class="hand" font-size="16" fill="var(--rope)">no clean plates</text>`,
    );
  if (planOf(st.night).week >= 3)
    parts.push(
      `<rect x="200" y="226" width="22" height="15" stroke="${soft}" stroke-width="1.1" fill="var(--paper-2)"/><text x="211" y="258" text-anchor="middle" font-size="10" fill="${soft}">accounts</text>`,
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
      `<text x="${jx}" y="${jy + 12}" text-anchor="middle" font-size="10" fill="${soft}">tip jar</text>`,
    );
  }
  const at: Record<string, number> = {};
  const here = st.crew.filter((m) => cookOf(st, m.id).here && !m.left);
  let goneRow = 0;
  here.forEach((m, idx) => {
    const c = cookOf(st, m.id);
    if (c.gone) {
      parts.push(
        `<text x="352" y="${92 + goneRow * 13}" text-anchor="end" font-size="11" fill="${soft}">${esc(m.name)} has left</text>`,
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
      y = FIXTURES[pl]?.y ?? 22;
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
      handover = `<span class="hand">${esc(`${party.host.charAt(0).toUpperCase()}${party.host.slice(1)}’s party sits down at ${clock(partyHandover.at)}. ${partyHandover.promised ? (peopleRun(s) ? 'You promised to serve their order first and on time.' : `You promised ${party.signature.words}.`) : 'You made no promise. They are coming anyway.'} ${peopleRun(s) ? 'An experienced helper ran the service until now. The cooks are cooking and sending out food.' : handoverHands(partyHandover.hands)} Now you run the pass.`)}</span>`;
  }
  const a = s.lastAnswer;
  const fresh = a && s.minute - a.at <= 10;
  const taken = a && s.inputs.some((i) => i.kind === 'ask' && i.counter && i.at >= a.at && i.cook === a.who);
  const canTake = fresh && a?.counter && !taken && cookOf(s, a.who).here && !cookOf(s, a.who).gone;
  const situation = serviceStatus(s).text;
  const spokenAt = s.minute;
  const spoken = kitchenEdition(s)
    ? s.said.findLast((line) => line.kind === 'answer' && line.who !== 'chef' && spokenAt - line.at <= 10)
    : undefined;
  const caption = spoken
    ? `<span class="hand">${esc(spoken.who === 'narrator' ? spoken.text : `${nameOf(s, spoken.who)}: “${spoken.text}”`)}</span>`
    : peopleRun(s)
      ? esc(situation)
      : fresh && a
        ? `<span class="hand">${esc(a.text)}</span>`
        : '';
  const receipts =
    s.version === 'pass@17'
      ? s.said
          .filter(
            (line) =>
              line.who === 'narrator' && line.text.endsWith('added to the till.') && spokenAt - line.at <= 5,
          )
          .map((line) => `<div class="served-receipt">${esc(line.text)}</div>`)
          .join('')
      : '';
  const key = caption + handover + receipts + (canTake ? `${a.at}${a.who}${a.counter}` : '');
  if (key === captionKey) return;
  captionKey = key;
  el.innerHTML = `${handover}${caption}${receipts}${canTake ? `<button data-counter="${a.counter}">Ask ${esc(nameOf(s, a.who))}: ${esc(VERB_LABEL[a.counter as Verb] ?? '')}</button>` : ''}`;
}

function select(id: CookId | null) {
  if (!s) return;
  if (id && (!cookOf(s, id).here || cookOf(s, id).gone)) return;
  selected = selected === id ? null : id;
  selectedAt = performance.now();
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
  dish: 'Dishes',
  oven: 'Oven',
  break: '10-minute break',
  eat: 'Eat',
  home: 'Go home',
};

const ANSWERS: Record<string, [string, string]> = {
  mother: ['Go. Now.', 'Can you stay until nine?'],
  advance: [`Give him ${lira(50)} from the till`, 'Not this week'],
  phone: ['Go on. Take five minutes.', 'After closing time'],
  'leave-early': ['Go at nine', 'I need you until closing time'],
  'eat-first': ['Eat first', 'After the busy time'],
  'my-way': ['It’s your oven. Do it your way.', 'It’s my kitchen. Do it my way.'],
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
  const staffing = availableStaffing(st)[0] ?? actionableStaffing(st)[0];
  const priorityWaiting =
    st.passDecision?.state === 'asking' &&
    (!st.help || (!peopleRun(st) && st.version === 'pass@6')) &&
    !staffing &&
    rq?.state !== 'asking';
  document
    .querySelector('.service')
    ?.classList.toggle('responding', priorityWaiting || rq?.state === 'asking' || !!staffing);
  document
    .querySelector('.service')
    ?.classList.toggle('choosing', (!!selected && !priorityWaiting) || rq?.state === 'asking');
  document
    .querySelector('.service')
    ?.classList.toggle('inspecting', !!selected && !priorityWaiting && !staffing && rq?.state !== 'asking');
  if (priorityWaiting) {
    renderPanel(
      el,
      `${crewHeader()}<div class="card priority-card"><b>Choose a table to serve first</b><div>${st.help ? 'Your hands are full. Finish this portion before you choose a table to serve first.' : 'The other tables will wait.'}</div><div class="priority-options">${priorityOptions(
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
      `${crewHeader()}<div class="card staffing-card"><div><b>${esc(nameOf(st, staffing.who))}</b>: ${esc(staffing.reason)}</div><div>Nobody will work at the ${esc(VERB_LABEL[staffing.station].toLowerCase())} for about ${Math.max(1, staffing.until - st.minute)} minutes, until ${clock(staffing.until)}.</div><div class="soft">${staffingOptions(st, staffing).length ? 'Choose who to ask.' : esc(noCoverWords(`the ${VERB_LABEL[staffing.station].toLowerCase()}`))}</div><div class="staffing-options">${staffingOptions(
        st,
        staffing,
      )
        .map(
          (id) =>
            `<button data-cover="${esc(id)}" ${queued ? 'disabled' : ''}>Ask ${esc(nameOf(st, id))} to take over${stationOf(st, id) ? `<span class="cover-tradeoff">Then nobody works at the ${esc(VERB_LABEL[stationOf(st, id) as Station].toLowerCase())}.</span>` : '<span class="cover-tradeoff">They are free now.</span>'}</button>`,
        )
        .join(
          '',
        )}<button data-cover="" ${queued ? 'disabled' : ''}>Leave the station empty</button></div>${queued ? '<div class="soft">They heard you. You are waiting for their answer.</div>' : ''}</div>`,
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
    const latestKitchenReply = kitchenEdition(st)
      ? lines.findLast((line) => line.kind === 'answer' && line.who !== 'chef')
      : undefined;
    const key = `j${st.minute}${st.inputs.length}${st.said.length}${seenHint.tap}${onShift(st)
      .map((id) => placeOf(id))
      .join()}${st.crew.map((m) => cookOf(st, m.id).gone).join()}`;
    if (sheetKey === key) return;
    sheetKey = key;
    const lineHTML = (x: Said) =>
      x.who === 'narrator'
        ? `<div class="${highlightedLines.has(x) ? 'new-log-line' : ''}">${peopleRun(st) ? `<time>${clock(x.at)}</time> ` : ''}${esc(gloss(journalWords(st, x)))}</div>`
        : `<div class="hand ${highlightedLines.has(x) ? 'new-log-line' : ''}">${peopleRun(st) ? `<time>${clock(x.at)}</time> ` : ''}${esc(nameOf(st, x.who))}: “${esc(gloss(x.text))}”</div>`;
    const opening = lines.filter((x) => x.at === openAt(st.night) - 5 && x.who === 'narrator');
    const legacyOpening = st.night === 1 && lines.slice(-3).every((x) => x.at === openAt(1) - 5);
    const journal = peopleRun(st)
      ? `${latestKitchenReply ? `<div class="latest-reply hand">${lineHTML(latestKitchenReply)}</div>` : ''}<div class="journal-heading">Earlier conversations</div>${opening.length ? `<details><summary>Opening notes</summary>${opening.map(lineHTML).join('')}</details>` : ''}${lines
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
    <div class="station-duration">${esc(absent ? (m.left ? `${m.name} has ended their kitchen employment.` : `${m.name} has left. You can ask again at the next service.`) : `${peopleRun(st) && !stationOf(st, selected) ? `Now: ${doing}, ${WHERE[placeOf(selected)] ?? 'free'}. ` : ''}${pendingCoverLine(st, selected) ?? coverLine(st, selected) ?? stationRequestLine(st, selected) ?? ''}`)}</div>
    <div class="verbs" role="group" aria-label="Ask for a job">${h.list
      .map(
        (v) =>
          `<button data-v="${v.verb}" ${waiting || absent || !attentionAvailable(st, selected as CookId) ? 'disabled' : ''}>${queued && st.inputs.slice(st.applied).some((i) => i.kind === 'ask' && i.cook === selected && i.verb === v.verb) ? 'asked…' : VERB_LABEL[v.verb]}${v.verb === stationOf(st, selected as CookId) ? ' (now)' : ''}<span class="h ${v.verdict === 'refused' ? 'no' : ''} ${v.guess ? 'guess' : ''}">${absent ? 'left the kitchen' : `${esc(gloss(v.short))}${v.guess ? '?' : ''}`}</span><span class="fill"></span></button>`,
      )
      .join('')}</div>
    ${(st.version === 'pass@13' || kitchenEdition(st)) && !absent && inKitchen(st, selected) ? `<div class="row crew-contact"><button data-contact="check-in">How are you doing?</button>${([FOLLOWUP_EDITION, NARRATION_EDITION, 'pass@17'].includes(st.version) ? !!heardTopic(st, selected) : st.said.some((line) => line.who === selected && line.at >= openAt(st.night) - 5)) ? `<button data-contact="follow-up">${[FOLLOWUP_EDITION, NARRATION_EDITION, 'pass@17'].includes(st.version) && heardTopic(st, selected)?.text.includes('sunset prayer') ? 'About the missed sunset prayer' : 'About what you said'}</button>` : ''}</div>` : ''}
    ${kitchenEdition(st) && !absent ? '<div class="row"><button data-kitchen-task="room">Ask for fifteen minutes in the dining room</button><p class="soft">This cook cannot prepare food while working there.</p></div>' : ''}
    <div class="panel-reply" role="status">${answer ? `“${esc(gloss(answer.text))}”` : ''}</div>${!attentionAvailable(st, selected as CookId) ? '<p class="soft" role="status">Let this cook finish this part of their work before asking again. The kitchen keeps running.</p>' : ''}<div class="hint">${
      absent
        ? 'This cook has left the kitchen.'
        : guess
          ? `I don’t know ${esc(m.name)} well yet. These answers are only guesses.`
          : seenHint.job
            ? waiting
              ? 'They heard you.'
              : 'Hold a job button to insist. If they already agreed, insisting puts more pressure on them.'
            : 'Tap a job to ask. Hold it to insist.'
    }</div>`,
  );
  bindCrew(el);
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-kitchen-task]'))
    b.onclick = () => {
      if (!selected) return;
      queueInput(st, { kind: 'kitchen-task', who: selected, task: 'room' });
      readingUntil = performance.now() + READING_MS;
      writeSave();
      drawAll(true);
    };
  for (const b of el.querySelectorAll<HTMLButtonElement>('.verbs button')) bindHold(b);
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-contact]')) {
    const choice = b.dataset.contact as 'check-in' | 'follow-up';
    b.disabled = !selected || !contactAvailable(st, selected, choice);
    b.onclick = () => {
      if (!selected) return;
      queueInput(st, { kind: 'cast-talk', who: selected, choice });
      readingUntil = performance.now() + READING_MS;
      selected = null;
      writeSave();
      drawAll(true);
    };
  }
}

/** One-time tips, said when the thing they explain first appears. */
/** The chef cannot warm the oven: only a cook standing at it does (simulation: stepCooks). */
function ovenTended(st: GameState) {
  return onShift(st).some((id) => stationOf(st, id) === 'oven');
}

function ovenWait(st: GameState) {
  return ovenTended(st) ? 'The oven is warming.' : 'The oven is cold. No cook is warming it.';
}

function tipLine(st: GameState): string {
  const mm = st.minute - openAt(st.night);
  const pl = planOf(st.night);
  let t = '';
  if (st.night === 1 && !seenHint.tap) t = 'Tap a cook.';
  else if (st.night === 2 && mm < 40) t = 'Plates come back dirty. Someone has to wash them.';
  else if (pl.week === 2 && pl.weekday === 2 && mm < 50)
    t =
      'Flatbread bakes only in a hot oven. A cook has to stand at the oven to warm it. The oven cools down when nobody is there.';
  else if (pl.week === 2 && pl.weekday === 2 && mm < 90)
    t = 'Regular customers come on their own nights. If you keep them waiting, they stop coming.';
  else if (pl.week === 3 && pl.weekday === 3 && mm < 40 && st.crew.some((m) => !m.founder && m.since === 4))
    t =
      'You have a new cook. You don’t know them yet. Until you do, their answers are only guesses, written in pencil.';
  return t ? `<div class="hint">${t}</div>` : '';
}

const WHERE: Record<string, string> = {
  room: 'in the dining room',
  conversation: 'talking at the pass',
  'explain-wait': 'answering a table',
  'no-replies': 'has put work and replies aside',
  resign: 'travelling home after leaving the job',
  grill: 'grill',
  cold: 'cold side',
  dish: 'dishes',
  oven: 'oven',
  yard: 'outside',
  table: 'eating',
  store: 'in the storeroom',
  idle: 'free',
};

function crewRow(): string {
  if (!s) return '';
  const st = s;
  return `<div class="crew">${st.crew
    .filter((m) => !m.left && cookOf(st, m.id).here)
    .map((m) => {
      const c = cookOf(st, m.id);
      return `<button data-pick="${m.id}" aria-pressed="${selected === m.id}" ${c.gone ? 'disabled' : ''}><b>${esc(m.name)}</b><span class="soft">${c.gone ? 'has left' : (WHERE[placeOf(m.id)] ?? '')}</span></button>`;
    })
    .join('')}</div>`;
}

function crewHeader(): string {
  return `<div class="who">${crewRow()}<button class="x" id="close" aria-label="Close" ${selected ? '' : 'style="visibility:hidden"'}>×</button></div>`;
}

function foodWork(st: GameState): string {
  if (peopleRun(st)) return '';
  if (st.inputs.slice(st.applied).some((i) => i.kind === 'help'))
    return '<div class="food-work">You will start your portion in the next kitchen minute.</div>';
  if (st.help)
    return `<div class="food-work">You’re preparing ${st.help.station === 'grill' ? 'a grill portion' : 'a cold dish'} for table ${st.tickets.find((t) => t.id === st.help?.ticket)?.table ?? ''}, until ${clock(st.help.until)}.</div>`;
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
    caption.textContent = gloss(text ?? reply.text);
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
        ? `<b>${esc(activeParty.host)}</b><span>${activeBooking.promised ? `Promised: ${esc(activeParty.signature.words)}.` : 'No promise.'} · serve by ${clock(activeBooking.servedBy)}</span>`
        : '';
    const next = portionEdition(st) ? st.chefNext : null;
    const choice = portionEdition(st) ? cookingChoice(st) : null;
    const actText =
      act?.station === 'oven' && st.oven.heat < OVEN_HOT && !gasOut(st) && !ovenTended(st)
        ? 'Waiting for the oven. Nobody is at the oven to warm it.'
        : (act?.text ?? '');
    const actControl = choice
      ? `<div class="food-choices"><button class="primary" data-cook-choice="now" data-choice-ticket="${choice.ticket}">${esc(choice.plain)}<span class="work-duration">Plain food. It is ready sooner.</span></button><button class="primary" data-cook-choice="careful" data-choice-ticket="${choice.ticket}">${esc(gloss(choice.careful))}<span class="work-duration">It takes ${choice.minutes} more kitchen minutes. Other tables wait longer.</span></button></div>`
      : act
        ? `<button class="portion-act ${act.ready ? 'ready' : ''}" data-cook-step="${act.ticket}" aria-label="${esc(actText)}" ${act.ready ? '' : 'disabled'}>${esc(actText)}</button>`
        : '';
    renderPanel(
      el,
      `${active ? `<section class="active-portion" aria-label="Your active portion"><div class="portion-heading"><b>Table ${table} · ${station === 'cold' ? 'cold side' : station}</b><span class="work-duration">${st.chef.body.exertion > 0.45 ? 'My arms are tired.' : 'My arms are working hard.'}</span></div><div class="active-party">${partyContext}</div><div class="food-surface food-${station}"><div class="food-drawing" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><div class="food-acts">${actControl}</div></div>${portionEdition(st) ? `<button class="finish-portion" data-finish-portion="${st.help?.ticket}">Finish by habit<span class="work-duration">Plain food. Time keeps its normal speed.</span></button>` : ''}</section>` : `<div class="chef-line">${esc(st.help?.instinct ? 'My hands finish this portion by habit. It will be plain food.' : chefLine(st))}</div>`}
      ${next ? `<div class="chef-next">Chef’s next portion: table ${st.tickets.find((t) => t.id === next.ticket)?.table} · ${next.station === 'cold' ? 'cold side' : next.station}</div>` : ''}
      <div class="chef-stations">${(['grill', 'cold', 'oven'] as const)
        .filter((place) => stationsTonight(st).includes(place))
        .map((place) => {
          const option = options.find((o) => o.station === place);
          return `<button data-chef-station="${place}" data-portion-ticket="${option?.ticket ?? ''}" aria-label="Work at the ${place === 'cold' ? 'cold side' : place}" ${(st.help && !portionEdition(st)) || !option ? 'disabled' : ''}>${st.help && portionEdition(st) ? 'Next: ' : 'Work at the '}${place === 'cold' ? 'cold side' : place}<span class="work-duration">${option ? `Table ${st.tickets.find((t) => t.id === option.ticket)?.table}${st.help ? '. Save it for later.' : '. Cook a portion.'}` : st.help ? 'Your hands are full' : owed(st)[place] > 0 && place !== 'cold' && gasOut(st) ? 'Waiting for the gas' : owed(st)[place] > 0 && place === 'oven' && st.oven.heat < OVEN_HOT ? ovenWait(st) : 'Nothing is waiting'}</span></button>`;
        })
        .join(
          '',
        )}</div><div class="pass-plates" aria-label="Plates at the pass">${plates.map((plate) => `<button data-call-plate="${plate.ticket}">${esc(plate.text.split('!')[0] ?? plate.text)}!<span class="work-duration">${plate.text.includes('cooling') ? 'It is cooling.' : 'It goes out hot.'}</span></button>`).join('')}</div>`,
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
          `<button data-chef-station="${station}" aria-label="Work at the ${station === 'cold' ? 'cold side' : station}" ${options.some((o) => o.station === station) ? '' : 'disabled'}>Work at the ${station === 'cold' ? 'cold side' : station}<span class="work-duration">${
            options
              .find((o) => o.station === station)
              ?.text.split(' · ')
              .at(-1) ??
            (st.help
              ? 'Your hands are full'
              : owed(st)[station] > 0 && station !== 'cold' && gasOut(st)
                ? 'Waiting for the gas'
                : owed(st)[station] > 0 && station === 'oven' && st.oven.heat < OVEN_HOT
                  ? ovenWait(st)
                  : 'Nothing is waiting')
          }</span></button>`,
      )
      .join(
        '',
      )}</div><div class="chef-tradeoff">${st.help ? 'Your hands are full. Finish this portion before you choose a table to serve first.' : options.length ? 'While you cook a portion, your hands are busy and you cannot run the pass.' : 'No portion is waiting. The cooks keep working.'}</div>`,
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
      ? '<p>The customer with the notebook smiled at the door. Saturday’s newspaper will be kind to us.</p>'
      : r.critic === 'cold'
        ? '<p>The food writer ate and left without a word.</p>'
        : r.critic === 'walked'
          ? '<p>Someone with a notebook sat at one of the tables that left without eating.</p>'
          : '';
  const wedding =
    r.wedding === 'on time'
      ? ''
      : r.wedding === 'late'
        ? '<p>The wedding trays arrived late. We were paid less, and people on the street will hear about it.</p>'
        : r.wedding === 'lost'
          ? '<p>The wedding hall ordered its food from the restaurant on the corner instead. For twenty years, Nevin made the food for every Yıldız family wedding.</p>'
          : '';
  const parties = (r.parties ?? [])
    .map((result) => {
      const party = partyOf(result.party);
      if (!party || !result.outcome) return '';
      if (peopleRun(st)) {
        const words =
          result.outcome === 'kept'
            ? `${party.host}: “It came on time, as you promised. Thank you.”`
            : result.outcome === 'broken'
              ? `${party.host}: “We had agreed on a time.”`
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
      ? `<div class="card"><div>${lightJar ? 'The tip jar was light again tonight. Nevin never said anything about it.' : st.jarPlace === 'pass' ? 'The tip jar sits on the pass now.' : 'The tip jar sits by the back door, where I cannot see it.'}</div>
        <div class="row" style="flex-direction:column"><button data-jar="talk">Sit with Rafi on the back step</button><button data-jar="move">Move the jar to the pass</button><button data-jar="leave">Leave the jar where it is</button></div></div>`
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
      ? `<p><b>Closing time on Saturday.</b> I counted out ${lira(r.bill.amount)} for ${esc(r.bill.owed)}. ${lira(st.till)} is left in the till.</p>`
      : `<p><b>Closing time on Saturday.</b> ${esc(capital(r.bill.owed))} wanted ${lira(r.bill.amount)}. I had only ${lira(r.bill.amount - r.bill.short)}. ${st.lost ? '' : `The rest, ${lira(r.bill.short)}, is due next Saturday, with an extra fee.`}</p>`
    : '';
  const tonight = stampList(r.stamps);
  const nextBtn = st.lost
    ? '<button class="primary" id="end">Monday morning</button>'
    : ended
      ? '<button class="primary" id="end">Close the notebook</button>'
      : toSunday
        ? '<button class="primary" id="open">Go to Sunday</button>'
        : `<button class="primary" id="open" ${r.night === 3 && !st.jarDecided ? 'disabled' : ''}>Open on ${esc(next?.title ?? '')}</button>`;
  app.innerHTML = `<div class="page evening-page">
    ${topBar(`After closing · ${weekTitle(r.night)}`, 'evening')}
    <div class="page-body">
    <h2>${esc(weekTitle(r.night))}, after closing time</h2>
    <div class="plates" aria-label="${r.served} tables served, ${r.walked} left without eating">${plates}</div>
    ${!ended && !r.bill ? `<p class="evening-pace">${paceLine(st, r.night)}</p>` : ''}
    ${tillBar(st)}
    <p>We served ${r.served} of ${total} tables. We earned ${lira(r.takings)} tonight.</p>
    <p class="closing-choices">${esc(closingChoices(st))}</p>
    ${lightJar && r.night !== 3 && st.jarPlace === 'counter' ? '<p>The tip jar was lighter than it should have been.</p>' : ''}
    ${crit}${wedding}${parties}
    ${r.apron ? '<p>Selim wore Nevin’s apron until closing time. Nobody mentioned it.</p>' : ''}
    ${reviews}
    ${bill}${r.bill?.promiseBroken ? '<p>A promise was broken this week. That is one strike against the restaurant.</p>' : ''}
    ${tonight ? `<p class="soft">In the notebook tonight:</p>${tonight}` : ''}
    ${jarChoice}${jarReply}
    ${zeynepDepartureStatus(st).canRelease ? '<section class="card"><p>Zeynep’s time in the kitchen can end here. Chef can free her from the rest of her kitchen shifts.</p><button id="zeynep-release">Chef: “Your shifts here are finished, Zeynep.”</button></section>' : ''}
    </div>
    <div class="actions">
      ${!st.lost && !ended && !toSunday && r.night === 3 && !st.jarDecided ? '<p class="hint">Choose what to do about the tip jar first.</p>' : ''}
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
      const reply = app.querySelector('.jar-reply');
      reply?.scrollIntoView({ block: 'nearest' });
      if (document.fonts.status !== 'loaded')
        void document.fonts.ready.then(() => {
          if (reply?.isConnected) reply.scrollIntoView({ block: 'nearest' });
        });
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
    return `The money for ${weekOf(week).owed} is already in the till. Everything we earn now is ours.`;
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
    return detail && pg.chosen[`promise:${id}`] === undefined
      ? [`<a href="#party-${esc(id)}">${esc(detail.host)} (${esc(detail.night)})</a>`]
      : [];
  });
  const parts: string[] = [];
  if (pg.parties?.length) {
    parts.push(
      '<p class="soft party-note">A kept promise earns money and brings the party back. A broken promise counts as a strike against the restaurant on Saturday.</p>',
    );
    for (const id of pg.parties) {
      const party = partyOf(id);
      const detail = partyCard(st, id);
      if (!party || !detail) continue;
      const key = `promise:${id}`;
      if (pg.chosen[key] !== undefined) continue;
      parts.push(
        `<section class="card party-card" id="party-${esc(id)}" tabindex="-1" aria-label="${esc(detail.host)}"><p>${esc(party.booked)}</p><p class="party-time">${esc(detail.night)} · ${clock(detail.at)} · serve by ${clock(detail.servedBy)}</p><p>${esc(detail.order)}</p><p>Promise: ${esc(detail.signature)}</p>${detail.cook ? `<p class="hand"><b>${esc(nameOf(st, detail.cook.who))}</b>: “${esc(detail.cook.text)}”</p>` : ''}<div class="row">${[
          ['promise', 'Promise it'],
          ['plain', 'No promise'],
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
      `<div class="cookline ink-in"><b>${esc(nameOf(st, q.id))}</b> didn’t come in on Sunday. There was a note under the door: <div class="hand">“${esc(q.words)}”</div></div>`,
    );
  if (pg.changes.length > 0)
    parts.push(
      `<p class="soft">What I noticed this week, as I wrote it all down:</p>${pg.changes.map((c) => `<p class="hand" style="font-size:20px">${esc(gloss(c.line))}</p>`).join('')}`,
    );
  if (pg.offday)
    parts.push(
      card(
        'offday',
        'Dilek stayed late after closing time on Saturday. “It’s about Wednesdays, Chef. My mother goes to her clinic on Wednesdays. Could I have them off?” Without her, someone else must work at the cold side on Wednesdays.',
        [
          ['yes', 'Take Wednesdays off'],
          ['no', 'I need you every night'],
        ],
      ),
    );
  if (pg.candidates.length > 0) {
    const opts: [string, string][] = pg.candidates.map((id) => {
      const t = hireTemplate(id);
      return [id, t ? `${t.name}, ${t.home} (${lira(t.wage)} a night)` : id];
    });
    opts.push(['none', 'Hire nobody this week']);
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
        `In Nevin’s account book, <b>${esc(r.name)}</b> owes ${lira(r.owes)}.${r.margin ? ` In the margin, in her handwriting: <span class="hand" style="font-size:19px">“${esc(r.margin)}”</span>` : ''}`,
        [
          ['keep', 'Leave the debt as it is'],
          ['ask', 'Ask them gently next time'],
          ['forgive', 'Cross the debt out'],
        ],
      ),
    );
  }
  if (pg.letgo) {
    const opts: [string, string][] = activeCrew(st)
      .filter((m) => m.since <= pg.week)
      .map((m) => [m.id, `Let ${m.name} go`]);
    opts.unshift(['none', 'Keep everyone']);
    parts.push(card('letgo', 'The landlord is raising the rent. Wages are the only thing I can cut.', opts));
  }
  if (pg.price)
    parts.push(
      card(
        'price',
        `Supper costs ${lira(st.price)}. Nevin never changed the price. A higher price would help pay the bills, but people on the street would notice.`,
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
        'The man from the roast-meat restaurant chain came back on Sunday with a price written on a card. It would pay everything we owe, but the name over the door would come down.',
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
    ${partyLinks.length ? `<nav class="party-jumps" aria-label="Next week’s parties">Next week’s parties: ${partyLinks.join(' and ')}. Make a choice on each card.</nav>` : ''}
    <p class="soft">${esc(weekOf(pg.week).title)}. The restaurant is closed. I sit at the staff table with the notebook.</p>
    ${parts.join('')}
    ${stamps ? `<p class="soft">This week in the notebook:</p>${stamps}` : ''}
    ${nextWeek ? `<p>Next week we must pay ${lira(nextWeek.bill)} to ${esc(nextWeek.owed)}${st.carry ? `, plus ${lira(st.carry)} left over from this week` : ''}${st.seen ? `, plus ${lira(st.seen)} more, because ${esc(SEEN_WHO[pg.week] ?? 'they')} saw the queue of customers on Saturday` : ''}.</p>` : ''}
    </div>
    <div class="actions">
      <button class="primary" id="open">${esc(sundayOpenLabel(st, firstPartyStart))}</button>
    </div>
  </div>`;
  for (const b of app.querySelectorAll<HTMLButtonElement>('[data-key]'))
    b.addEventListener('click', () => {
      queueInput(st, { kind: 'choose', key: b.dataset.key as string, value: b.dataset.val as string });
      writeSave();
      if (!b.dataset.key?.startsWith('promise:')) {
        const panelScroll = app.querySelector('.sunday-page > .page-body')?.scrollTop ?? 0;
        sunday();
        const panel = app.querySelector('.sunday-page > .page-body');
        if (panel) panel.scrollTop = panelScroll;
        return;
      }
      // Keep this scroll panel and its focused control in place while the answer is read.
      const card = b.closest<HTMLElement>('.card');
      for (const option of card?.querySelectorAll<HTMLButtonElement>('[data-key]') ?? []) {
        option.disabled = true;
        const chosen = option === b;
        option.classList.toggle('chosen', chosen);
        if (option.hasAttribute('aria-pressed')) option.setAttribute('aria-pressed', String(chosen));
      }
      if (b.dataset.key?.startsWith('promise:'))
        window.setTimeout(() => {
          if (!card?.isConnected) return;
          card.remove();
          const links = (pg.parties ?? []).flatMap((id) => {
            const detail = partyCard(st, id);
            return detail && pg.chosen[`promise:${id}`] === undefined
              ? [`<a href="#party-${esc(id)}">${esc(detail.host)} (${esc(detail.night)})</a>`]
              : [];
          });
          const nav = app.querySelector('.party-jumps');
          if (links.length && nav)
            nav.innerHTML = `Next week’s parties: ${links.join(' and ')}. Make a choice on each card.`;
          else nav?.remove();
        }, 4_000);
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
    body = `${b && b.short > 0 ? `${capital(b.owed)} wanted ${lira(b.amount)}, and I was ${lira(b.short)} short. ` : ''}${b?.promiseBroken ? 'A promise was broken this week. That is one strike against the restaurant. ' : ''}The man from the roast-meat restaurant chain called the same afternoon. I said I would think about it. I worked ${nights} nights at Nevin’s.`;
  } else if (st.sold) {
    head = 'The sign came down on a Tuesday.';
    body =
      'The chain paid everything we owed, and a little more. Selim took Nevin’s account book home. I don’t know what he did with it.';
  } else {
    head = 'Nevin’s name is still over the door.';
    body = `On Monday morning, the last of the money we owed went to the bank. ${lira(st.till)} was left in the till.${st.reports.some((r) => r.apron) ? ' Selim keeps the apron on the hook by the grill now.' : ''}`;
  }
  const together =
    warm >= Math.max(2, crew.length - 1)
      ? 'After closing time on the last night, the cooks stayed and ate together at the staff table. Selim said Nevin would have laughed at me, and then helped me.'
      : warm >= 1
        ? 'After closing time on the last night, one of them stayed to help me stack the chairs.'
        : 'After closing time on the last night, they left without a word. The kitchen was very quiet.';
  const gone = st.crew.filter((m) => m.left);
  app.innerHTML = `<div class="page ending-page">
    ${topBar('The notebook', 'end')}
    <div class="page-body">
    <h2>${esc(head)}</h2>
    <p>${esc(body)}</p>
    <p>${esc(together)}</p>
    <details class="ending-reckoning"><summary>See the tally</summary><div id="ending-tally">${endingTally(st, true)}</div></details>
    ${gone.length ? `<p class="soft">Cooks who left the kitchen: ${gone.map((m) => esc(m.name)).join(', ')}.</p>` : ''}
    <h2 class="hand" style="font-size:28px">What the cooks said about me</h2>
    ${lastLines.map((l) => `<div class="cookline"><b>${esc(nameOf(st, l.id))}</b><div class="hand">“${esc(l.t)}”</div></div>`).join('')}
    ${st.stamps.length ? `<p class="soft">The notebook:</p>${stampList(st.stamps.map((x) => x.id))}` : ''}
    </div>
    <div class="actions">
      <div class="end-secondaries"><button id="send">Feedback</button></div>
      <button class="primary" id="again">New game</button>
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
    <h1>Zeynep returns</h1><p>Her trial at the cold side is over. What she learned stays with her. Her sons still expect her home each evening.</p>
    <p>${esc(String((s.returnChapter.envelope.transfer.history as { id: string; summary: string }[]).find((f) => f.id === 'goodhands-encounter')?.summary ?? 'Her family’s answer is written in this chapter’s notebook.'))}</p><p>Chef has freed her from her kitchen shifts. She has no new job in this chapter.</p>
    <div class="actions"><button id="send">Feedback</button><button id="fresh">Start a new game</button></div></div></div>`;
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

/** World stock is public. Reading this panel does not pause service. */
function drawKitchenStock() {
  const el = document.getElementById('kitchen-stock');
  if (!el || !s?.kitchen) return;
  const w = s.kitchen;
  const text = `Ingredients left: ${w.stock.grill} grill portions, ${w.stock.cold} cold portions and ${w.stock.oven} flatbreads.`;
  const supply = w.supply;
  const html = `<p>${esc(text)}</p>${supply.expected ? `<p>${supply.failed ? 'The original wedding lamb delivery has failed.' : 'Eight wedding lamb portions are expected at six; they are not here yet.'}${supply.replacement ? (supply.replacement.delivered ? ' The paid replacement has arrived.' : ` The paid replacement arrives at ${clock(supply.replacement.arrives)}.`) : ''}</p>` : ''}${supply.failed && !supply.replacement ? `<button id="buy-replacement" ${s.till < 240 ? 'disabled' : ''}>Order eight replacement lamb portions for ${lira(240)}. Allow 45 minutes.</button>` : ''}`;
  if (el.innerHTML === html) return;
  el.innerHTML = html;
  document.getElementById('buy-replacement')?.addEventListener('click', () => {
    if (!s) return;
    queueInput(s, { kind: 'replacement' });
    writeSave();
    drawAll(true);
  });
}
