# dsh-plugin-ade (`@community/dsh-plugin-ade`)

[![Listed on dsh-plugin.org](https://dsh-plugin.org/badges/listed.svg)](https://dsh-plugin.org/plugins/jessenreinhart/dsh-plugin-ade)

> Hyprland-style drag-to-split multi-pane conversation layout for DeepSeek Harness Desktop.

---

## Overview

`dsh-plugin-ade` transforms the DeepSeek Harness conversation area into a binary-tree multi-pane workspace without unmounting or losing live session state:

- **Edge-Drop Splitting** — Drag any session from the sidebar onto the **left / right** edge for a horizontal split, or **top / bottom** edge for a vertical split, with live drop-zone previews.
- **Drag-to-Reorder & Swap** — Drag any pane header onto another pane's center to swap positions, or onto any edge to re-split with live visual indicators.
- **Scoped Split Orientation Toggle** — Toggle horizontal (`⇄`) and vertical (`⇅`) split orientation per immediate split pair without resetting sibling panes.
- **Flat Positioned Layout Engine** — Panes render as flat sibling nodes (`computeTreeGeometry`) so splitting, reordering, or resizing never unmounts active React trees or composer inputs.
- **Glassmorphism & Motion Lab Compatible** — Preserves full backdrop-filter sampling across composers and slash command menus.

---

## Install

### Via DSH CLI

```bash
dsh plugin add github:JessenReinhart/dsh-plugin-ade
```

### From Local Checkout

```bash
git clone https://github.com/JessenReinhart/dsh-plugin-ade.git
cd dsh-plugin-ade
pnpm install
pnpm run build
```

Then install or enable `@community/dsh-plugin-ade` in your DeepSeek Harness profile.

---

## Usage

1. **Create a Split**: Drag a session row from the left sidebar over the conversation view. Hover near the **left**, **right**, **top**, or **bottom** edge to preview the split zone, then drop.
2. **Resize Panes**: Drag the divider handle between any two split panes.
3. **Toggle Split Axis**: Click the `⇄` / `⇅` button in a pane header to flip that pane's immediate split between horizontal and vertical.
4. **Reorder / Swap Panes**: Drag a pane by its header bar into the center of another pane to swap, or onto an edge to re-dock.
5. **Close a Pane**: Click `✕` in the pane header to close the split slot and return the remaining tree space.

---

## Development

```bash
# Build host + client bundles
node scripts/build.mjs

# Run layout engine unit tests
node --test src/layout/engine.spec.ts
```

## License

MIT
