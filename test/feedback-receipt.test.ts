import type { Lab } from '@adam0white/lab-client';
import { afterEach, expect, it, vi } from 'vitest';
import { openFeedback } from '../src/ui/feedback.ts';

afterEach(() => vi.unstubAllGlobals());

it('confirms stored feedback only after the send resolves with a receipt', async () => {
  const listeners = new Map<string, (event: { preventDefault(): void }) => Promise<void>>();
  const fields = new Map<string, ReturnType<typeof element>>();
  function element() {
    return {
      value: '',
      disabled: false,
      textContent: '',
      setAttribute() {},
      addEventListener() {},
      querySelectorAll: () => [],
    };
  }
  const field = (selector: string) => {
    if (!fields.has(selector)) fields.set(selector, element());
    return fields.get(selector);
  };
  const form = {
    ...element(),
    addEventListener: (type: string, listener: (event: { preventDefault(): void }) => Promise<void>) =>
      listeners.set(type, listener),
  };
  const dialog = {
    ...element(),
    querySelector: (selector: string) => (selector === 'form' ? form : field(selector)),
    showModal() {},
  };
  vi.stubGlobal('document', { createElement: () => dialog, body: { append() {} } });
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  let confirm: ((receipt: string) => void) | undefined;
  const sendFeedback = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        confirm = resolve;
      }),
  );
  openFeedback({
    lab: { telemetryOn: true, sendFeedback } as unknown as Lab,
    getRun: () => ({ seed: 7 }),
    download() {},
    onBack() {},
    chooseRecording() {},
  });
  const note = field('textarea');
  if (!note) throw new Error('Missing note field.');
  note.value = 'A note with a receipt.';
  const submit = listeners.get('submit');
  if (!submit) throw new Error('Missing submit handler.');
  const sending = submit({ preventDefault() {} });
  expect(field('.feedback-status')?.textContent).toBe('Sending…');
  expect(field('.feedback-send')?.textContent).not.toBe('Back to the game');
  if (!confirm) throw new Error('Feedback did not start sending.');
  confirm('stored-reference');
  await sending;
  expect(field('.feedback-status')?.textContent).toBe(
    'Sent. Your note is stored. Reference stored-reference.',
  );
  expect(field('.feedback-send')?.textContent).toBe('Back to the game');
});
