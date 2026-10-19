import { describe, expect, it } from 'vitest';
import { analyse, isWalkable, shortestPath } from './analysis';
import { commit, historyOf, redo, replace, undo } from './history';
import {
  assertLevel, createLevel, drawRoom, floodFill, lineCells, moveObject, placeObject, rectCells, resize, sampleLevel, setTiles, tileAt,
} from './level';
import { FLOOR, WALL, type Level } from './types';

const ascii = (l: Level) =>
  Array.from({ length: l.height }, (_, y) =>
    Array.from({ length: l.width }, (_, x) => '.#~!,'[tileAt(l, x, y) - 1] ?? ' ').join(''));

describe('editing', () => {
  it('draws rooms with walls around a floor', () => {
    const l = drawRoom(createLevel(5, 4), { x: 0, y: 0 }, { x: 4, y: 3 });
    expect(ascii(l)).toEqual(['#####', '#...#', '#...#', '#####']);
  });

  it('keeps existing floor on a room edge so rooms can connect', () => {
    let l = drawRoom(createLevel(7, 3), { x: 0, y: 0 }, { x: 3, y: 2 });
    l = setTiles(l, [{ x: 3, y: 1 }], FLOOR);
    l = drawRoom(l, { x: 3, y: 0 }, { x: 6, y: 2 });
    expect(ascii(l)[1]).toBe('#.....#');
  });

  it('draws gap-free lines', () => {
    expect(lineCells({ x: 0, y: 0 }, { x: 3, y: 1 })).toHaveLength(4);
    expect(lineCells({ x: 2, y: 2 }, { x: 2, y: 2 })).toEqual([{ x: 2, y: 2 }]);
  });

  it('flood fills one region only', () => {
    let l = setTiles(createLevel(5, 1), [{ x: 2, y: 0 }], WALL);
    l = floodFill(l, { x: 0, y: 0 }, FLOOR);
    expect(ascii(l)).toEqual(['..#  ']);
    expect(floodFill(l, { x: 0, y: 0 }, FLOOR)).toBe(l);
  });

  it('returns the same level when nothing changes', () => {
    const l = createLevel(3, 3);
    expect(setTiles(l, [{ x: 9, y: 9 }], FLOOR)).toBe(l);
  });

  it('keeps one object per cell and one spawn per level', () => {
    let l = createLevel(4, 1);
    l = placeObject(l, 'spawn', { x: 0, y: 0 }).level;
    l = placeObject(l, 'spawn', { x: 1, y: 0 }).level;
    l = placeObject(l, 'enemy', { x: 1, y: 0 }).level;
    expect(l.objects.map((o) => [o.type, o.x])).toEqual([['enemy', 1]]);
    const id = l.objects[0].id;
    l = placeObject(l, 'pickup', { x: 3, y: 0 }).level;
    l = moveObject(l, id, { x: 3, y: 0 });
    expect(l.objects.map((o) => [o.type, o.x])).toEqual([['enemy', 3]]);
  });

  it('resizes and drops what falls outside', () => {
    let l = placeObject(drawRoom(createLevel(6, 6), { x: 0, y: 0 }, { x: 5, y: 5 }), 'goal', { x: 5, y: 5 }).level;
    l = resize(l, 3, 2);
    expect(ascii(l)).toEqual(['###', '#..']);
    expect(l.objects).toEqual([]);
    expect(resize(l, 9999, 0)).toMatchObject({ width: 256, height: 1 });
  });
});

describe('analysis', () => {
  it('treats doors as walkable', () => {
    const l = placeObject(createLevel(2, 1), 'door', { x: 1, y: 0 }).level;
    expect(isWalkable(l, 0, 0)).toBe(false);
    expect(isWalkable(l, 1, 0)).toBe(true);
  });

  it('finds the shortest path around walls', () => {
    // .#.
    // ...
    let l = setTiles(createLevel(3, 2), rectCells({ x: 0, y: 0 }, { x: 2, y: 1 }), FLOOR);
    l = setTiles(l, [{ x: 1, y: 0 }], WALL);
    expect(shortestPath(l, { x: 0, y: 0 }, { x: 2, y: 0 })).toHaveLength(5);
    l = setTiles(l, [{ x: 1, y: 1 }], WALL);
    expect(shortestPath(l, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });

  it('reports the sample level as designed', () => {
    const a = analyse(sampleLevel());
    expect(a.problems.map((p) => p.message)).toEqual(['Pickup "key (unreachable on purpose)" can\'t be reached from the spawn']);
    expect(a.criticalPath?.length).toBeGreaterThan(20);
    expect(a.counts).toMatchObject({ spawn: 1, goal: 1, enemy: 2 });
    expect(a.reachableCells).toBeLessThan(a.walkableCells);
  });

  it('flags missing spawn, unreachable goals and objects in walls', () => {
    let l = drawRoom(createLevel(8, 3), { x: 0, y: 0 }, { x: 3, y: 2 });
    expect(analyse(l).problems.map((p) => p.severity)).toEqual(['error', 'warning']);
    l = placeObject(l, 'spawn', { x: 1, y: 1 }).level;
    l = placeObject(l, 'enemy', { x: 0, y: 0 }).level;
    l = placeObject(drawRoom(l, { x: 5, y: 0 }, { x: 7, y: 2 }), 'goal', { x: 6, y: 1 }).level;
    const messages = analyse(l).problems.map((p) => `${p.severity}: ${p.message}`);
    expect(messages).toEqual([
      'warning: Enemy at 0,0 is on a wall tile',
      "warning: Enemy at 0,0 can't be reached from the spawn",
      "error: Goal at 6,1 can't be reached from the spawn",
    ]);
  });
});

describe('history', () => {
  it('undoes and redoes', () => {
    let h = historyOf(1);
    h = commit(h, 2);
    h = replace(h, 3);
    h = commit(h, 4);
    expect(h.past).toEqual([1, 3]);
    h = undo(undo(h));
    expect(h.present).toBe(1);
    h = redo(h);
    expect(h.present).toBe(3);
    expect(commit(h, 3)).toBe(h);
  });
});

describe('files', () => {
  it('validates level files', () => {
    expect(() => assertLevel(JSON.parse(JSON.stringify(sampleLevel())))).not.toThrow();
    expect(() => assertLevel({ format: 'parley' })).toThrow('Not a Blockout');
    expect(() => assertLevel({ ...createLevel(2, 2), tiles: [0] })).toThrow('does not match');
    expect(() => assertLevel({ ...createLevel(1, 1), tiles: [42] })).toThrow('Unknown terrain');
  });
});
