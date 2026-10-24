import { type Lab, PRIVACY_URL } from '@adam0white/lab-client';
import { feedbackPersonaControl } from '@adam0white/lab-kit';
import { unlinkedFeedbackRun } from './feedback-run.ts';
import './feedback.css';

const NAME_KEY = 'hf-lab-feedback-name';
const readLocal = (key: string) => {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

export type FeedbackOptions = {
  lab: Lab;
  getRun: () => unknown;
  download: () => void;
  onBack: () => void;
  chooseRecording: (allow: boolean) => void | Promise<void>;
};

/** The kitchen remains held by the modal until the caller restores its menu. */
export function openFeedback({ lab, getRun, download, onBack, chooseRecording }: FeedbackOptions): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'pass-feedback';
  dialog.setAttribute('aria-labelledby', 'pass-feedback-title');
  dialog.innerHTML = `
    <div class="feedback-frame">
      <header class="feedback-topbar">
        <button type="button" class="feedback-back" data-feedback="back" aria-label="Back to the menu">← Back</button>
        <span class="feedback-place">Send word</span>
        <button type="button" data-feedback="info" aria-label="Information" aria-expanded="false" aria-controls="feedback-info">i</button>
        <button type="button" data-feedback="menu" aria-label="Game menu">≡</button>
      </header>
      <aside id="feedback-info" class="feedback-info" aria-label="About sending word" hidden>
        <button type="button" data-feedback="close-info" aria-label="Close information">×</button>
        <p>Tell us what the kitchen's record cannot show.</p>
        <p>A name is optional. Keeping a copy works even when recording is off.</p>
        <p>Sending queues your word for the lab. Delivery may retry.</p>
      </aside>
      <form class="feedback-form">
        <div class="feedback-sheet">
          <h1 id="pass-feedback-title">Send word</h1>
          <p>Send a note about this game. Recording and continuing-person choices are optional.</p>
          <fieldset class="feedback-verdicts">
            <legend>Would you keep playing? <span>(optional)</span></legend>
            <button type="button" data-verdict="keep" aria-pressed="false">I'd keep playing</button>
            <button type="button" data-verdict="mixed" aria-pressed="false">Not sure</button>
            <button type="button" data-verdict="quit" aria-pressed="false">I'd stop here</button>
          </fieldset>
          <label class="feedback-note">What happened in the kitchen, what you wanted, what got in the way.
            <textarea name="note" rows="4"></textarea>
          </label>
          <details class="feedback-name"><summary>+ Add a name or tester id</summary>
            <label>Your name or tester id <input name="tester-name" type="text" maxlength="60" autocomplete="nickname" /></label>
            <p>Your name labels this device's whole linked play history, past and future. Leave it empty to stay pseudonymous.</p>
          </details>
          <details class="feedback-preview"><summary>What is sent</summary>
            <p data-feedback="preview"></p>
            <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">Lab privacy</a>
          </details>
          <button type="button" class="feedback-download" data-feedback="download">Keep a copy of this run</button>
          <p class="feedback-status" role="status" aria-live="polite"></p>
        </div>
        <footer class="feedback-actions"><button type="submit" class="primary feedback-send">Send</button></footer>
      </form>
    </div>`;
  const find = <T extends Element>(selector: string) => dialog.querySelector<T>(selector) as T;
  const send = find<HTMLButtonElement>('.feedback-send');
  const form = find<HTMLFormElement>('form');
  const name = find<HTMLInputElement>('[name="tester-name"]');
  const note = find<HTMLTextAreaElement>('textarea');
  const status = find<HTMLParagraphElement>('.feedback-status');
  const info = find<HTMLElement>('.feedback-info');
  const infoButton = find<HTMLButtonElement>('[data-feedback="info"]');
  const feedbackRun = () => {
    try {
      return getRun();
    } catch {
      return undefined;
    }
  };
  const personaChoice = feedbackPersonaControl({
    personaRecordingRequired: lab.personaRecordingRequired,
    get personaRecordingAllowed() {
      return lab.personaRecordingAllowed;
    },
    allowPersonaRecording(allow) {
      void Promise.resolve()
        .then(() => chooseRecording(allow))
        .then(syncPersonaChoice, syncPersonaChoice);
    },
  });
  function syncPersonaChoice() {
    const input = personaChoice?.querySelector('input');
    if (input) input.checked = lab.personaRecordingAllowed;
  }
  if (personaChoice?.lastChild)
    personaChoice.lastChild.textContent =
      ' Link all continuing histories in this run to lab recording (optional)';
  if (personaChoice) form.querySelector('textarea')?.after(personaChoice);

  let verdict = '';
  let pending = false;
  let sent = false;
  let closed = false;
  name.value = readLocal(NAME_KEY);
  const isOff = () =>
    readLocal('hf-lab-recording-off') === '1' || readLocal(`hf-lab-events-off:${lab.game}`) === '1';
  const update = () => {
    send.disabled = pending;
    find<HTMLElement>('[data-feedback="preview"]').textContent = isOff()
      ? 'Your note, verdict and optional name only. No run or linked history is sent.'
      : 'Your note, verdict and optional name. Available run details are included when recording permits them.';
  };
  const closeInfo = () => {
    info.hidden = true;
    infoButton.setAttribute('aria-expanded', 'false');
  };
  const back = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('hf-lab-preference', update);
    window.removeEventListener('storage', update);
    dialog.close();
    dialog.remove();
    onBack();
  };
  const rememberName = (tester: string) => {
    try {
      if (tester) localStorage.setItem(NAME_KEY, tester);
      else localStorage.removeItem(NAME_KEY);
    } catch {
      // A storage restriction must not prevent feedback.
    }
  };
  const complete = (message: string) => {
    if (closed) return;
    sent = true;
    status.textContent = message;
    send.textContent = 'Back to the game';
    for (const field of form.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLTextAreaElement>(
      'input, textarea, [data-verdict]',
    ))
      field.disabled = true;
  };
  for (const chip of dialog.querySelectorAll<HTMLButtonElement>('[data-verdict]')) {
    chip.addEventListener('click', () => {
      verdict = verdict === chip.dataset.verdict ? '' : (chip.dataset.verdict ?? '');
      for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-verdict]'))
        button.setAttribute('aria-pressed', String(button.dataset.verdict === verdict));
    });
  }
  find('[data-feedback="download"]').addEventListener('click', download);
  find('[data-feedback="back"]').addEventListener('click', back);
  find('[data-feedback="menu"]').addEventListener('click', back);
  infoButton.addEventListener('click', () => {
    info.hidden = !info.hidden;
    infoButton.setAttribute('aria-expanded', String(!info.hidden));
  });
  find('[data-feedback="close-info"]').addEventListener('click', closeInfo);
  dialog.addEventListener('click', (event) => {
    if (
      !info.hidden &&
      event.target instanceof Node &&
      !info.contains(event.target) &&
      !infoButton.contains(event.target)
    )
      closeInfo();
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (!info.hidden) closeInfo();
    else back();
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (sent) return back();
    if (send.disabled || pending) return;
    const text = [verdict ? `Verdict: ${verdict}` : '', note.value.trim()].filter(Boolean).join('\n\n');
    const tester = name.value.trim().slice(0, 60);
    pending = true;
    status.textContent = 'Sending…';
    update();
    try {
      const noteOnly = !lab.telemetryOn || (lab.privacySignalOn && !lab.privacyOverride);
      const receipt = await lab.sendFeedback(text, {
        name: tester,
        run: lab.personaRecordingAllowed ? feedbackRun() : unlinkedFeedbackRun(feedbackRun()),
      });
      const sentMessage = `${noteOnly ? 'Note and verdict queued without a run or history linkage' : 'Note and verdict queued. Run details depend on recording and availability; continuing-person history links only after explicit consent'} · ${receipt}`;
      rememberName(tester);
      complete(sentMessage);
    } catch (error) {
      if (closed) return;
      status.textContent =
        error instanceof Error ? error.message : 'Could not queue your word. Please try again.';
    } finally {
      pending = false;
      update();
    }
  });
  window.addEventListener('hf-lab-preference', update);
  window.addEventListener('storage', update);
  document.body.append(dialog);
  update();
  dialog.showModal();
}
