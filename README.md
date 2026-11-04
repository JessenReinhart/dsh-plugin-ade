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
- **Saved Layout Presets & Persistence** — Pin named multi-pane layouts in a new **Layouts** sidebar section above Workspaces. Tap one-click presets (**Side by Side**, **Stacked**, **Master + Stack**, **Quad Grid**), save the current split under a custom name, or delete saved layouts. The active tree auto-restores on restart. Auto-split Subagents can be switched ON/OFF here too.
- **Live Agent Status Pills** — Each pane header shows a real-time **RUNNING** timer while the session is executing and an attention pulse for pending input, plus a **READY** completion pill when a reply is waiting.
- **Subagent Stack Pane** — Subagents no longer explode your workspace into `N` panes. The first child splits the parent once; every later child joins the same right-hand pane as a swipeable chip strip. The pane auto-follows the running child, clicks swap instantly without remounting, chips can pop into dedicated panes (up to 4 total), and completed children stay until dismissed.
- **Lineage Graph & Layout Scoping (NEW)** — Unreal Blueprint-style visual session and subagent graph canvas. Opening the graph from an active split or saved layout isolates nodes strictly to the layout's panes and their transitive subagents (`Layout Only`), with instant filtering across saved layout groups and `All`.
- **Sidebar Subagent Hierarchy (NEW)** — Parent sessions in the sidebar display a toggle chevron to expand and inspect child subagent sessions inline.
- **DSH Cookie Maintenance Scripts** — Includes `npm run check-cookies` and `npm run clean-cookies` to prevent DSH ephemeral port header overflow (`HTTP 431` "Web authentication failed").

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
