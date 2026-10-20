import { useEffect, useState } from 'react';
import { label, type Analysis } from '../model/analysis';
import { MAX_SIZE, removeObject, resize, updateObject } from '../model/level';
import type { ObjectType } from '../model/types';
import { OBJECT_STYLE } from '../render/draw';
import { useEditor, useLevel } from '../store';

export function LevelPanel() {
  const level = useLevel();
  const edit = useEditor((s) => s.edit);
  const [w, setW] = useState(level.width);
  const [h, setH] = useState(level.height);
  useEffect(() => { setW(level.width); setH(level.height); }, [level.width, level.height]);

  const changed = w !== level.width || h !== level.height;
  return (
    <section className="panel">
      <h2>Level</h2>
      <label className="field">
        <span>Name</span>
        <input value={level.name} onChange={(e) => { const name = e.target.value; edit((l) => ({ ...l, name }), 'level-name'); }} />
      </label>
      <div className="row">
        <label className="field small">
          <span>Width</span>
          <input type="number" min={1} max={MAX_SIZE} value={w} onChange={(e) => setW(Number(e.target.value))} />
        </label>
        <label className="field small">
          <span>Height</span>
          <input type="number" min={1} max={MAX_SIZE} value={h} onChange={(e) => setH(Number(e.target.value))} />
        </label>
        <button disabled={!changed} onClick={() => edit((l) => resize(l, w, h))} title="Grows or crops from the bottom-right">
          Resize
        </button>
      </div>
    </section>
  );
}

export function ObjectPanel() {
  const level = useLevel();
  const { selectedId, edit, select } = useEditor();
  const obj = level.objects.find((o) => o.id === selectedId);
  if (!obj) return null;

  return (
    <section className="panel">
      <h2>Selected object</h2>
      <div className="row">
        <label className="field small">
          <span>Type</span>
          <select value={obj.type} onChange={(e) => edit((l) => updateObject(l, obj.id, { type: e.target.value as ObjectType }))}>
            {(Object.keys(OBJECT_STYLE) as ObjectType[]).map((t) => <option key={t} value={t}>{OBJECT_STYLE[t].name}</option>)}
          </select>
        </label>
        <span className="muted pos">at {obj.x}, {obj.y}</span>
      </div>
      <label className="field">
        <span>Label</span>
        <input value={obj.label} placeholder={obj.type === 'enemy' ? 'e.g. rat' : obj.type === 'pickup' ? 'e.g. key' : ''}
          onChange={(e) => { const value = e.target.value; edit((l) => updateObject(l, obj.id, { label: value }), `label-${obj.id}`); }} />
      </label>
      {(obj.type === 'door' || obj.type === 'pickup') && (
        <label className="field">
          <span>{obj.type === 'door' ? 'Needs key' : 'Is key'}</span>
          <input value={obj.key ?? ''} list="level-keys" placeholder={obj.type === 'door' ? 'empty: always open' : 'empty: not a key'}
            onChange={(e) => { const key = e.target.value.trim(); edit((l) => updateObject(l, obj.id, { key: key || undefined }), `key-${obj.id}`); }} />
          <datalist id="level-keys">
            {[...new Set(level.objects.map((o) => o.key).filter(Boolean))].map((k) => <option key={k} value={k} />)}
          </datalist>
        </label>
      )}
      <div className="row">
        <button className="danger" onClick={() => { edit((l) => removeObject(l, obj.id)); select(null); }}>Delete</button>
      </div>
    </section>
  );
}

export function ProblemsPanel({ analysis }: { analysis: Analysis }) {
  const select = useEditor((s) => s.select);
  const { problems } = analysis;
  return (
    <section className="panel">
      <h2>Problems {problems.length > 0 && <span className="badge">{problems.length}</span>}</h2>
      {problems.length === 0 ? <p className="muted">Everything is reachable.</p> : (
        <ul className="problems">
          {problems.map((p, i) => (
            <li key={i} className={p.severity}>
              {p.objectId ? <button className="link" onClick={() => select(p.objectId!)}>{p.message}</button> : p.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StatsPanel({ analysis }: { analysis: Analysis }) {
  const { showPath, showReach, toggle } = useEditor();
  const level = useLevel();
  const { counts, walkableCells, reachableCells, criticalPath } = analysis;
  const goal = criticalPath && level.objects.find((o) => o.type === 'goal' && o.x === criticalPath.at(-1)!.x && o.y === criticalPath.at(-1)!.y);
  return (
    <section className="panel">
      <h2>Stats</h2>
      <table className="stats">
        <tbody>
          <tr><td>Walkable tiles</td><td>{walkableCells}</td></tr>
          <tr><td>Reachable from spawn</td><td>{counts.spawn ? `${reachableCells} (${walkableCells ? Math.round((reachableCells / walkableCells) * 100) : 0}%)` : '—'}</td></tr>
          <tr><td>Critical path</td><td>{criticalPath ? `${criticalPath.length - 1} steps to ${goal ? label(goal) : 'goal'}` : '—'}</td></tr>
          {(Object.keys(OBJECT_STYLE) as ObjectType[]).filter((t) => counts[t]).map((t) => (
            <tr key={t}><td>{OBJECT_STYLE[t].plural}</td><td>{counts[t]}</td></tr>
          ))}
        </tbody>
      </table>
      <label className="check"><input type="checkbox" checked={showPath} onChange={() => toggle('showPath')} /> Show critical path</label>
      <label className="check"><input type="checkbox" checked={showReach} onChange={() => toggle('showReach')} /> Tint unreachable floor</label>
    </section>
  );
}
