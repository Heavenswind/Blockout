// Answers the questions a blockout is for: can the player get everywhere,
// and how long is the critical path?

import { inBounds, tileAt } from './level';
import { TERRAINS, type Cell, type Level, type LevelObject } from './types';

export interface Problem {
  severity: 'error' | 'warning';
  objectId?: string;
  message: string;
}

export function isWalkable(l: Level, x: number, y: number): boolean {
  if (!inBounds(l, x, y)) return false;
  if (l.objects.some((o) => o.type === 'door' && o.x === x && o.y === y)) return true;
  return TERRAINS[tileAt(l, x, y)]?.walkable ?? false;
}

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Breadth-first search over walkable cells. Returns the distance (in steps) to every reachable cell, -1 elsewhere. */
export function distancesFrom(l: Level, start: Cell): Int32Array {
  const dist = new Int32Array(l.width * l.height).fill(-1);
  if (!isWalkable(l, start.x, start.y)) return dist;
  const queue: Cell[] = [start];
  dist[start.y * l.width + start.x] = 0;
  for (let head = 0; head < queue.length; head++) {
    const c = queue[head];
    const d = dist[c.y * l.width + c.x];
    for (const [dx, dy] of NEIGHBOURS) {
      const x = c.x + dx, y = c.y + dy;
      if (!isWalkable(l, x, y) || dist[y * l.width + x] !== -1) continue;
      dist[y * l.width + x] = d + 1;
      queue.push({ x, y });
    }
  }
  return dist;
}

/** Shortest walkable path between two cells, inclusive, or null if there isn't one. */
export function shortestPath(l: Level, from: Cell, to: Cell): Cell[] | null {
  const dist = distancesFrom(l, from);
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
    const dist = distancesFrom(l, spawn);
    reachableCells = dist.reduce((n, d) => n + (d >= 0 ? 1 : 0), 0);
    for (const o of l.objects) {
      if (o.type === 'note' || o.type === 'spawn') continue;
      if (dist[o.y * l.width + o.x] < 0 && !(o.type === 'door' && doorReachable(l, dist, o))) {
        unreachable.add(o.id);
        problems.push({
          severity: o.type === 'goal' ? 'error' : 'warning',
          objectId: o.id,
          message: `${label(o)} can't be reached from the spawn`,
        });
      }
    }
    const goals = l.objects
      .filter((o) => o.type === 'goal' && dist[o.y * l.width + o.x] >= 0)
      .sort((a, b) => dist[a.y * l.width + a.x] - dist[b.y * l.width + b.x]);
    if (goals[0]) criticalPath = shortestPath(l, spawn, goals[0]);
  }

  return { problems, unreachable, criticalPath, walkableCells, reachableCells, counts };
}

// A door counts as reached if the player can stand next to it, even when it leads nowhere yet.
function doorReachable(l: Level, dist: Int32Array, door: LevelObject): boolean {
  return NEIGHBOURS.some(([dx, dy]) => inBounds(l, door.x + dx, door.y + dy) && dist[(door.y + dy) * l.width + door.x + dx] >= 0);
}

export function label(o: LevelObject): string {
  const name = o.type[0].toUpperCase() + o.type.slice(1);
  return o.label ? `${name} "${o.label}"` : `${name} at ${o.x},${o.y}`;
}
