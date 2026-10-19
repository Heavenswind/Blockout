// A level is a grid of terrain tiles plus objects placed on cells.
// Everything is plain JSON so the file can be loaded by any engine.

export interface Terrain {
  id: number;
  name: string;
  color: string;
  /** Whether the player can stand on it. Doors make any cell walkable. */
  walkable: boolean;
}

// Index in this list is the value stored in `Level.tiles`. Append only: reordering breaks saved files.
export const TERRAINS: Terrain[] = [
  { id: 0, name: 'Empty', color: '#101216', walkable: false },
  { id: 1, name: 'Floor', color: '#8a8f99', walkable: true },
  { id: 2, name: 'Wall', color: '#3b4250', walkable: false },
  { id: 3, name: 'Water', color: '#2f6fb3', walkable: false },
  { id: 4, name: 'Hazard', color: '#b8453a', walkable: true },
  { id: 5, name: 'Grass', color: '#4f8a4a', walkable: true },
];

export const EMPTY = 0;
export const FLOOR = 1;
export const WALL = 2;

export type ObjectType = 'spawn' | 'goal' | 'enemy' | 'pickup' | 'door' | 'note';

export interface LevelObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  /** Free text: enemy kind, pickup kind, note text… shown on the map and exported. */
  label: string;
}

export interface Level {
  format: 'blockout';
  version: 1;
  name: string;
  width: number;
  height: number;
  /** Row-major terrain ids, length width * height. */
  tiles: number[];
  objects: LevelObject[];
}

export interface Cell {
  x: number;
  y: number;
}
