# Roadmap

Work I plan to do, roughly in order. Effort estimates are rough.

## Editing (≈8 h)

- [ ] Copy, paste and mirror a selected area (box selection of tiles and objects)
- [ ] Line and outline-only rectangle tools; wall-thickness option for rooms
- [x] Coalesce typing in text fields into a single undo step
- [ ] Custom terrain palette per level (name, colour, walkable), saved in the file
- [ ] Multiple floors / layers with stairs that link them
- [ ] Minimap and "zoom to fit" button

## Gameplay checks (≈7 h)

- [ ] Keys and locked doors: reachability that understands "you need the key first", and reports soft-locks
- [ ] Enemy and pickup density heatmap, per room
- [ ] Line-of-sight preview from a cell (for stealth and ambush placement)
- [ ] Movement rules: diagonal moves, one-way tiles, jump gaps over pits
- [ ] Time-to-complete estimate from path length and a configurable walk speed

## Rooms and notes (≈4 h)

- [ ] Named room regions with descriptions, listed in the sidebar
- [ ] Sticky notes with longer text, toggleable on the map
- [ ] Per-object properties (key/value) exported for the game

## Export and integration (≈9 h)

- [ ] Tiled (.tmj) export so levels open in Tiled and its engine importers
- [ ] Unity importer: C# script that builds a level from the JSON (prefab per terrain and object type)
- [ ] SVG export for crisp printing
- [ ] Forge integration: open a Forge level, push the PNG into its Level Map field and link the files both ways
- [ ] Import from an image (pixel colour → terrain) to trace hand-drawn sketches

## Quality (≈4 h)

- [ ] Component tests for the tools (pointer events on the canvas)
- [ ] File format migrations when the version number changes
- [ ] GitHub Actions: typecheck, test and build on every push
- [ ] Deploy the editor to GitHub Pages
