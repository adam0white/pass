import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { frameworkEngine } from '../src/sim/hf4-person.ts';

let saveApi: typeof import('../src/ui/app.ts')._debug;
const data = new Map<string, string>();

beforeAll(async () => {
  vi.stubGlobal('document', { getElementById: () => null, addEventListener: () => {} });
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  });
  saveApi = (await import('../src/ui/app.ts'))._debug;
});

beforeEach(() => data.clear());

it('shows refusal for incompatible or malformed saves at the stable key', () => {
  for (const value of [
    '{',
    JSON.stringify({ format: 99, game: 'pass@19' }),
    JSON.stringify({ format: 1, game: 'pass@19', framework: '4.8.1', hf4Engine: frameworkEngine() }),
    JSON.stringify({ format: 1, game: 'pass@18' }),
    JSON.stringify({ format: 1, game: 'pass@19', framework: 'future-hf', hf4Engine: frameworkEngine() }),
  ]) {
    data.set('pass-save', value);
    expect(saveApi.readSave()).toBeNull();
    expect(saveApi.oldSave()).toBe(true);
  }
});

it('shows refusal for a save under any historical framework key', () => {
  data.set('pass-save-hf4-4.8.1', '{}');
  expect(saveApi.oldSave()).toBe(true);
  data.clear();
  data.set('pass-save-hf4-5.0.0', '{}');
  expect(saveApi.oldSave()).toBe(true);
});
