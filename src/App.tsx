import { useMemo, useState } from 'react';
import { MapCanvas } from './components/MapCanvas';
import { LevelPanel, ObjectPanel, ProblemsPanel, StatsPanel } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { analyse } from './model/analysis';
import { objectAt } from './model/level';
import { TERRAINS, type Cell } from './model/types';
import { OBJECT_STYLE } from './render/draw';
import { useLevel } from './store';

export default function App() {
  const level = useLevel();
  const analysis = useMemo(() => analyse(level), [level]);
  const [hover, setHover] = useState<Cell | null>(null);
  const hovered = hover && objectAt(level, hover.x, hover.y);

  return (
    <div className="app">
      <Toolbar />
      <main className="workspace">
        <div className="canvas-wrap">
          <MapCanvas analysis={analysis} onHover={setHover} />
          <div className="status">
            {hover ? (
              <>
                {hover.x}, {hover.y} · {TERRAINS[level.tiles[hover.y * level.width + hover.x]].name}
                {hovered && ` · ${OBJECT_STYLE[hovered.type].name}${hovered.label ? ` "${hovered.label}"` : ''}`}
              </>
            ) : (
              <span className="muted">Wheel to zoom · middle-drag or Space+drag to pan · right-click erases</span>
            )}
          </div>
        </div>
        <aside className="sidebar">
          <ObjectPanel />
          <ProblemsPanel analysis={analysis} />
          <StatsPanel analysis={analysis} />
          <LevelPanel />
        </aside>
      </main>
    </div>
  );
}
