import { type Lab, PRIVACY_URL } from '@adam0white/lab-client';
import { feedbackPersonaControl, feedbackSharePlay } from '@adam0white/lab-kit';
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
export function openFeedback({ lab, getRun, download, onBack }: FeedbackOptions): void {
  const dialog = document.createElement('dialog');
  dialog.className = 'pass-feedback';
  dialog.setAttribute('aria-labelledby', 'pass-feedback-title');
  dialog.innerHTML = `
    <div class="feedback-frame">
      <header class="feedback-topbar">
        <button type="button" class="feedback-back" data-feedback="back" aria-label="Back to the menu">← Back</button>
        <span class="feedback-place">Feedback</span>
        <button type="button" data-feedback="info" aria-label="Information" aria-expanded="false" aria-controls="feedback-info">i</button>
        <button type="button" data-feedback="menu" aria-label="Game menu">≡</button>
      </header>
      <aside id="feedback-info" class="feedback-info" aria-label="About feedback" hidden>
        <button type="button" data-feedback="close-info" aria-label="Close information">×</button>
        <p>Tell us what the game's record cannot show.</p>
        <p>A name is optional. Keeping a copy works even when recording is off.</p>
        <p>Your feedback is saved until it is delivered. The game tries again if sending fails.</p>
      </aside>
      <form class="feedback-form">
        <div class="feedback-sheet">
          <h1 id="pass-feedback-title">Feedback</h1>
          <p>Send a note about this game. You can send a note with or without sharing play.</p>
          <fieldset class="feedback-verdicts">
            <legend>Would you keep playing? <span>(optional)</span></legend>
            <button type="button" data-verdict="keep" aria-pressed="false">I'd keep playing</button>
            <button type="button" data-verdict="mixed" aria-pressed="false">Not sure</button>
            <button type="button" data-verdict="quit" aria-pressed="false">I'd stop here</button>
          </fieldset>
          <label class="feedback-note">Tell us what happened in the kitchen, what you wanted, and what got in the way.
            <textarea name="note" rows="4"></textarea>
          </label>
          <details class="feedback-name"><summary>+ Add a name or tester ID</summary>
            <label>Your name or tester ID <input name="tester-name" type="text" maxlength="60" autocomplete="nickname" /></label>
            <p>Your name is attached to all linked play from this device, past and future. Leave it empty if you do not want your name attached.</p>
          </details>
          <details class="feedback-preview"><summary>What is sent</summary>
            <p data-feedback="preview"></p>
            <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">Lab privacy</a>
          </details>
          <button type="button" class="feedback-download" data-feedback="download">Keep a copy of this run</button>
          <p class="feedback-status" role="status" aria-live="polite"></p>
        </div>
        <footer class="feedback-actions"><button type="submit" class="primary feedback-send">Submit</button></footer>
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
  const personaChoice = feedbackPersonaControl(lab);
  if (personaChoice) form.querySelector('textarea')?.closest('label')?.after(personaChoice);

  let verdict = '';
  let pending = false;
  let sent = false;
  let closed = false;
  name.value = readLocal(NAME_KEY);
  const update = () => {
    send.disabled = pending;
    find<HTMLElement>('[data-feedback="preview"]').textContent =
      !lab.telemetryOn && !feedbackSharePlay(personaChoice)
        ? 'Only your note, your answer and your name (if you gave one) are sent. No run or play history is sent.'
        : 'Your note, your answer and your name (if you gave one) are sent. Run details are included when recording allows it.';
  };
  personaChoice?.addEventListener('change', update);
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
      const sharePlay = feedbackSharePlay(personaChoice);
      const noteOnly = !lab.telemetryOn && !sharePlay;
      const receipt = await lab.sendFeedback(text, {
        name: tester,
        run: feedbackRun(),
        sharePlay,
      });
      const sentMessage = `${noteOnly ? 'Your note and answer are ready to send. No run or play history is attached' : 'Your note and answer are ready to send. Run details are attached when recording allows it. Recorded play is linked across games on this device'} · ${receipt}`;
      rememberName(tester);
      complete(sentMessage);
    } catch (error) {
      if (closed) return;
      status.textContent =
        error instanceof Error ? error.message : 'Could not save your feedback. Please try again.';
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
