import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { historyOf } from './model/history';
import { sampleLevel, updateObject } from './model/level';
import type { Level } from './model/types';
import { useEditor } from './store';

// Tests don't need the autosave; without this, zustand warns that there's no localStorage in Node.
vi.mock('zustand/middleware', async (original) => ({
  ...(await original<typeof import('zustand/middleware')>()),
  persist: <T,>(config: T) => config,
}));

const store = () => useEditor.getState();
const level = () => store().history.present;

describe('typing undoes as one step', () => {
  // The sample gets fresh object ids on every call, so keep the one each test starts from.
  let start: Level;

  beforeEach(() => {
    vi.useFakeTimers();
    start = sampleLevel();
    useEditor.setState({ history: historyOf(start), strokeBase: null, lastMerge: null, selectedId: null });
  });
  afterEach(() => vi.useRealTimers());

  it('merges keystrokes in an object label', () => {
    const id = level().objects[0].id;
    for (const label of ['r', 'ra', 'rat']) {
      store().edit((l) => updateObject(l, id, { label }), `label-${id}`);
      vi.advanceTimersByTime(150);
    }
    expect(store().history.past).toHaveLength(1);
    store().undo();
    expect(level()).toBe(start);
  });

  it('starts a new step after a pause, in another field, or for unkeyed edits', () => {
    const id = level().objects[0].id;
    store().edit((l) => ({ ...l, name: 'A' }), 'level-name');
    vi.advanceTimersByTime(1500);
    store().edit((l) => ({ ...l, name: 'AB' }), 'level-name');
    store().edit((l) => updateObject(l, id, { label: 'x' }), `label-${id}`);
    store().edit((l) => updateObject(l, id, { label: 'xy' }));
    expect(store().history.past).toHaveLength(4);
  });

  it('never merges across an undo', () => {
    store().edit((l) => ({ ...l, name: 'A' }), 'level-name');
    store().undo();
    store().edit((l) => ({ ...l, name: 'B' }), 'level-name');
    expect(store().history.past).toEqual([start]);
  });
});
