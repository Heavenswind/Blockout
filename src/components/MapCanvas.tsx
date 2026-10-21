import { useEffect, useRef, useState } from 'react';
import type { Analysis } from '../model/analysis';
import { isWalkable } from '../model/analysis';
import { drawRoom, floodFill, inBounds, lineCells, moveObject, objectAt, placeObject, rectCells, removeObject, setTiles } from '../model/level';
import { EMPTY, type Cell, type Level } from '../model/types';
import { drawLevel } from '../render/draw';
import { useEditor, useLevel } from '../store';

const BASE_CELL = 24;

interface View {
  zoom: number;
  x: number;
  y: number;
}

type Drag =
  | { kind: 'pan'; startX: number; startY: number; view: View }
  | { kind: 'paint'; last: Cell; terrain: number }
  | { kind: 'shape'; start: Cell; erase: boolean }
  | { kind: 'move'; id: string };

/** Walkable floor the player can't get to, keys and locked doors included. */
function unreachableMask(l: Level, reach: Int32Array | null): Uint8Array | null {
  if (!reach) return null;
  const mask = new Uint8Array(l.width * l.height);
  for (let y = 0; y < l.height; y++) {
    for (let x = 0; x < l.width; x++) {
      if (reach[y * l.width + x] < 0 && isWalkable(l, x, y)) mask[y * l.width + x] = 1;
    }
  }
  return mask;
}

export function MapCanvas({ analysis, onHover }: { analysis: Analysis; onHover: (c: Cell | null) => void }) {
  const level = useLevel();
  const { tool, selectedId, showPath, showReach } = useEditor();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<View>({ zoom: 1, x: 24, y: 24 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const drag = useRef<Drag | null>(null);
  const spaceDown = useRef(false);
  const fitted = useRef(false);

  // Track the canvas size in CSS pixels.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Fit the level to the screen once the canvas has a size, and again when a different level is loaded.
  const fit = () => {
    if (!size.w) return;
    const zoom = Math.min((size.w - 48) / (level.width * BASE_CELL), (size.h - 48) / (level.height * BASE_CELL), 2);
    setView({ zoom, x: (size.w - level.width * BASE_CELL * zoom) / 2, y: (size.h - level.height * BASE_CELL * zoom) / 2 });
  };
  useEffect(() => {
    if (size.w && !fitted.current) { fitted.current = true; fit(); }
  }, [size.w]);
  useEffect(() => {
    const onFit = () => fit();
    window.addEventListener('blockout:fit', onFit);
    return () => window.removeEventListener('blockout:fit', onFit);
  });

  const mask = showReach ? unreachableMask(level, analysis.reach) : null;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.translate(view.x, view.y);
    drawLevel(ctx, level, {
      cell: BASE_CELL * view.zoom,
      grid: true,
      labels: true,
      path: showPath ? analysis.criticalPath : null,
      unreachable: analysis.unreachable,
      unreachableCells: mask,
      selectedId,
    });
  });

  const cellAt = (e: { clientX: number; clientY: number }): Cell => {
    const r = canvasRef.current!.getBoundingClientRect();
    const cell = BASE_CELL * view.zoom;
    return { x: Math.floor((e.clientX - r.left - view.x) / cell), y: Math.floor((e.clientY - r.top - view.y) / cell) };
  };

  // Keyboard: space to pan, Delete removes the selected object.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.code === 'Space') { spaceDown.current = true; e.preventDefault(); }
      const s = useEditor.getState();
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) {
        const id = s.selectedId;
        s.edit((l) => removeObject(l, id));
        s.select(null);
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    canvasRef.current!.setPointerCapture(e.pointerId);
    const s = useEditor.getState();
    const c = cellAt(e);
    const erase = e.button === 2;

    if (e.button === 1 || spaceDown.current) {
      drag.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, view };
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;

    switch (s.tool) {
      case 'paint': {
        const terrain = erase ? EMPTY : s.terrain;
        s.beginStroke();
        s.strokeEdit((_, cur) => setTiles(cur, [c], terrain));
        drag.current = { kind: 'paint', last: c, terrain };
        break;
      }
      case 'room':
      case 'rect':
      case 'line':
        if (!inBounds(s.history.present, c.x, c.y)) return;
        s.beginStroke();
        drag.current = { kind: 'shape', start: c, erase };
        applyShape(c, c, erase);
        break;
      case 'fill':
        s.edit((l) => floodFill(l, c, erase ? EMPTY : s.terrain));
        break;
      case 'object': {
        if (erase) {
          const o = objectAt(s.history.present, c.x, c.y);
          if (o) s.edit((l) => removeObject(l, o.id));
          break;
        }
        const { level: next, object } = placeObject(s.history.present, s.objectType, c);
        if (object) {
          s.edit(() => next);
          s.select(object.id);
        }
        break;
      }
      case 'select': {
        const o = objectAt(s.history.present, c.x, c.y);
        s.select(o?.id ?? null);
        if (o) {
          s.beginStroke();
          drag.current = { kind: 'move', id: o.id };
        } else {
          drag.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, view };
        }
        break;
      }
    }
  };

  const applyShape = (start: Cell, end: Cell, erase: boolean) => {
    const s = useEditor.getState();
    if (s.tool === 'line') s.strokeEdit((base) => setTiles(base, lineCells(start, end), erase ? EMPTY : s.terrain));
    else if (erase) s.strokeEdit((base) => setTiles(base, rectCells(start, end), EMPTY));
    else if (s.tool === 'room') s.strokeEdit((base) => drawRoom(base, start, end));
    else s.strokeEdit((base) => setTiles(base, rectCells(start, end), s.terrain));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const c = cellAt(e);
    onHover(inBounds(level, c.x, c.y) ? c : null);
    const d = drag.current;
    if (!d) return;
    const s = useEditor.getState();
    switch (d.kind) {
      case 'pan':
        setView({ ...d.view, x: d.view.x + e.clientX - d.startX, y: d.view.y + e.clientY - d.startY });
        break;
      case 'paint':
        if (c.x !== d.last.x || c.y !== d.last.y) {
          const cells = lineCells(d.last, c);
          s.strokeEdit((_, cur) => setTiles(cur, cells, d.terrain));
          d.last = c;
        }
        break;
      case 'shape':
        applyShape(d.start, { x: Math.max(0, Math.min(level.width - 1, c.x)), y: Math.max(0, Math.min(level.height - 1, c.y)) }, d.erase);
        break;
      case 'move':
        s.strokeEdit((base) => moveObject(base, d.id, c));
        break;
    }
  };

  const onPointerUp = () => {
    if (drag.current && drag.current.kind !== 'pan') useEditor.getState().endStroke();
    drag.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const zoom = Math.min(6, Math.max(0.15, view.zoom * Math.exp(-e.deltaY * 0.0015)));
    // Keep the point under the cursor fixed while zooming.
    setView({ zoom, x: mx - ((mx - view.x) * zoom) / view.zoom, y: my - ((my - view.y) * zoom) / view.zoom });
  };

  return (
    <canvas
      ref={canvasRef}
      className={`map tool-${tool}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => onHover(null)}
      onWheel={onWheel}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
