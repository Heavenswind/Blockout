import { describe, expect, it } from 'vitest';
import { analyse, explore, isWalkable } from './analysis';
import { createLevel, placeObject, rectCells, setTiles, updateObject } from './level';
import { FLOOR, type Level, type ObjectType } from './types';

/** A one-row corridor from x=1 to x=10: spawn at 1, goal at 10, plus whatever each test adds. */
function corridor(extra: { type: ObjectType; x: number; key?: string }[]): Level {
  let l = setTiles(createLevel(12, 3, 'Corridor'), rectCells({ x: 1, y: 1 }, { x: 10, y: 1 }), FLOOR);
  for (const o of [{ type: 'spawn' as const, x: 1 }, { type: 'goal' as const, x: 10 }, ...extra]) {
    const placed = placeObject(l, o.type, { x: o.x, y: 1 });
    l = placed.level;
    if ('key' in o && o.key) l = updateObject(l, placed.object!.id, { key: o.key });
  }
  return l;
}
const messages = (l: Level) => analyse(l).problems.map((p) => p.message);

describe('keys and locked doors', () => {
  it('opens a locked door once its key is picked up', () => {
    const l = corridor([{ type: 'pickup', x: 3, key: 'red' }, { type: 'door', x: 6, key: 'red' }]);
    expect([...explore(l, { x: 1, y: 1 }).keys]).toEqual(['red']);
    const a = analyse(l);
    expect(a.problems).toEqual([]);
    expect(a.criticalPath).toHaveLength(10);
  });

  it('reports a key locked behind the door it opens', () => {
    const l = corridor([{ type: 'door', x: 6, key: 'red' }, { type: 'pickup', x: 8, key: 'red' }]);
    const a = analyse(l);
    expect(a.criticalPath).toBeNull();
    expect(messages(l)).toEqual([
      `Goal at 10,1 is behind a locked door: Door at 6,1 needs key "red", which the player can't reach`,
      `Pickup at 8,1 is behind a locked door: Door at 6,1 needs key "red", which the player can't reach`,
    ]);
    expect(a.problems[0].severity).toBe('error');
  });

  it('reports doors whose key no pickup gives', () => {
    const l = corridor([{ type: 'door', x: 6, key: 'red' }]);
    expect(messages(l)).toEqual([
      `Goal at 10,1 is behind a locked door: Door at 6,1 needs key "red", which no pickup gives`,
      `Door at 6,1 needs key "red", but no pickup is that key`,
    ]);
  });

  it('follows chains of keys', () => {
    const l = corridor([
      { type: 'pickup', x: 2, key: 'red' },
      { type: 'door', x: 4, key: 'red' },
      { type: 'pickup', x: 5, key: 'blue' },
      { type: 'door', x: 7, key: 'blue' },
    ]);
    expect([...explore(l, { x: 1, y: 1 }).keys]).toEqual(['red', 'blue']);
    expect(analyse(l).problems).toEqual([]);
  });

  it('warns about keys that open nothing, and leaves unlocked doors open', () => {
    const l = corridor([{ type: 'pickup', x: 3, key: 'blue' }, { type: 'door', x: 6 }]);
    expect(messages(l)).toEqual([`Pickup at 3,1 is key "blue", but no door needs it`]);
  });

  it('treats every door as open when no keys are given, for drawing', () => {
    const l = corridor([{ type: 'door', x: 6, key: 'red' }]);
    expect(isWalkable(l, 6, 1)).toBe(true);
    expect(isWalkable(l, 6, 1, new Set())).toBe(false);
    expect(isWalkable(l, 6, 1, new Set(['red']))).toBe(true);
  });
});
