// Canvas drawing shared by the editor view and the PNG export.

import { TERRAINS, type Cell, type Level, type LevelObject, type ObjectType } from '../model/types';

export const OBJECT_STYLE: Record<ObjectType, { color: string; letter: string; name: string; plural: string }> = {
  spawn: { color: '#4fd16b', letter: 'S', name: 'Spawn', plural: 'Spawns' },
  goal: { color: '#f4c15d', letter: 'G', name: 'Goal', plural: 'Goals' },
  enemy: { color: '#ff5d5d', letter: 'E', name: 'Enemy', plural: 'Enemies' },
  pickup: { color: '#5ed3e6', letter: 'P', name: 'Pickup', plural: 'Pickups' },
  door: { color: '#c08a4e', letter: 'D', name: 'Door', plural: 'Doors' },
  note: { color: '#c58cff', letter: '✎', name: 'Note', plural: 'Notes' },
};

export interface DrawOptions {
  /** Size of one cell in canvas pixels. */
  cell: number;
  grid: boolean;
  labels: boolean;
  path: Cell[] | null;
  unreachable: Set<string>;
  /** Walkable cells the spawn can't reach, as a row-major mask; drawn with a red tint. */
  unreachableCells: Uint8Array | null;
  selectedId: string | null;
}

export function drawLevel(ctx: CanvasRenderingContext2D, l: Level, o: DrawOptions) {
  const { cell } = o;

  for (let y = 0; y < l.height; y++) {
    for (let x = 0; x < l.width; x++) {
      ctx.fillStyle = TERRAINS[l.tiles[y * l.width + x]]?.color ?? '#ff00ff';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  if (o.unreachableCells) {
    ctx.fillStyle = 'rgba(255, 60, 60, 0.28)';
    for (let i = 0; i < o.unreachableCells.length; i++) {
      if (o.unreachableCells[i]) ctx.fillRect((i % l.width) * cell, Math.floor(i / l.width) * cell, cell, cell);
    }
  }

  if (o.grid && cell >= 8) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= l.width; x++) { ctx.moveTo(x * cell + 0.5, 0); ctx.lineTo(x * cell + 0.5, l.height * cell); }
    for (let y = 0; y <= l.height; y++) { ctx.moveTo(0, y * cell + 0.5); ctx.lineTo(l.width * cell, y * cell + 0.5); }
    ctx.stroke();
  }

  if (o.path && o.path.length > 1) {
    ctx.strokeStyle = 'rgba(244, 193, 93, 0.9)';
    ctx.lineWidth = Math.max(2, cell / 8);
    ctx.setLineDash([cell / 3, cell / 4]);
    ctx.beginPath();
    o.path.forEach((c, i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, (c.x + 0.5) * cell, (c.y + 0.5) * cell));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const obj of l.objects) drawObject(ctx, obj, o);

  // Outline of the level bounds, so empty space at the edges is visible.
  ctx.strokeStyle = 'rgba(122, 162, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, l.width * cell, l.height * cell);
}

function drawObject(ctx: CanvasRenderingContext2D, obj: LevelObject, o: DrawOptions) {
  const { cell } = o;
  const style = OBJECT_STYLE[obj.type];
  const cx = (obj.x + 0.5) * cell, cy = (obj.y + 0.5) * cell, r = cell * 0.36;

  ctx.fillStyle = style.color;
  ctx.strokeStyle = '#0d1020';
  ctx.lineWidth = Math.max(1, cell / 16);
  ctx.beginPath();
  if (obj.type === 'door') ctx.rect(obj.x * cell + cell * 0.12, obj.y * cell + cell * 0.12, cell * 0.76, cell * 0.76);
  else if (obj.type === 'goal') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  } else ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (cell >= 12) {
    ctx.fillStyle = '#0d1020';
    ctx.font = `bold ${Math.round(cell * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.letter, cx, cy + 1);
  }

  if (o.unreachable.has(obj.id)) {
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = Math.max(2, cell / 10);
    ctx.setLineDash([cell / 6, cell / 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (obj.id === o.selectedId) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(obj.x * cell + 1, obj.y * cell + 1, cell - 2, cell - 2);
  }

  if (o.labels && obj.label && cell >= 18) {
    ctx.font = `${Math.max(10, Math.round(cell * 0.4))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tw = ctx.measureText(obj.label).width;
    ctx.fillStyle = 'rgba(13, 16, 32, 0.75)';
    ctx.fillRect(cx - tw / 2 - 3, (obj.y + 1) * cell, tw + 6, cell * 0.5);
    ctx.fillStyle = '#e6e8ee';
    ctx.fillText(obj.label, cx, (obj.y + 1) * cell + 1);
  }
}

/** Renders the whole level to a PNG blob, e.g. for Forge's "Level Map" image field. */
export function renderPng(l: Level, o: Omit<DrawOptions, 'cell' | 'selectedId'>, cell = 24): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = l.width * cell;
  canvas.height = l.height * cell;
  drawLevel(canvas.getContext('2d')!, l, { ...o, cell, selectedId: null });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'));
}
