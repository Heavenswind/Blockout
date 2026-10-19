import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { commit, historyOf, redo, replace, undo, type History } from './model/history';
import { assertLevel, sampleLevel } from './model/level';
import { FLOOR, type Level, type ObjectType } from './model/types';

export type Tool = 'paint' | 'room' | 'rect' | 'fill' | 'object' | 'select';

interface EditorState {
  history: History<Level>;
  /** The level as it was when the current drag began; the whole drag becomes one undo step. */
  strokeBase: Level | null;

  tool: Tool;
  terrain: number;
  objectType: ObjectType;
  selectedId: string | null;
  showPath: boolean;
  showReach: boolean;

  /** Applies an edit as its own undo step. */
  edit: (fn: (l: Level) => Level) => void;
  beginStroke: () => void;
  /** Applies an edit inside a drag. `fn` receives the level from before the drag, so previews can be redrawn from scratch. */
  strokeEdit: (fn: (base: Level, current: Level) => Level) => void;
  endStroke: () => void;
  undo: () => void;
  redo: () => void;
  load: (l: Level) => void;

  setTool: (tool: Tool) => void;
  setTerrain: (terrain: number) => void;
  setObjectType: (type: ObjectType) => void;
  select: (id: string | null) => void;
  toggle: (key: 'showPath' | 'showReach') => void;
}

export const useEditor = create<EditorState>()(
  persist(
    (set) => ({
      history: historyOf(sampleLevel()),
      strokeBase: null,
      tool: 'room',
      terrain: FLOOR,
      objectType: 'enemy',
      selectedId: null,
      showPath: true,
      showReach: true,

      edit: (fn) => set((s) => ({ history: commit(s.history, fn(s.history.present)) })),
      beginStroke: () => set((s) => ({ strokeBase: s.history.present })),
      strokeEdit: (fn) =>
        set((s) => (s.strokeBase ? { history: replace(s.history, fn(s.strokeBase, s.history.present)) } : {})),
      endStroke: () =>
        set((s) => {
          if (!s.strokeBase) return {};
          const { history, strokeBase } = s;
          // Rewind to the pre-drag level, then commit the result as a single step.
          const rewound = { ...history, present: strokeBase };
          return { history: commit(rewound, history.present), strokeBase: null };
        }),
      undo: () => set((s) => ({ history: undo(s.history), strokeBase: null })),
      redo: () => set((s) => ({ history: redo(s.history), strokeBase: null })),
      load: (l) => set({ history: historyOf(l), strokeBase: null, selectedId: null }),

      setTool: (tool) => set({ tool }),
      setTerrain: (terrain) => set({ terrain }),
      setObjectType: (objectType) => set({ objectType, tool: 'object' }),
      select: (selectedId) => set({ selectedId }),
      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Pick<EditorState, typeof key>),
    }),
    {
      name: 'blockout.autosave',
      partialize: (s) => ({ level: s.history.present, showPath: s.showPath, showReach: s.showReach }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as { level?: unknown; showPath?: boolean; showReach?: boolean };
        try {
          assertLevel(p.level);
          return { ...current, history: historyOf(p.level), showPath: p.showPath ?? true, showReach: p.showReach ?? true };
        } catch {
          return current; // Missing or corrupt autosave: start from the sample.
        }
      },
    },
  ),
);

export const useLevel = () => useEditor((s) => s.history.present);
