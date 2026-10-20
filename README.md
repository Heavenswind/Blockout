# Blockout

A grid editor for sketching game level layouts ("blockouts") before building them in an engine. Lay out rooms, corridors and terrain, drop in the spawn, goal, enemies, pickups and doors, and the editor tells you straight away what the player can and can't reach and how long the critical path is.

I'm building it to plan levels for my own games. It complements [Forge](https://github.com/Heavenswind/Forge), my game design document tool: **Export PNG** produces an image for a Forge level's *Level Map* field.

## Features

- **Tools:**
  - Room: drag a rectangle to get floor inside and walls around it.
  - Paint: right-drag erases.
  - Rect fill and bucket fill.
  - Place objects, and select and drag them.
- **Terrain:** floor, wall, water, hazard, grass and empty. Each terrain is either walkable or blocking.
- **Objects:** spawn, goal, enemy, pickup, door and note, each with a free-text label ("rat", "key", "ladder up"). Doors make wall cells passable.
- **Keys and locked doors:** give a door a key name and it stays shut until the player picks up a pickup with that key. Keys show as K and locked doors as a padlock, both labelled with the key name.
- **Live analysis:**
  - Reachability from the spawn: unreachable floor is tinted red and unreachable objects are circled. It follows keys: anything behind a door whose key the player can't get is reported with the reason, e.g. a key locked behind its own door.
  - The shortest spawn-to-goal path is drawn on the map.
  - A Problems panel lists missing spawns, unreachable goals and objects stuck in walls.
  - Stats show walkable area, % reachable, path length and object counts.
- **Editing:** undo/redo (Ctrl+Z / Ctrl+Y). Each drag is one step.
- **View:** zoom with the mouse wheel; pan with middle-drag or Space+drag.
- **Files:** autosaves in the browser. **Save** / **Open** use `.blockout.json` files, and **Export PNG** saves an image of the map.

## Built with

React 18, TypeScript and the HTML canvas, with Zustand for state and Vite and Vitest for building and testing. The core (editing operations, path-finding, undo history) is plain TypeScript with no UI dependencies.

## Running it

Requires Node.js 20 or newer.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for editing, reachability, keys and undo
npm run build      # production build in dist/
```

## Keyboard

| Key | Action |
|---|---|
| R / B / X / F / O / V | Room, Paint (brush), Rect, Fill, Place object, Select |
| Ctrl+Z, Ctrl+Y (or Ctrl+Shift+Z) | Undo, redo |
| Delete | Remove the selected object |
| Space + drag, middle-drag | Pan |
| Mouse wheel | Zoom |

## File format

A level is JSON: `width`, `height`, `tiles` (row-major terrain ids, see `TERRAINS` in [`src/model/types.ts`](src/model/types.ts)), and `objects` (`type`, `x`, `y`, `label`). The format is meant to be read directly by a game; see [ROADMAP.md](ROADMAP.md) for the planned Unity importer and Tiled export.

## License

[MIT](LICENSE)
