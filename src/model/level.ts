// Pure editing operations. Each returns a new Level (or the same one when nothing changed),
// which keeps undo/redo a matter of keeping old references.

import { EMPTY, FLOOR, TERRAINS, WALL, type Cell, type Level, type LevelObject, type ObjectType } from './types';

export const MAX_SIZE = 256;

export function newId(): string {
  return `o_${Math.random().toString(36).slice(2, 9)}`;
}

export function createLevel(width = 32, height = 24, name = 'Untitled level'): Level {
  return { format: 'blockout', version: 1, name, width, height, tiles: new Array(width * height).fill(EMPTY), objects: [] };
}

export const inBounds = (l: Level, x: number, y: number) => x >= 0 && y >= 0 && x < l.width && y < l.height;
export const tileAt = (l: Level, x: number, y: number) => (inBounds(l, x, y) ? l.tiles[y * l.width + x] : EMPTY);

/** Sets many cells at once. Out-of-bounds cells are ignored. */
export function setTiles(l: Level, cells: Iterable<Cell>, terrain: number): Level {
  let tiles: number[] | null = null;
  for (const { x, y } of cells) {
    if (!inBounds(l, x, y)) continue;
    const i = y * l.width + x;
    if ((tiles ?? l.tiles)[i] === terrain) continue;
    tiles ??= [...l.tiles];
    tiles[i] = terrain;
  }
  return tiles ? { ...l, tiles } : l;
}

/** All cells on the straight line between two cells (Bresenham), so fast mouse drags don't leave gaps. */
export function lineCells(a: Cell, b: Cell): Cell[] {
  const cells: Cell[] = [];
  let { x, y } = a;
  const dx = Math.abs(b.x - x), dy = -Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1, sy = y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    cells.push({ x, y });
    if (x === b.x && y === b.y) return cells;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

export function rectCells(a: Cell, b: Cell): Cell[] {
  const cells: Cell[] = [];
  for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
    for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) cells.push({ x, y });
  }
  return cells;
}

/** A room: floor inside, walls around the edge. Existing floor on the edge is kept, so rooms can share an opening. */
export function drawRoom(l: Level, a: Cell, b: Cell): Level {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x);
  const y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  const edge: Cell[] = [];
  const inside: Cell[] = [];
  for (const c of rectCells(a, b)) {
    (c.x === x0 || c.x === x1 || c.y === y0 || c.y === y1 ? edge : inside).push(c);
  }
  const withFloor = setTiles(l, inside, FLOOR);
  return setTiles(withFloor, edge.filter((c) => tileAt(withFloor, c.x, c.y) !== FLOOR), WALL);
}

/** Bucket fill of the 4-connected region of same terrain starting at `start`. */
export function floodFill(l: Level, start: Cell, terrain: number): Level {
  if (!inBounds(l, start.x, start.y)) return l;
  const target = tileAt(l, start.x, start.y);
  if (target === terrain) return l;
  const seen = new Uint8Array(l.width * l.height);
  const cells: Cell[] = [];
  const stack = [start];
  while (stack.length) {
    const c = stack.pop()!;
    if (!inBounds(l, c.x, c.y)) continue;
    const i = c.y * l.width + c.x;
    if (seen[i] || l.tiles[i] !== target) continue;
    seen[i] = 1;
    cells.push(c);
    stack.push({ x: c.x + 1, y: c.y }, { x: c.x - 1, y: c.y }, { x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 1 });
  }
  return setTiles(l, cells, terrain);
}

/** Resizes from the top-left corner; tiles and objects outside the new size are dropped. */
export function resize(l: Level, width: number, height: number): Level {
  width = Math.max(1, Math.min(MAX_SIZE, Math.round(width)));
  height = Math.max(1, Math.min(MAX_SIZE, Math.round(height)));
  const tiles = new Array(width * height).fill(EMPTY);
  for (let y = 0; y < Math.min(height, l.height); y++) {
    for (let x = 0; x < Math.min(width, l.width); x++) tiles[y * width + x] = l.tiles[y * l.width + x];
  }
  return { ...l, width, height, tiles, objects: l.objects.filter((o) => o.x < width && o.y < height) };
}

export const objectAt = (l: Level, x: number, y: number) => l.objects.find((o) => o.x === x && o.y === y);

/** Places an object, replacing any object already on that cell. A level has at most one spawn. */
export function placeObject(l: Level, type: ObjectType, cell: Cell, label = ''): { level: Level; object: LevelObject | null } {
  if (!inBounds(l, cell.x, cell.y)) return { level: l, object: null };
  const object: LevelObject = { id: newId(), type, x: cell.x, y: cell.y, label };
  const objects = l.objects.filter((o) => !(o.x === cell.x && o.y === cell.y) && !(type === 'spawn' && o.type === 'spawn'));
  return { level: { ...l, objects: [...objects, object] }, object };
}

export function moveObject(l: Level, id: string, cell: Cell): Level {
  if (!inBounds(l, cell.x, cell.y)) return l;
  const moving = l.objects.find((o) => o.id === id);
  if (!moving || (moving.x === cell.x && moving.y === cell.y)) return l;
  return {
    ...l,
    objects: l.objects
      .filter((o) => o.id === id || !(o.x === cell.x && o.y === cell.y))
      .map((o) => (o.id === id ? { ...o, x: cell.x, y: cell.y } : o)),
  };
}

export function updateObject(l: Level, id: string, patch: Partial<Omit<LevelObject, 'id'>>): Level {
  return { ...l, objects: l.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) };
}

export function removeObject(l: Level, id: string): Level {
  return { ...l, objects: l.objects.filter((o) => o.id !== id) };
}

/** Throws if `data` isn't a Blockout level. */
export function assertLevel(data: unknown): asserts data is Level {
  const l = data as Partial<Level> | null;
  if (!l || typeof l !== 'object' || l.format !== 'blockout') throw new Error('Not a Blockout level file');
  if (l.version !== 1) throw new Error(`Unsupported Blockout file version: ${String(l.version)}`);
  const { width, height, tiles, objects } = l;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width! < 1 || height! < 1 || width! > MAX_SIZE || height! > MAX_SIZE) {
    throw new Error('Level size is missing or out of range');
  }
  if (!Array.isArray(tiles) || tiles.length !== width! * height!) throw new Error('Tile data does not match the level size');
  if (tiles.some((t) => !Number.isInteger(t) || t < 0 || t >= TERRAINS.length)) throw new Error('Unknown terrain in tile data');
  if (!Array.isArray(objects)) throw new Error('Level file is missing objects');
  if (objects.some((o) => o?.key !== undefined && typeof o.key !== 'string')) throw new Error('An object has a key that is not text');
}

/** A small made-up level shown on first launch: two rooms, a corridor, a locked-off side room. */
export function sampleLevel(): Level {
  let l = createLevel(30, 18, 'Sewer entrance');
  l = drawRoom(l, { x: 1, y: 1 }, { x: 9, y: 8 });
  l = drawRoom(l, { x: 18, y: 4 }, { x: 28, y: 15 });
  l = drawRoom(l, { x: 9, y: 4 }, { x: 18, y: 6 });
  l = setTiles(l, [{ x: 18, y: 5 }], FLOOR);
  l = setTiles(l, rectCells({ x: 21, y: 9 }, { x: 25, y: 11 }), 3);
  l = drawRoom(l, { x: 2, y: 11 }, { x: 8, y: 16 });
  l = setTiles(l, rectCells({ x: 4, y: 13 }, { x: 6, y: 14 }), 5);
  const place = (type: ObjectType, x: number, y: number, label = '') => { l = placeObject(l, type, { x, y }, label).level; };
  place('spawn', 3, 3);
  place('pickup', 7, 6, 'health');
  place('door', 9, 5, 'wooden door');
  place('enemy', 22, 6, 'rat');
  place('enemy', 26, 13, 'rat');
  place('pickup', 20, 13, 'coins');
  place('goal', 27, 5, 'ladder up');
  place('pickup', 5, 13, 'key (unreachable on purpose)');
  place('note', 14, 2, 'add a vent shortcut here?');
  return l;
}
