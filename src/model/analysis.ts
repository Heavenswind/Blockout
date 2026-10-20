// Answers the questions a blockout is for: can the player get everywhere,
// and how long is the critical path?

import { inBounds, tileAt } from './level';
import { TERRAINS, type Cell, type Level, type LevelObject } from './types';

export interface Problem {
  severity: 'error' | 'warning';
  objectId?: string;
  message: string;
}

/**
 * Doors make any cell walkable. With `keys`, a locked door only opens if its key is among them;
 * without, every door counts as open.
 */
export function isWalkable(l: Level, x: number, y: number, keys?: ReadonlySet<string>): boolean {
  if (!inBounds(l, x, y)) return false;
  const door = l.objects.find((o) => o.type === 'door' && o.x === x && o.y === y);
  if (door) return !door.key || !keys || keys.has(door.key);
  return TERRAINS[tileAt(l, x, y)]?.walkable ?? false;
}

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Breadth-first search over walkable cells. Returns the distance (in steps) to every reachable cell, -1 elsewhere. */
export function distancesFrom(l: Level, start: Cell, keys?: ReadonlySet<string>): Int32Array {
  const dist = new Int32Array(l.width * l.height).fill(-1);
  if (!isWalkable(l, start.x, start.y, keys)) return dist;
  const queue: Cell[] = [start];
  dist[start.y * l.width + start.x] = 0;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    const d = dist[c.y * l.width + c.x];
    for (const [dx, dy] of NEIGHBOURS) {
      const x = c.x + dx, y = c.y + dy;
      if (!isWalkable(l, x, y, keys) || dist[y * l.width + x] !== -1) continue;
      dist[y * l.width + x] = d + 1;
      queue.push({ x, y });
    }
  }
  return dist;
}

/**
 * Flood fill that treats locked doors as walls until their key has been picked up, repeating
 * until no new key turns up. Returns the final distances and the keys the player can collect.
 */
export function explore(l: Level, start: Cell): { dist: Int32Array; keys: Set<string> } {
  const keys = new Set<string>();
  for (;;) {
    const dist = distancesFrom(l, start, keys);
    const found = l.objects.filter((o) => o.type === 'pickup' && o.key && !keys.has(o.key) && dist[o.y * l.width + o.x] >= 0);
    if (found.length === 0) return { dist, keys };
    for (const k of found) keys.add(k.key!);
  }
}

/** Shortest walkable path between two cells, inclusive, or null if there isn't one. */
export function shortestPath(l: Level, from: Cell, to: Cell, keys?: ReadonlySet<string>): Cell[] | null {
  const dist = distancesFrom(l, from, keys);
  if (!inBounds(l, to.x, to.y) || dist[to.y * l.width + to.x] < 0) return null;
  // Walk back downhill from the target.
  const path: Cell[] = [to];
  let c = to;
  while (c.x !== from.x || c.y !== from.y) {
    const d = dist[c.y * l.width + c.x];
    const prev = NEIGHBOURS.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }))
      .find((n) => inBounds(l, n.x, n.y) && dist[n.y * l.width + n.x] === d - 1)!;
    path.push(prev);
    c = prev;
  }
  return path.reverse();
}

export const spawnOf = (l: Level) => l.objects.find((o) => o.type === 'spawn');

export interface Analysis {
  problems: Problem[];
  /** Objects the player can't reach from the spawn (empty when there's no spawn). */
  unreachable: Set<string>;
  /** Spawn-to-goal path for the first reachable goal. */
  criticalPath: Cell[] | null;
  /** Steps from the spawn to every cell the player can reach with the keys they can collect; null without a usable spawn. */
  reach: Int32Array | null;
  walkableCells: number;
  reachableCells: number;
  counts: Record<LevelObject['type'], number>;
}

export function analyse(l: Level): Analysis {
  const problems: Problem[] = [];
  const counts = { spawn: 0, goal: 0, enemy: 0, pickup: 0, door: 0, note: 0 };
  for (const o of l.objects) counts[o.type]++;

  let walkableCells = 0;
  for (let y = 0; y < l.height; y++) for (let x = 0; x < l.width; x++) if (isWalkable(l, x, y)) walkableCells++;

  const spawn = spawnOf(l);
  const unreachable = new Set<string>();
  let criticalPath: Cell[] | null = null;
  let reach: Int32Array | null = null;
  let reachableCells = 0;

  if (!spawn) problems.push({ severity: 'error', message: 'No player spawn. Place one with the Spawn tool.' });
  if (counts.goal === 0) problems.push({ severity: 'warning', message: 'No goal placed' });

  for (const o of l.objects) {
    if (o.type === 'note' || o.type === 'door') continue;
    if (!isWalkable(l, o.x, o.y)) {
      problems.push({ severity: 'warning', objectId: o.id, message: `${label(o)} is on a ${TERRAINS[tileAt(l, o.x, o.y)].name.toLowerCase()} tile` });
    }
  }

  if (spawn && isWalkable(l, spawn.x, spawn.y)) {
    // `dist` follows the keys the player can actually collect; `open` pretends every door is open.
    const { dist, keys } = explore(l, spawn);
    const open = distancesFrom(l, spawn);
    reach = dist;
    const reached =(d: Int32Array, o: LevelObject) => d[o.y * l.width + o.x] >= 0 || (o.type === 'door' && doorReachable(l, d, o));
    reachableCells = dist.reduce((n, d) => n + (d >= 0 ? 1 : 0), 0);
    for (const o of l.objects) {
      if (o.type === 'note' || o.type === 'spawn' || reached(dist, o)) continue;
      unreachable.add(o.id);
      problems.push({
        severity: o.type === 'goal' ? 'error' : 'warning',
        objectId: o.id,
        message: reached(open, o)
          ? `${label(o)} is behind a locked door: ${lockedDoorsAround(l, dist, keys)}`
          : `${label(o)} can't be reached from the spawn`,
      });
    }
    const goals = l.objects
      .filter((o) => o.type === 'goal' && dist[o.y * l.width + o.x] >= 0)
      .sort((a, b) => dist[a.y * l.width + a.x] - dist[b.y * l.width + b.x]);
    if (goals[0]) criticalPath = shortestPath(l, spawn, goals[0], keys);
  }

  problems.push(...keyProblems(l));
  return { problems, unreachable, criticalPath, reach, walkableCells, reachableCells, counts };
}

/** The locked doors at the edge of what the player can reach, and why each stays shut. */
function lockedDoorsAround(l: Level, dist: Int32Array, keys: ReadonlySet<string>): string {
  const reasons = l.objects
    .filter((o) => o.type === 'door' && o.key && !keys.has(o.key) && doorReachable(l, dist, o))
    .map((door) => {
      const givers = l.objects.filter((o) => o.type === 'pickup' && o.key === door.key);
      return `${label(door)} needs key "${door.key}", which ${givers.length ? "the player can't reach" : 'no pickup gives'}`;
    });
  return reasons.length ? reasons.join('; ') : 'no door on the way can be opened';
}

/** Doors whose key doesn't exist, and keys that open nothing. */
function keyProblems(l: Level): Problem[] {
  const out: Problem[] = [];
  const doors = l.objects.filter((o) => o.type === 'door' && o.key);
  const keyPickups = l.objects.filter((o) => o.type === 'pickup' && o.key);
  for (const d of doors)
    if (!keyPickups.some((k) => k.key === d.key))
      out.push({ severity: 'warning', objectId: d.id, message: `${label(d)} needs key "${d.key}", but no pickup is that key` });
  for (const k of keyPickups)
    if (!doors.some((d) => d.key === k.key))
      out.push({ severity: 'warning', objectId: k.id, message: `${label(k)} is key "${k.key}", but no door needs it` });
  return out;
}

// A door counts as reached if the player can stand next to it, even when it leads nowhere yet.
function doorReachable(l: Level, dist: Int32Array, door: LevelObject): boolean {
  return NEIGHBOURS.some(([dx, dy]) => inBounds(l, door.x + dx, door.y + dy) && dist[(door.y + dy) * l.width + door.x + dx] >= 0);
}

export function label(o: LevelObject): string {
  const name = o.type[0].toUpperCase() + o.type.slice(1);
  return o.label ? `${name} "${o.label}"` : `${name} at ${o.x},${o.y}`;
}
