import { useEffect, useRef, useState } from 'react';
import { downloadBlob, downloadJson, readLevelFile, slug } from '../files';
import { analyse } from '../model/analysis';
import { createLevel, sampleLevel } from '../model/level';
import { TERRAINS, type ObjectType } from '../model/types';
import { OBJECT_STYLE, renderPng } from '../render/draw';
import { useEditor, type Tool } from '../store';

const TOOLS: { tool: Tool; label: string; key: string; hint: string }[] = [
  { tool: 'room', label: 'Room', key: 'r', hint: 'Drag a rectangle: floor inside, walls around' },
  { tool: 'paint', label: 'Paint', key: 'b', hint: 'Paint tiles; right-drag erases' },
  { tool: 'rect', label: 'Rect', key: 'x', hint: 'Fill a rectangle with the current terrain' },
  { tool: 'fill', label: 'Fill', key: 'f', hint: 'Bucket-fill a connected area' },
  { tool: 'object', label: 'Place', key: 'o', hint: 'Place the chosen object; right-click removes' },
  { tool: 'select', label: 'Select', key: 'v', hint: 'Select and drag objects; drag empty space to pan' },
];

const OBJECT_TYPES = Object.keys(OBJECT_STYLE) as ObjectType[];

export function Toolbar() {
  const { tool, terrain, objectType, setTool, setTerrain, setObjectType, undo, redo, load } = useEditor();
  const canUndo = useEditor((s) => s.history.past.length > 0);
  const canRedo = useEditor((s) => s.history.future.length > 0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Replacing the level asks for a second click instead of a browser dialog.
  const [armed, setArmed] = useState<'new' | 'sample' | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const s = useEditor.getState();
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? s.redo : s.undo)(); }
        else if (e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); }
        return;
      }
      const t = TOOLS.find((t) => t.key === e.key.toLowerCase());
      if (t) s.setTool(t.tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const fit = () => setTimeout(() => window.dispatchEvent(new Event('blockout:fit')), 0);

  const replaceWith = (which: 'new' | 'sample') => {
    if (armed !== which) {
      setArmed(which);
      setTimeout(() => setArmed((a) => (a === which ? null : a)), 3000);
      return;
    }
    setArmed(null);
    load(which === 'new' ? createLevel() : sampleLevel());
    fit();
  };

  const open = async (file: File | undefined) => {
    if (!file) return;
    try {
      load(await readLevelFile(file));
      setMessage(null);
      fit();
    } catch (e) {
      setMessage(`Could not open ${file.name}: ${(e as Error).message}`);
    }
  };

  const level = () => useEditor.getState().history.present;

  const exportPng = async () => {
    const l = level();
    const a = analyse(l);
    const blob = await renderPng(l, { grid: true, labels: true, path: a.criticalPath, unreachable: new Set(), unreachableCells: null });
    downloadBlob(`${slug(l.name)}.png`, blob);
  };

  return (
    <header className="toolbar">
      <strong className="logo">Blockout</strong>

      <div className="group" role="toolbar" aria-label="Tools">
        {TOOLS.map((t) => (
          <button key={t.tool} className={tool === t.tool ? 'active' : ''} title={`${t.hint} (${t.key.toUpperCase()})`} onClick={() => setTool(t.tool)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="group" aria-label="Terrain">
        {TERRAINS.map((t) => (
          <button
            key={t.id}
            className={`swatch${terrain === t.id && tool !== 'object' && tool !== 'select' ? ' active' : ''}`}
            style={{ '--swatch': t.color } as React.CSSProperties}
            title={`${t.name}${t.walkable ? '' : ' (blocks movement)'}`}
            onClick={() => { setTerrain(t.id); if (tool === 'object' || tool === 'select') setTool('paint'); }}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="group" aria-label="Objects">
        {OBJECT_TYPES.map((type) => (
          <button
            key={type}
            className={`obj${tool === 'object' && objectType === type ? ' active' : ''}`}
            style={{ '--swatch': OBJECT_STYLE[type].color } as React.CSSProperties}
            onClick={() => setObjectType(type)}
          >
            {OBJECT_STYLE[type].name}
          </button>
        ))}
      </div>

      <span className="spacer" />
      {message && <span className="error">{message}</span>}

      <div className="group">
        <button disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">Undo</button>
        <button disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Y)">Redo</button>
      </div>
      <div className="group">
        <button onClick={() => replaceWith('new')}>{armed === 'new' ? 'Click again to clear' : 'New'}</button>
        <button onClick={() => replaceWith('sample')}>{armed === 'sample' ? 'Click again to replace' : 'Sample'}</button>
        <button onClick={() => fileInput.current?.click()}>Open…</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => { void open(e.target.files?.[0]); e.target.value = ''; }}
        />
        <button onClick={() => downloadJson(`${slug(level().name)}.blockout.json`, level())}>Save</button>
        <button className="primary" onClick={() => void exportPng()} title="PNG of the map, e.g. for a Forge level's Level Map field">
          Export PNG
        </button>
      </div>
    </header>
  );
}
