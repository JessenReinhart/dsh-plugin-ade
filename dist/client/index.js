(function() {
  function factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
    "use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"), 1);

// client/layout-engine.js
var MIN_FLEX = 0.15;
var ZONE_LABELS = {
  left: "Left",
  right: "Right",
  top: "Top",
  bottom: "Bottom",
  center: "Center"
};
var nextSplitId = 0;
function makeSplitId() {
  return "split:" + nextSplitId++;
}
function positive(val, fallback = 1) {
  return typeof val === "number" && Number.isFinite(val) && val > 0 ? val : fallback;
}
function normalizeSizes(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return [];
  const raw = sizes.map((v) => positive(v));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return raw.map(() => 1 / raw.length);
  return raw.map((v) => v / sum);
}
function getTreePaneIds(node) {
  if (!node) return [];
  if (node.kind === "pane") return [node.id];
  if (node.kind === "split" && Array.isArray(node.children)) {
    return node.children.flatMap(getTreePaneIds);
  }
  return [];
}
function containsPane(node, paneId) {
  if (!node) return false;
  if (node.kind === "pane") return node.id === paneId;
  return node.children ? node.children.some((child) => containsPane(child, paneId)) : false;
}
function removeNode(node, paneId) {
  if (!node) return null;
  if (node.kind === "pane") {
    return node.id === paneId ? null : node;
  }
  const children = [];
  const sizes = [];
  for (let i = 0; i < node.children.length; i++) {
    const child = removeNode(node.children[i], paneId);
    if (child !== null) {
      children.push(child);
      sizes.push(positive(node.sizes ? node.sizes[i] : 1));
    }
  }
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return {
    kind: "split",
    id: node.id || makeSplitId(),
    direction: node.direction || "row",
    children,
    sizes: normalizeSizes(sizes)
  };
}
function removePane(tree, paneId) {
  if (!tree || !tree.root) return { root: null };
  return { root: removeNode(tree.root, paneId) };
}
function splitForZone(target, source, zone, inheritedDirection) {
  let direction = inheritedDirection;
  let children;
  switch (zone) {
    case "left":
      direction = "row";
      children = [source, target];
      break;
    case "right":
      direction = "row";
      children = [target, source];
      break;
    case "top":
      direction = "col";
      children = [source, target];
      break;
    case "bottom":
      direction = "col";
      children = [target, source];
      break;
    case "center":
    default:
      children = [target, source];
      break;
  }
  return {
    kind: "split",
    id: makeSplitId(),
    direction,
    children,
    sizes: [0.5, 0.5]
  };
}
function replaceInNode(node, targetId, source, zone, inheritedDirection = "row") {
  if (node.kind === "pane") {
    if (node.id !== targetId) return { node, replaced: false };
    return { node: splitForZone(node, source, zone, inheritedDirection), replaced: true };
  }
  let replaced = false;
  const children = node.children.map((child) => {
    const res = replaceInNode(child, targetId, source, zone, node.direction);
    if (res.replaced) {
      replaced = true;
      return res.node;
    }
    return child;
  });
  if (!replaced) return { node, replaced: false };
  return { node: { ...node, children }, replaced: true };
}
function insertOrSplit(tree, sourceId, targetId, zone) {
  if (!tree || !tree.root) {
    return { root: { kind: "pane", id: sourceId } };
  }
  if (sourceId === targetId) return tree;
  const source = { kind: "pane", id: sourceId };
  let workingTree = tree;
  if (containsPane(tree.root, sourceId)) {
    workingTree = { root: removeNode(tree.root, sourceId) };
  }
  if (!workingTree.root) {
    return { root: source };
  }
  const result = replaceInNode(workingTree.root, targetId, source, zone, "row");
  if (!result.replaced) return workingTree;
  return { root: result.node };
}
function toggleImmediateSplit(node, paneId) {
  if (!node) return null;
  if (node.kind === "pane") return node;
  if (node.children.some((c) => c.kind === "pane" && c.id === paneId)) {
    return {
      ...node,
      direction: node.direction === "col" ? "row" : "col"
    };
  }
  let modified = false;
  const nextChildren = node.children.map((c) => {
    if (containsPane(c, paneId)) {
      const childRes = toggleImmediateSplit(c, paneId);
      if (childRes !== c) modified = true;
      return childRes;
    }
    return c;
  });
  if (modified) {
    return { ...node, children: nextChildren };
  }
  return {
    ...node,
    direction: node.direction === "col" ? "row" : "col"
  };
}
function togglePaneSplit(tree, paneId) {
  if (!tree || !tree.root) return tree;
  return { root: toggleImmediateSplit(tree.root, paneId) };
}
function getImmediateSplitDirection(node, paneId) {
  if (!node || node.kind === "pane") return null;
  if (node.children.some((c) => c.kind === "pane" && c.id === paneId)) return node.direction;
  for (const c of node.children) {
    if (c.kind === "split" && containsPane(c, paneId)) {
      return getImmediateSplitDirection(c, paneId);
    }
  }
  return null;
}
function getImmediateSplitInfo(node, paneId) {
  if (!node || node.kind === "pane") return null;
  const idx = node.children.findIndex((c) => c.kind === "pane" && c.id === paneId);
  if (idx !== -1) {
    const siblingNode = node.children.find((_, i) => i !== idx) || null;
    const siblingPaneId = siblingNode && siblingNode.kind === "pane" ? siblingNode.id : null;
    const currentSide = node.direction === "row" ? idx === 0 ? "left" : "right" : idx === 0 ? "top" : "bottom";
    return {
      splitId: node.id,
      direction: node.direction,
      index: idx,
      currentSide,
      siblingPaneId
    };
  }
  for (const c of node.children) {
    if (c.kind === "split" && containsPane(c, paneId)) {
      return getImmediateSplitInfo(c, paneId);
    }
  }
  return null;
}
function swapPanes(node, aId, bId) {
  if (!node) return null;
  if (node.kind === "pane") {
    if (node.id === aId) return { kind: "pane", id: bId };
    if (node.id === bId) return { kind: "pane", id: aId };
    return node;
  }
  return { ...node, children: node.children.map((c) => swapPanes(c, aId, bId)) };
}
function swapTreePanes(tree, aId, bId) {
  if (!tree || !tree.root || aId === bId) return tree;
  return { root: swapPanes(tree.root, aId, bId) };
}
function updateSplitSizes(node, splitId, newSizes) {
  if (!node) return null;
  if (node.kind === "pane") return node;
  if (node.id === splitId) {
    return { ...node, sizes: normalizeSizes(newSizes) };
  }
  const nextChildren = node.children.map((c) => updateSplitSizes(c, splitId, newSizes));
  return { ...node, children: nextChildren };
}
function updateTreeSizes(tree, splitId, newSizes) {
  if (!tree || !tree.root) return tree;
  return { root: updateSplitSizes(tree.root, splitId, newSizes) };
}
function clamp01(v) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
function zoneRect(rect, zone) {
  switch (zone) {
    case "left":
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width * 0.5,
        height: rect.height
      };
    case "right":
      return {
        left: rect.left + rect.width * 0.5,
        top: rect.top,
        width: rect.width * 0.5,
        height: rect.height
      };
    case "top":
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height * 0.5
      };
    case "bottom":
      return {
        left: rect.left,
        top: rect.top + rect.height * 0.5,
        width: rect.width,
        height: rect.height * 0.5
      };
    case "center":
    default:
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
  }
}
function computeDropZone(rect, cx, cy, allowCenter = false) {
  const nx = clamp01((cx - rect.left) / Math.max(1, rect.width));
  const ny = clamp01((cy - rect.top) / Math.max(1, rect.height));
  let zone;
  if (allowCenter && nx >= 0.25 && nx <= 0.75 && ny >= 0.25 && ny <= 0.75) {
    zone = "center";
  } else if (ny < 0.25) {
    zone = "top";
  } else if (ny > 0.75) {
    zone = "bottom";
  } else if (nx < 0.25) {
    zone = "left";
  } else if (nx > 0.75) {
    zone = "right";
  } else {
    const dTop = ny;
    const dBottom = 1 - ny;
    const dLeft = nx;
    const dRight = 1 - nx;
    const minD = Math.min(dTop, dBottom, dLeft, dRight);
    if (minD === dTop) zone = "top";
    else if (minD === dBottom) zone = "bottom";
    else if (minD === dLeft) zone = "left";
    else zone = "right";
  }
  return { zone, label: ZONE_LABELS[zone], rect: zoneRect(rect, zone) };
}
function calculateResize(isRow, startCoord, currentCoord, totalPx, prevGrow, nextGrow) {
  const safeTotal = totalPx > 0 ? totalPx : 1;
  const prev = positive(prevGrow);
  const next = positive(nextGrow);
  const sum = prev + next;
  if (sum < MIN_FLEX * 2) {
    return { newPrevGrow: MIN_FLEX, newNextGrow: MIN_FLEX };
  }
  const delta = currentCoord - startCoord;
  const rawPrev = prev + delta / safeTotal * sum;
  const newPrev = Math.max(MIN_FLEX, Math.min(sum - MIN_FLEX, rawPrev));
  const newNext = sum - newPrev;
  return { newPrevGrow: newPrev, newNextGrow: newNext };
}
function computeTreeGeometry(node, box = { left: 0, top: 0, width: 100, height: 100 }, result = { panes: {}, dividers: [] }) {
  if (!node) return result;
  if (node.kind === "pane") {
    result.panes[node.id] = box;
    return result;
  }
  if (node.kind === "split" && Array.isArray(node.children)) {
    const isRow = node.direction === "row";
    const count = node.children.length;
    if (count === 0) return result;
    const sizes = normalizeSizes(
      node.sizes && node.sizes.length === count ? node.sizes : node.children.map(() => 1 / count)
    );
    let offset = isRow ? box.left : box.top;
    for (let i = 0; i < count; i++) {
      const child = node.children[i];
      const sizePct = (isRow ? box.width : box.height) * sizes[i];
      const childBox = isRow ? { left: offset, top: box.top, width: sizePct, height: box.height } : { left: box.left, top: offset, width: box.width, height: sizePct };
      computeTreeGeometry(child, childBox, result);
      offset += sizePct;
      if (i < count - 1) {
        result.dividers.push({
          id: `${node.id}:d:${i}`,
          splitId: node.id,
          splitIndex: i,
          direction: node.direction,
          parentBox: box,
          left: isRow ? offset : box.left,
          top: isRow ? box.top : offset,
          width: isRow ? 0 : box.width,
          height: isRow ? box.height : 0,
          sizes
        });
      }
    }
  }
  return result;
}

// client/index.js
var PANEL_KEY = "ade-split";
var SAVED_LAYOUTS_KEY = "dsh-ade-saved-layouts-v1";
var ACTIVE_STATE_KEY = "dsh-ade-active-state-v1";
var state = {
  tree: null,
  // LayoutTree: { root: LayoutNode | null }
  panes: []
  // [{ sessionId }] - stable mount order
};
var splitStartMs = 0;
var listeners = /* @__PURE__ */ new Set();
var emit = () => {
  for (const l of listeners) l();
};
var getState = () => state;
var subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
var layoutListeners = /* @__PURE__ */ new Set();
var layoutsSnapshotCache = null;
function subscribeLayouts(fn) {
  layoutListeners.add(fn);
  return () => layoutListeners.delete(fn);
}
function emitLayoutsChange() {
  layoutsSnapshotCache = null;
  for (const fn of layoutListeners) {
    try {
      fn();
    } catch (_) {
    }
  }
}
var cachedCustomLayouts = null;
function getSavedLayouts() {
  if (cachedCustomLayouts !== null) return cachedCustomLayouts;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(SAVED_LAYOUTS_KEY) : null;
    cachedCustomLayouts = raw ? JSON.parse(raw) : [];
  } catch (_) {
    cachedCustomLayouts = [];
  }
  return cachedCustomLayouts;
}
function getLayoutsSnapshot() {
  if (layoutsSnapshotCache === null) {
    layoutsSnapshotCache = { customLayouts: getSavedLayouts() };
  }
  return layoutsSnapshotCache;
}
function saveCustomLayout(name, tree, panes) {
  try {
    const list = getSavedLayouts().slice();
    const newLayout = {
      id: "custom-" + Date.now(),
      name: name || `Layout (${panes.length} panes)`,
      createdAt: Date.now(),
      isCustom: true,
      panes: panes.map((p) => ({ sessionId: p.sessionId })),
      tree
    };
    list.unshift(newLayout);
    cachedCustomLayouts = list;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SAVED_LAYOUTS_KEY, JSON.stringify(list));
    }
    emitLayoutsChange();
    return newLayout;
  } catch (_) {
    return null;
  }
}
function deleteCustomLayout(id) {
  try {
    const list = getSavedLayouts().filter((l) => l.id !== id);
    cachedCustomLayouts = list;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(SAVED_LAYOUTS_KEY, JSON.stringify(list));
    }
    emitLayoutsChange();
  } catch (_) {
  }
}
function persistActiveState() {
  try {
    if (typeof localStorage === "undefined") return;
    if (state.panes && state.panes.length > 0 && state.tree) {
      localStorage.setItem(
        ACTIVE_STATE_KEY,
        JSON.stringify({
          tree: state.tree,
          panes: state.panes,
          timestamp: Date.now()
        })
      );
    } else {
      localStorage.removeItem(ACTIVE_STATE_KEY);
    }
  } catch (_) {
  }
}
var REORDER_MIME = "application/x-dsh-ade-reorder";
var reorderDragFromSessionId = null;
function isReorderDrag(e) {
  if (reorderDragFromSessionId !== null) return true;
  try {
    if (e && e.dataTransfer && e.dataTransfer.types) {
      return Array.prototype.indexOf.call(e.dataTransfer.types, REORDER_MIME) !== -1;
    }
  } catch (_) {
  }
  return false;
}
var app = null;
var pluginCtx = null;
function refreshHandles() {
  if (!pluginCtx) return;
  app = {
    sessions: pluginCtx.sessions || app && app.sessions,
    layout: pluginCtx.layout || app && app.layout,
    uiWorkspace: pluginCtx.uiWorkspace || app && app.uiWorkspace,
    workspaces: pluginCtx.workspaces || app && app.workspaces,
    slots: pluginCtx.slots || app && app.slots
  };
}
var retained = /* @__PURE__ */ new Map();
var regState = "init";
function debugLog(_msg) {
}
function currentMainSessionId() {
  if (!app || !app.sessions) return void 0;
  try {
    const byId = app.sessions.list.getSnapshot().byId;
    return Object.values(byId).find((r) => (r.retainedBy.mainView ?? 0) > 0)?.id;
  } catch (_) {
    return void 0;
  }
}
function ensureReference(sessionId) {
  if (!retained.has(sessionId)) {
    retained.set(sessionId, app.sessions.retain(sessionId, { source: "ade-multipane" }));
  }
  return retained.get(sessionId);
}
function releaseReference(sessionId) {
  const ref = retained.get(sessionId);
  if (ref) {
    retained.delete(sessionId);
    try {
      ref.release();
    } catch (_) {
    }
  }
}
function sessionTitle(sessionId) {
  if (!app || !app.sessions) return sessionId;
  try {
    const row = app.sessions.list.getSnapshot().byId[sessionId];
    return row?.title || row?.id || sessionId;
  } catch (_) {
    return sessionId;
  }
}
function workspaceItems() {
  try {
    const ws = app && app.workspaces || app && app.uiWorkspace && app.uiWorkspace.workspaces;
    return ws && ws.list && ws.list.getSnapshot().items || [];
  } catch (_) {
    return [];
  }
}
function workspaceOf(sessionId) {
  const items = workspaceItems();
  let idx = -1;
  const byMembership = items.find((w, i) => {
    if (Array.isArray(w.sessionIds) && w.sessionIds.includes(sessionId)) {
      idx = i;
      return true;
    }
    return false;
  });
  if (byMembership) {
    return {
      id: byMembership.workspaceId || byMembership.id || "",
      title: byMembership.title || (byMembership.path ? workspaceTitleOf(byMembership.path) : "") || byMembership.workspaceId || "",
      path: byMembership.path || "",
      index: idx
    };
  }
  const sessionRow = app?.sessions?.list?.getSnapshot?.()?.byId?.[sessionId];
  const cwd = sessionRow?.cwd;
  if (cwd) {
    const byPath = items.findIndex((w) => w.path === cwd);
    if (byPath >= 0) {
      const w = items[byPath];
      return {
        id: w.workspaceId || w.id || "",
        title: w.title || workspaceTitleOf(w.path) || w.workspaceId || "",
        path: w.path || "",
        index: byPath
      };
    }
  }
  return null;
}
function workspaceTitleOf(path) {
  if (!path) return "";
  const parts = path.replace(/[\\/]+$/, "").split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
var ADE_PALETTE = [
  { dot: "#38bdf8", badgeBg: "rgba(56, 189, 248, 0.14)", badgeFg: "#bae6fd", badgeBorder: "rgba(56, 189, 248, 0.35)", glow: "rgba(56, 189, 248, 0.45)" },
  { dot: "#a855f7", badgeBg: "rgba(168, 85, 247, 0.14)", badgeFg: "#e9d5ff", badgeBorder: "rgba(168, 85, 247, 0.35)", glow: "rgba(168, 85, 247, 0.45)" },
  { dot: "#34d399", badgeBg: "rgba(52, 211, 153, 0.14)", badgeFg: "#a7f3d0", badgeBorder: "rgba(52, 211, 153, 0.35)", glow: "rgba(52, 211, 153, 0.45)" },
  { dot: "#f59e0b", badgeBg: "rgba(245, 158, 11, 0.14)", badgeFg: "#fde68a", badgeBorder: "rgba(245, 158, 11, 0.35)", glow: "rgba(245, 158, 11, 0.45)" },
  { dot: "#ec4899", badgeBg: "rgba(236, 72, 153, 0.14)", badgeFg: "#fbcfe8", badgeBorder: "rgba(236, 72, 153, 0.35)", glow: "rgba(236, 72, 153, 0.45)" },
  { dot: "#06b6d4", badgeBg: "rgba(6, 182, 212, 0.14)", badgeFg: "#a5f3fc", badgeBorder: "rgba(6, 182, 212, 0.35)", glow: "rgba(6, 182, 212, 0.45)" },
  { dot: "#84cc16", badgeBg: "rgba(132, 204, 22, 0.14)", badgeFg: "#d9f99d", badgeBorder: "rgba(132, 204, 22, 0.35)", glow: "rgba(132, 204, 22, 0.45)" },
  { dot: "#f97316", badgeBg: "rgba(249, 115, 22, 0.14)", badgeFg: "#fed7aa", badgeBorder: "rgba(249, 115, 22, 0.35)", glow: "rgba(249, 115, 22, 0.45)" }
];
function accentFor(sessionId) {
  const ws = workspaceOf(sessionId);
  if (ws && ws.index >= 0 && ADE_PALETTE[ws.index]) {
    return ADE_PALETTE[ws.index % ADE_PALETTE.length];
  }
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) h = (h << 5) - h + sessionId.charCodeAt(i) | 0;
  const idx = Math.abs(h) % ADE_PALETTE.length;
  return ADE_PALETTE[idx];
}
function setTree(tree) {
  const activeIds = getTreePaneIds(tree ? tree.root : null);
  const existingMap = new Map(state.panes.map((p) => [p.sessionId, p]));
  const preserved = state.panes.filter((p) => activeIds.includes(p.sessionId));
  for (const id of activeIds) {
    if (!existingMap.has(id)) {
      preserved.push({ sessionId: id });
    }
  }
  state = {
    tree,
    panes: preserved
  };
  emit();
  persistActiveState();
}
function togglePaneSplitInState(sessionId) {
  if (!state.tree || !state.tree.root) return;
  const nextTree = togglePaneSplit(state.tree, sessionId);
  setTree(nextTree);
}
var originalConversationPanel = null;
var wrappedConversationEntry = null;
function ensureConversationWrapped() {
  refreshHandles();
  if (!app || !app.slots) {
    regState = "no-slots";
    return false;
  }
  try {
    const entries = app.slots.entries("main") || [];
    const conv = entries.find((entry) => entry && entry.options && entry.options.key === "conversation");
    if (!conv) return false;
    if (conv.component === ADESplitRoot) return true;
    if (typeof conv.component !== "function") return false;
    if (originalConversationPanel === null) originalConversationPanel = conv.component;
    if (wrappedConversationEntry !== conv) wrappedConversationEntry = conv;
    conv.component = ADESplitRoot;
    return true;
  } catch (err) {
    return false;
  }
}
function restoreConversationPanel() {
  if (wrappedConversationEntry && originalConversationPanel) {
    try {
      wrappedConversationEntry.component = originalConversationPanel;
    } catch (_) {
    }
  }
  wrappedConversationEntry = null;
  originalConversationPanel = null;
}
var originalSidebarWorkspaces = null;
var wrappedSidebarEntry = null;
function ensureSidebarWrapped() {
  refreshHandles();
  if (!app || !app.slots) return false;
  try {
    const entries = app.slots.entries("sidebar.workspaces") || [];
    const entry = entries.find((e) => e && typeof e.component === "function");
    if (!entry) return false;
    if (entry.component === ADESidebarWrapper) return true;
    if (originalSidebarWorkspaces === null) originalSidebarWorkspaces = entry.component;
    if (wrappedSidebarEntry !== entry) wrappedSidebarEntry = entry;
    entry.component = ADESidebarWrapper;
    return true;
  } catch (_) {
    return false;
  }
}
function restoreSidebar() {
  if (wrappedSidebarEntry && originalSidebarWorkspaces) {
    try {
      wrappedSidebarEntry.component = originalSidebarWorkspaces;
    } catch (_) {
    }
  }
  wrappedSidebarEntry = null;
  originalSidebarWorkspaces = null;
}
var cachedRenderSlot = null;
var cachedSessionProvider = null;
var cachedUseSessionStatus = null;
var aliasDispose = null;
function ensureAliasRegistered() {
  refreshHandles();
  if (!app || !app.slots) return false;
  try {
    const entries = app.slots.entries("main") || [];
    const has = entries.some((entry) => entry && entry.options && entry.options.key === PANEL_KEY);
    if (has) return true;
    aliasDispose = app.slots.register(
      {
        name: "main",
        key: PANEL_KEY
      },
      ADESplitRoot
    );
    return true;
  } catch (err) {
    return false;
  }
}
function disposeAlias() {
  try {
    aliasDispose?.();
  } catch (_) {
  }
  aliasDispose = null;
}
function activateSplitWithTree(tree) {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  splitStartMs = t0;
  refreshHandles();
  ensureConversationWrapped();
  ensureSidebarWrapped();
  ensureAliasRegistered();
  injectMotionStyles();
  const ids = getTreePaneIds(tree ? tree.root : null);
  for (const id of ids) {
    try {
      ensureReference(id);
    } catch (_) {
    }
  }
  try {
    if (app && app.layout && app.layout.panelInfo) {
      const active = app.layout.panelInfo.getSnapshot?.()?.activePanelId;
      const seatsCached = typeof cachedRenderSlot === "function" && typeof cachedSessionProvider === "function";
      const canKeepAlias = active === PANEL_KEY && seatsCached;
      if (!canKeepAlias && active !== null && active !== "conversation") {
        app.layout.selectPanel(null);
      }
    }
  } catch (_) {
  }
  setTree(tree);
}
function deactivateSplit(remainingSessionId) {
  for (const id of [...retained.keys()]) releaseReference(id);
  state = { tree: null, panes: [] };
  emit();
  persistActiveState();
  try {
    if (remainingSessionId && app.uiWorkspace) app.uiWorkspace.openSession(remainingSessionId);
    else if (app.layout) app.layout.selectPanel(null);
  } catch (e) {
    try {
      if (app.layout) app.layout.selectPanel(null);
    } catch (_) {
    }
  }
}
function ensureTree(rawTree, panes) {
  if (!panes || panes.length === 0) return null;
  const paneIds = panes.map((p) => p.sessionId);
  if (rawTree && rawTree.root) {
    const treeIds = getTreePaneIds(rawTree.root);
    const same = treeIds.length === paneIds.length && treeIds.every((id, i) => id === paneIds[i]);
    if (same) return rawTree;
  }
  let tree = { root: { kind: "pane", id: paneIds[0] } };
  for (let i = 1; i < paneIds.length; i++) {
    tree = insertOrSplit(tree, paneIds[i], paneIds[i - 1], "right");
  }
  return tree;
}
var PaneErrorBoundary = class extends import_react.default.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    debugLog("Pane error caught: " + (error && error.message));
  }
  render() {
    if (this.state.error) {
      return import_react.default.createElement(
        "div",
        {
          style: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            color: "#f87171",
            background: "var(--dsw-alias-bg-base, #1e1e24)",
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: "center"
          }
        },
        import_react.default.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "Session view crashed"),
        import_react.default.createElement(
          "div",
          { style: { opacity: 0.8, maxWidth: 360, wordBreak: "break-word", fontSize: 11, marginBottom: 12 } },
          String(this.state.error?.message || this.state.error)
        ),
        import_react.default.createElement(
          "button",
          {
            onClick: () => this.setState({ error: null }),
            style: {
              padding: "6px 14px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 12
            }
          },
          "Retry"
        )
      );
    }
    return this.props.children;
  }
};
var MOTION_STYLE_ID = "dsh-ade-motion-css";
function injectMotionStyles() {
  try {
    const existing = document.getElementById(MOTION_STYLE_ID);
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = MOTION_STYLE_ID;
    style.textContent = `
      @keyframes ade-hypr-pop-in {
        0% { opacity: 0; transform: scale(0.93); }
        60% { opacity: 1; transform: scale(1.012); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes ade-hypr-side-in {
        0% { opacity: 0; transform: translateX(-20px) scale(0.97); }
        100% { opacity: 1; transform: none; }
      }
      @keyframes ade-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes ade-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.35; transform: scale(0.85); }
      }
      [data-ade-split] {
        position: relative;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
        background: transparent;
      }
      [data-ade-split] [data-ade-pane] {
        box-sizing: border-box;
        min-width: 0;
        min-height: 0;
        border-radius: 10px;
        border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08));
        background: rgba(10, 10, 14, 0.28);
        box-shadow: 0 4px 16px rgba(0,0,0,0.22);
        --dsw-alias-bg-base: transparent;
        --dsw-specific-sidebar-fill: transparent;
      }
      [data-ade-split] [data-ade-pane] [data-conversation-session],
      [data-ade-split] [data-ade-pane] [data-conversation-content] {
        background: transparent !important;
      }
      [data-ade-split] [data-ade-pane][data-ade-hypr-anim] {
        animation: ade-hypr-pop-in 240ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
      }
      [data-ade-split] [data-ade-pane][data-ade-slot="0"][data-ade-hypr-anim] {
        animation: ade-hypr-side-in 220ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
      }
      [data-ade-split] [data-ade-pane][data-ade-dragging-source="true"] {
        opacity: 0.35;
        transition: opacity 120ms ease;
      }
      [data-ade-split] > [data-ade-divider] {
        background: transparent;
        transition: background 140ms ease;
      }
      [data-ade-split] > [data-ade-divider]::before {
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        margin: auto;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 999px;
        transition: background 140ms ease, transform 140ms ease;
      }
      [data-ade-split] > [data-ade-divider][data-ade-dir="row"]::before {
        width: 2px;
        height: 100%;
      }
      [data-ade-split] > [data-ade-divider][data-ade-dir="col"]::before {
        width: 100%;
        height: 2px;
      }
      [data-ade-split] > [data-ade-divider]:hover::before,
      [data-ade-split] > [data-ade-divider][data-ade-dragging="true"]::before {
        background: var(--dsw-alias-brand, #4f78ff);
        transform: scale(1.6);
      }
      #dsh-ade-drag-preview {
        box-sizing: border-box;
        border: 2px solid rgba(56, 189, 248, 0.9);
        background: rgba(56, 189, 248, 0.12);
        border-radius: 10px;
        box-shadow: 0 0 24px rgba(56, 189, 248, 0.35), inset 0 0 16px rgba(56, 189, 248, 0.15);
        font: 600 13px/1.3 system-ui, sans-serif;
        color: #e0f2fe;
        text-shadow: 0 1px 3px rgba(0,0,0,0.7);
        transition: left 140ms cubic-bezier(0.2, 0.9, 0.3, 1),
                    top 140ms cubic-bezier(0.2, 0.9, 0.3, 1),
                    width 140ms cubic-bezier(0.2, 0.9, 0.3, 1),
                    height 140ms cubic-bezier(0.2, 0.9, 0.3, 1),
                    opacity 120ms ease;
      }
      [data-ade-sidebar-root] {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-height: 0;
        overflow: hidden;
      }
      [data-ade-sidebar-layouts] {
        display: flex;
        flex-direction: column;
        flex: 0 0 auto;
        box-sizing: border-box;
        padding: 4px 6px 6px 6px;
        border-bottom: 1px solid var(--dsw-alias-border-base, rgba(255, 255, 255, 0.08));
        margin-bottom: 4px;
      }
      [data-ade-layout-row] {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 28px;
        padding: 0 8px;
        margin: 1px 0;
        border-radius: var(--dsw-radius-sm, 5px);
        cursor: pointer;
        font-size: 12px;
        color: var(--dsw-alias-label-primary, #e2e8f0);
        background: transparent;
        border: 1px solid transparent;
        transition: background 120ms ease, border-color 120ms ease;
        user-select: none;
      }
      [data-ade-layout-row]:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.06));
      }
      [data-ade-layout-row][data-active="true"] {
        background: rgba(56, 189, 248, 0.12);
        border-color: rgba(56, 189, 248, 0.28);
        color: #38bdf8;
      }
      [data-ade-layout-row] .ade-delete-btn {
        opacity: 0;
        visibility: hidden;
        transition: opacity 120ms ease;
      }
      [data-ade-layout-row]:hover .ade-delete-btn {
        opacity: 1;
        visibility: visible;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-ade-split] [data-ade-pane],
        [data-ade-split] > [data-ade-divider]::before,
        #dsh-ade-drag-preview {
          animation: none !important;
          transition: none !important;
        }
      }
    `;
    document.head.appendChild(style);
  } catch (_) {
  }
}
function getPresetLayouts() {
  return [
    {
      id: "preset-col-2",
      name: "Side by Side",
      panesCount: 2,
      subtitle: "2 Panes (Cols)",
      icon: "col-2",
      buildTree: (ids) => ({
        root: {
          kind: "split",
          id: makeSplitId(),
          direction: "row",
          children: [{ kind: "pane", id: ids[0] }, { kind: "pane", id: ids[1] }],
          sizes: [0.5, 0.5]
        }
      })
    },
    {
      id: "preset-row-2",
      name: "Stacked",
      panesCount: 2,
      subtitle: "2 Panes (Rows)",
      icon: "row-2",
      buildTree: (ids) => ({
        root: {
          kind: "split",
          id: makeSplitId(),
          direction: "col",
          children: [{ kind: "pane", id: ids[0] }, { kind: "pane", id: ids[1] }],
          sizes: [0.5, 0.5]
        }
      })
    },
    {
      id: "preset-master-stack-3",
      name: "Master + Stack",
      panesCount: 3,
      subtitle: "3 Panes (60/40)",
      icon: "master-stack-3",
      buildTree: (ids) => ({
        root: {
          kind: "split",
          id: makeSplitId(),
          direction: "row",
          children: [
            { kind: "pane", id: ids[0] },
            {
              kind: "split",
              id: makeSplitId(),
              direction: "col",
              children: [{ kind: "pane", id: ids[1] }, { kind: "pane", id: ids[2] }],
              sizes: [0.5, 0.5]
            }
          ],
          sizes: [0.6, 0.4]
        }
      })
    },
    {
      id: "preset-quad-4",
      name: "Quad Grid",
      panesCount: 4,
      subtitle: "4 Panes (2x2)",
      icon: "quad-4",
      buildTree: (ids) => ({
        root: {
          kind: "split",
          id: makeSplitId(),
          direction: "row",
          children: [
            {
              kind: "split",
              id: makeSplitId(),
              direction: "col",
              children: [{ kind: "pane", id: ids[0] }, { kind: "pane", id: ids[1] }],
              sizes: [0.5, 0.5]
            },
            {
              kind: "split",
              id: makeSplitId(),
              direction: "col",
              children: [{ kind: "pane", id: ids[2] }, { kind: "pane", id: ids[3] }],
              sizes: [0.5, 0.5]
            }
          ],
          sizes: [0.5, 0.5]
        }
      })
    }
  ];
}
function resolveSessionsForCount(count) {
  const currentActive = currentMainSessionId() || state.panes[0]?.sessionId;
  const existingPaneIds = state.panes.map((p) => p.sessionId);
  const allKnownIds = (() => {
    try {
      if (!app || !app.sessions) return [];
      const snap = app.sessions.list.getSnapshot();
      return snap.order || Object.keys(snap.byId || {});
    } catch (_) {
      return [];
    }
  })();
  const picked = [];
  if (currentActive) picked.push(currentActive);
  for (const id of existingPaneIds) {
    if (!picked.includes(id)) picked.push(id);
    if (picked.length >= count) break;
  }
  for (const id of allKnownIds) {
    if (!picked.includes(id)) picked.push(id);
    if (picked.length >= count) break;
  }
  while (picked.length < count && picked.length > 0) {
    picked.push(picked[0]);
  }
  return picked.slice(0, count);
}
function reconcileLayoutTree(tree) {
  if (!tree || !tree.root) return null;
  const allKnownIds = (() => {
    try {
      if (!app || !app.sessions) return /* @__PURE__ */ new Set();
      const snap = app.sessions.list.getSnapshot();
      return new Set(snap.order || Object.keys(snap.byId || {}));
    } catch (_) {
      return /* @__PURE__ */ new Set();
    }
  })();
  const fallbackPool = [...allKnownIds];
  let fallbackIdx = 0;
  function remapNode(node) {
    if (!node) return null;
    if (node.kind === "pane") {
      let targetId = node.id;
      if (!allKnownIds.has(targetId)) {
        while (fallbackIdx < fallbackPool.length && fallbackPool[fallbackIdx] === targetId) {
          fallbackIdx++;
        }
        if (fallbackIdx < fallbackPool.length) {
          targetId = fallbackPool[fallbackIdx++];
        }
      }
      return { kind: "pane", id: targetId };
    }
    return {
      kind: "split",
      id: makeSplitId(),
      direction: node.direction,
      sizes: [...node.sizes || [0.5, 0.5]],
      children: (node.children || []).map(remapNode)
    };
  }
  return { root: remapNode(tree.root) };
}
function applyCustomLayout(layout) {
  if (!layout || !layout.tree) return;
  const restoredTree = reconcileLayoutTree(layout.tree);
  if (restoredTree) activateSplitWithTree(restoredTree);
}
function restorePersistedSplit() {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(ACTIVE_STATE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.tree || !parsed.panes || parsed.panes.length === 0) return;
    const checkAndRestore = () => {
      try {
        if (!app || !app.sessions) return false;
        const snap = app.sessions.list.getSnapshot();
        const byId = snap.byId || {};
        const availableIds = new Set(Object.keys(byId));
        if (availableIds.size === 0) return false;
        const paneIds = getTreePaneIds(parsed.tree.root);
        const validIds = paneIds.filter((id) => availableIds.has(id));
        if (validIds.length === 0) return true;
        const treeToActivate = reconcileLayoutTree(parsed.tree);
        if (treeToActivate) activateSplitWithTree(treeToActivate);
        return true;
      } catch (_) {
        return false;
      }
    };
    if (!checkAndRestore()) {
      if (app && app.sessions && app.sessions.list && app.sessions.list.subscribe) {
        let unsub = null;
        unsub = app.sessions.list.subscribe(() => {
          if (checkAndRestore() && typeof unsub === "function") {
            try {
              unsub();
            } catch (_) {
            }
          }
        });
      }
    }
  } catch (_) {
  }
}
function renderLayoutIcon(type) {
  switch (type) {
    case "col-2":
      return import_react.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react.default.createElement("rect", { x: 1, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react.default.createElement("rect", { x: 7.8, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    case "row-2":
      return import_react.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react.default.createElement("rect", { x: 1.5, y: 1, width: 11, height: 5.2, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react.default.createElement("rect", { x: 1.5, y: 7.8, width: 11, height: 5.2, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    case "master-stack-3":
      return import_react.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react.default.createElement("rect", { x: 1, y: 1.5, width: 6.2, height: 11, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react.default.createElement("rect", { x: 8.5, y: 1.5, width: 4.5, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react.default.createElement("rect", { x: 8.5, y: 7.5, width: 4.5, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    case "quad-4":
      return import_react.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react.default.createElement("rect", { x: 1, y: 1.5, width: 5.2, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react.default.createElement("rect", { x: 7.8, y: 1.5, width: 5.2, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react.default.createElement("rect", { x: 1, y: 7.5, width: 5.2, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react.default.createElement("rect", { x: 7.8, y: 7.5, width: 5.2, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    default:
      return import_react.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react.default.createElement("rect", { x: 1, y: 1, width: 12, height: 12, rx: 2, stroke: "currentColor", strokeWidth: 1.2, strokeDasharray: "2 1.5" }),
        import_react.default.createElement("path", { d: "M7 3v8M3 7h8", stroke: "currentColor", strokeWidth: 1, opacity: 0.6 })
      );
  }
}
function isPresetActive(preset, snap) {
  if (!snap.panes || snap.panes.length !== preset.panesCount) return false;
  if (!snap.tree || !snap.tree.root) return false;
  if (preset.id === "preset-col-2") {
    return snap.tree.root.kind === "split" && snap.tree.root.direction === "row";
  }
  if (preset.id === "preset-row-2") {
    return snap.tree.root.kind === "split" && snap.tree.root.direction === "col";
  }
  return false;
}
function isCustomActive(layout, snap) {
  if (!layout || !layout.panes || !snap.panes) return false;
  if (layout.panes.length !== snap.panes.length) return false;
  const currentIds = snap.panes.map((p) => p.sessionId).join(",");
  const savedIds = layout.panes.map((p) => p.sessionId).join(",");
  return currentIds === savedIds;
}
function ADELayoutsSection(props) {
  const [collapsed, setCollapsed] = import_react.default.useState(false);
  const snap = (0, import_react.useSyncExternalStore)(subscribe, getState);
  const layoutSnap = (0, import_react.useSyncExternalStore)(subscribeLayouts, getLayoutsSnapshot);
  const { customLayouts } = layoutSnap;
  const presets = getPresetLayouts();
  const hasActiveSplit = snap.panes && snap.panes.length >= 2;
  const handleSaveCurrent = (e) => {
    e.stopPropagation();
    if (!hasActiveSplit) return;
    const defaultName = `Split (${snap.panes.length} panes)`;
    const name = typeof window !== "undefined" && window.prompt ? window.prompt("Layout name:", defaultName) : defaultName;
    if (name && name.trim()) {
      saveCustomLayout(name.trim(), snap.tree, snap.panes);
    }
  };
  const handleApplyPreset = (preset) => {
    const ids = resolveSessionsForCount(preset.panesCount);
    if (!ids || ids.length === 0) return;
    const tree = preset.buildTree(ids);
    activateSplitWithTree(tree);
  };
  const handleApplyCustom = (layout) => {
    applyCustomLayout(layout);
  };
  const handleDeleteCustom = (e, id) => {
    e.stopPropagation();
    deleteCustomLayout(id);
  };
  return import_react.default.createElement(
    "div",
    { "data-ade-sidebar-layouts": "" },
    import_react.default.createElement(
      "div",
      {
        style: {
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          padding: "0 4px",
          borderRadius: "var(--dsw-radius-sm, 4px)",
          userSelect: "none"
        },
        onClick: () => setCollapsed(!collapsed)
      },
      import_react.default.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.42))",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase"
          }
        },
        import_react.default.createElement("span", { style: { fontSize: 9, display: "inline-block", width: 12, textAlign: "center" } }, collapsed ? "\u25B6" : "\u25BC"),
        import_react.default.createElement("span", null, "LAYOUTS"),
        import_react.default.createElement(
          "span",
          {
            style: {
              fontSize: 10,
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.08)",
              color: "var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.5))"
            }
          },
          String(presets.length + customLayouts.length)
        )
      ),
      hasActiveSplit ? import_react.default.createElement(
        "button",
        {
          type: "button",
          title: "Save current split as a named layout",
          onClick: handleSaveCurrent,
          style: {
            background: "transparent",
            border: "none",
            color: "var(--dsw-alias-label-secondary, rgba(255, 255, 255, 0.65))",
            cursor: "pointer",
            padding: "2px 6px",
            borderRadius: "var(--dsw-radius-sm, 4px)",
            fontSize: 11,
            display: "inline-flex",
            alignItems: "center",
            gap: 3
          }
        },
        import_react.default.createElement("span", { style: { fontSize: 13, lineHeight: 1, fontWeight: 700 } }, "+"),
        import_react.default.createElement("span", null, "Save")
      ) : null
    ),
    !collapsed ? import_react.default.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 2, marginTop: 4 } },
      presets.map((preset) => {
        const isActive = isPresetActive(preset, snap);
        return import_react.default.createElement(
          "div",
          {
            key: preset.id,
            "data-ade-layout-row": "",
            "data-active": isActive ? "true" : void 0,
            onClick: () => handleApplyPreset(preset),
            title: `${preset.name} (${preset.subtitle})`
          },
          import_react.default.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden" } },
            renderLayoutIcon(preset.icon),
            import_react.default.createElement(
              "span",
              {
                style: {
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }
              },
              preset.name
            )
          ),
          import_react.default.createElement(
            "span",
            {
              style: {
                fontSize: 10,
                fontWeight: 600,
                color: isActive ? "#38bdf8" : "var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.4))",
                padding: "1px 4px",
                borderRadius: 3,
                background: isActive ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.05)"
              }
            },
            `${preset.panesCount}P`
          )
        );
      }),
      customLayouts.map((layout) => {
        const isActive = isCustomActive(layout, snap);
        const paneCount = layout.panes && layout.panes.length || 0;
        return import_react.default.createElement(
          "div",
          {
            key: layout.id,
            "data-ade-layout-row": "",
            "data-active": isActive ? "true" : void 0,
            onClick: () => handleApplyCustom(layout),
            title: `${layout.name} (Saved layout with ${paneCount} panes)`
          },
          import_react.default.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden" } },
            renderLayoutIcon("custom"),
            import_react.default.createElement(
              "span",
              {
                style: {
                  fontSize: 12,
                  fontWeight: isActive ? 600 : 400,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis"
                }
              },
              layout.name
            )
          ),
          import_react.default.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" } },
            import_react.default.createElement(
              "span",
              {
                style: {
                  fontSize: 10,
                  fontWeight: 600,
                  color: isActive ? "#38bdf8" : "var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.4))",
                  padding: "1px 4px",
                  borderRadius: 3,
                  background: isActive ? "rgba(56, 189, 248, 0.15)" : "rgba(255, 255, 255, 0.05)"
                }
              },
              `${paneCount}P`
            ),
            import_react.default.createElement(
              "button",
              {
                type: "button",
                className: "ade-delete-btn",
                title: "Delete this saved layout",
                onClick: (e) => handleDeleteCustom(e, layout.id),
                style: {
                  background: "transparent",
                  border: "none",
                  color: "var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.4))",
                  cursor: "pointer",
                  padding: "2px 4px",
                  borderRadius: 3,
                  fontSize: 11,
                  lineHeight: 1
                }
              },
              "\u2715"
            )
          )
        );
      })
    ) : null
  );
}
function ADESidebarWrapper(props) {
  const orig = originalSidebarWorkspaces;
  return import_react.default.createElement(
    "div",
    { "data-ade-sidebar-root": "" },
    props.wide !== false ? import_react.default.createElement(ADELayoutsSection, { wide: props.wide }) : null,
    orig ? import_react.default.createElement(orig, props) : null
  );
}
function ADEPaneTelemetryReader(props) {
  const { sessionId, useSessionStatus } = props;
  const status = useSessionStatus(
    (snapshot) => snapshot && typeof snapshot.get === "function" ? snapshot.get(sessionId) : void 0
  );
  const isRunning = !!status?.running;
  const isPending = !!status?.pendingInteraction;
  const isUnread = !!status?.completionUnread;
  const [elapsed, setElapsed] = import_react.default.useState(0);
  const startRef = import_react.default.useRef(0);
  import_react.default.useEffect(() => {
    if (isRunning) {
      if (!startRef.current) startRef.current = Date.now();
      setElapsed(Math.floor((Date.now() - startRef.current) / 1e3));
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1e3));
      }, 1e3);
      return () => clearInterval(interval);
    } else {
      startRef.current = 0;
      setElapsed(0);
    }
  }, [isRunning]);
  if (isRunning) {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    return import_react.default.createElement(
      "div",
      {
        "data-ade-telemetry": "running",
        title: `Agent is active (${mm}:${ss})`,
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 7px",
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 700,
          color: "#fef08a",
          background: "rgba(245, 158, 11, 0.14)",
          border: "1px solid rgba(245, 158, 11, 0.45)",
          boxShadow: "0 0 8px rgba(245, 158, 11, 0.2)",
          flex: "0 0 auto",
          userSelect: "none"
        }
      },
      import_react.default.createElement("span", {
        style: {
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#fbbf24",
          boxShadow: "0 0 6px #f59e0b",
          animation: "ade-pulse 1.2s ease-in-out infinite"
        }
      }),
      import_react.default.createElement("span", { style: { letterSpacing: "0.03em" } }, "RUNNING"),
      import_react.default.createElement(
        "span",
        {
          style: {
            fontFamily: "ui-monospace, monospace",
            fontVariantNumeric: "tabular-nums",
            fontSize: 10,
            opacity: 0.9,
            marginLeft: 2
          }
        },
        `${mm}:${ss}`
      )
    );
  }
  if (isPending) {
    return import_react.default.createElement(
      "div",
      {
        "data-ade-telemetry": "pending",
        title: "Action or permission required",
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 7px",
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 700,
          color: "#fed7aa",
          background: "rgba(234, 88, 12, 0.16)",
          border: "1px solid rgba(234, 88, 12, 0.5)",
          boxShadow: "0 0 8px rgba(234, 88, 12, 0.25)",
          flex: "0 0 auto",
          userSelect: "none",
          animation: "ade-pulse 2s ease-in-out infinite"
        }
      },
      import_react.default.createElement("span", { style: { fontSize: 10 } }, "\u25C6"),
      import_react.default.createElement("span", { style: { letterSpacing: "0.03em" } }, "ATTENTION")
    );
  }
  if (isUnread) {
    return import_react.default.createElement(
      "div",
      {
        "data-ade-telemetry": "unread",
        title: "Turn completed \u2014 unread response",
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "2px 7px",
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 700,
          color: "#86efac",
          background: "rgba(34, 197, 94, 0.14)",
          border: "1px solid rgba(34, 197, 94, 0.45)",
          boxShadow: "0 0 8px rgba(34, 197, 94, 0.2)",
          flex: "0 0 auto",
          userSelect: "none"
        }
      },
      import_react.default.createElement("span", { style: { fontSize: 11, fontWeight: 900 } }, "\u2713"),
      import_react.default.createElement("span", { style: { letterSpacing: "0.03em" } }, "READY")
    );
  }
  return null;
}
function ADEPaneTelemetry(props) {
  if (typeof props.useSessionStatus !== "function") return null;
  return import_react.default.createElement(ADEPaneTelemetryReader, props);
}
function ADESplitRoot(props) {
  const renderSlot = typeof props.renderSlot === "function" ? props.renderSlot : cachedRenderSlot;
  const SessionProvider = typeof props.SessionProvider === "function" ? props.SessionProvider : cachedSessionProvider;
  if (props.useSessionStatus) cachedUseSessionStatus = props.useSessionStatus;
  const useSessionStatus = props.useSessionStatus || cachedUseSessionStatus;
  const snap = (0, import_react.useSyncExternalStore)(subscribe, getState);
  const panes = snap.panes;
  const rawTree = snap.tree;
  const tree = import_react.default.useMemo(() => ensureTree(rawTree, panes), [rawTree, panes]);
  const geometry = import_react.default.useMemo(() => computeTreeGeometry(tree ? tree.root : null), [tree]);
  const [draggingDividerId, setDraggingDividerId] = import_react.default.useState(null);
  const containerRef = import_react.default.useRef(null);
  const totalPanes = panes.length;
  const [mountedCount, setMountedCount] = import_react.default.useState(() => totalPanes > 0 ? 1 : 0);
  const mountedRef = import_react.default.useRef(mountedCount);
  mountedRef.current = mountedCount;
  import_react.default.useEffect(() => {
    if (totalPanes <= 0) return void 0;
    if (mountedRef.current >= totalPanes) return void 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      mountedRef.current = Math.min(mountedRef.current + 1, totalPanes);
      if (typeof import_react.default.startTransition === "function") {
        import_react.default.startTransition(() => setMountedCount(mountedRef.current));
      } else {
        setMountedCount(mountedRef.current);
      }
      if (mountedRef.current < totalPanes) setTimeout(step, 90);
    };
    const first = setTimeout(step, 24);
    return () => {
      cancelled = true;
      clearTimeout(first);
    };
  }, [totalPanes]);
  const [metaTick, setMetaTick] = import_react.default.useState(0);
  import_react.default.useEffect(() => {
    const unsubSessions = app?.sessions?.list?.subscribe?.(() => setMetaTick((t) => t + 1));
    const unsubWs = (app?.workspaces || app?.uiWorkspace?.workspaces)?.list?.subscribe?.(() => setMetaTick((t) => t + 1));
    return () => {
      unsubSessions?.();
      unsubWs?.();
    };
  }, []);
  import_react.default.useEffect(() => {
    if (typeof props.renderSlot === "function") cachedRenderSlot = props.renderSlot;
    if (typeof props.SessionProvider === "function") cachedSessionProvider = props.SessionProvider;
    if (typeof props.useSessionStatus === "function") cachedUseSessionStatus = props.useSessionStatus;
  }, [props.renderSlot, props.SessionProvider, props.useSessionStatus]);
  if (panes.length === 0) {
    if (originalConversationPanel) {
      return import_react.default.createElement(originalConversationPanel, props);
    }
    return renderSlot ? renderSlot("main.conversation", {}) : null;
  }
  const closePane = (sessionId) => {
    releaseReference(sessionId);
    const nextPanes = state.panes.filter((p) => p.sessionId !== sessionId);
    if (nextPanes.length === 0) {
      deactivateSplit();
      return;
    }
    if (nextPanes.length === 1) {
      deactivateSplit(nextPanes[0].sessionId);
      return;
    }
    const currentTree = tree || ensureTree(null, state.panes);
    const nextTree = removePane(currentTree, sessionId);
    const remainingIds = getTreePaneIds(nextTree ? nextTree.root : null);
    if (remainingIds.length <= 1) {
      deactivateSplit(remainingIds[0]);
    } else {
      setTree(nextTree);
    }
  };
  const onDividerDown = (div) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const isRow = div.direction === "row";
    const startCoord = isRow ? e.clientX : e.clientY;
    const parentPx = isRow ? Math.max(1, containerRect.width * div.parentBox.width / 100) : Math.max(1, containerRect.height * div.parentBox.height / 100);
    const currentSizes = div.sizes.slice();
    const prevSize = currentSizes[div.splitIndex];
    const nextSize = currentSizes[div.splitIndex + 1];
    setDraggingDividerId(div.id);
    const move = (ev) => {
      const curCoord = isRow ? ev.clientX : ev.clientY;
      const res = calculateResize(isRow, startCoord, curCoord, parentPx, prevSize, nextSize);
      const newSizes = currentSizes.slice();
      newSizes[div.splitIndex] = res.newPrevGrow;
      newSizes[div.splitIndex + 1] = res.newNextGrow;
      const nextTree = updateTreeSizes(state.tree, div.splitId, newSizes);
      setTree(nextTree);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDraggingDividerId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return import_react.default.createElement(
    "div",
    {
      ref: containerRef,
      style: {
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        boxSizing: "border-box"
      },
      "data-ade-split": ""
    },
    panes.map((pane, idx) => {
      const rect = geometry.panes[pane.sessionId] || { left: 0, top: 0, width: 100, height: 100 };
      const splitDirection = getImmediateSplitDirection(tree ? tree.root : null, pane.sessionId) || "row";
      return import_react.default.createElement(ADESplitPaneItem, {
        key: pane.sessionId,
        pane,
        idx,
        rect,
        splitDirection,
        isDraggingDivider: !!draggingDividerId,
        closePane,
        togglePaneSplit: togglePaneSplitInState,
        renderSlot,
        SessionProvider,
        mountedCount,
        useSessionStatus
      });
    }),
    geometry.dividers.map((div) => {
      const isRow = div.direction === "row";
      return import_react.default.createElement("div", {
        key: div.id,
        "data-ade-divider": "",
        "data-ade-dir": div.direction,
        "data-ade-dragging": draggingDividerId === div.id ? "true" : void 0,
        style: {
          position: "absolute",
          left: isRow ? `calc(${div.left}% - 4px)` : `${div.left}%`,
          top: isRow ? `${div.top}%` : `calc(${div.top}% - 4px)`,
          width: isRow ? "8px" : `${div.width}%`,
          height: isRow ? `${div.height}%` : "8px",
          cursor: isRow ? "col-resize" : "row-resize",
          zIndex: 10
        },
        onPointerDown: onDividerDown(div)
      });
    })
  );
}
function ADESplitPaneItem(props) {
  const {
    pane,
    idx,
    rect,
    splitDirection,
    isDraggingDivider,
    closePane,
    togglePaneSplit: togglePaneSplit2,
    renderSlot,
    SessionProvider,
    mountedCount,
    useSessionStatus
  } = props;
  const ref = ensureReference(pane.sessionId);
  const accent = accentFor(pane.sessionId);
  const title = sessionTitle(pane.sessionId);
  const ws = workspaceOf(pane.sessionId);
  const mounted = idx === 0 || idx < mountedCount;
  const isImmediatelyOpen = (() => {
    if (idx === 0) return true;
    try {
      return !!(ref && ref.binding && ref.binding.session && ref.binding.session.openState === "open");
    } catch (_) {
      return false;
    }
  })();
  const [isOpen, setIsOpen] = import_react.default.useState(isImmediatelyOpen);
  import_react.default.useEffect(() => {
    if (isOpen || !mounted) return void 0;
    let active = true;
    if (ref && ref.ready && typeof ref.ready.then === "function") {
      ref.ready.then(() => {
        if (!active) return;
        requestAnimationFrame(() => {
          if (!active) return;
          if (typeof import_react.default.startTransition === "function") {
            import_react.default.startTransition(() => setIsOpen(true));
          } else {
            setIsOpen(true);
          }
        });
      });
    } else {
      setIsOpen(true);
    }
    return () => {
      active = false;
    };
  }, [mounted, isOpen, ref]);
  const shouldRenderContent = mounted && isOpen;
  const pendingPlaceholder = import_react.default.createElement(
    "div",
    { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--dsw-alias-fg-l2, rgba(255,255,255,0.45))", font: "13px/1.4 system-ui, sans-serif", background: "var(--dsw-alias-bg-base, #1e1e24)" } },
    import_react.default.createElement("div", { style: { width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.12)", borderTopColor: "var(--dsw-alias-brand, #4f78ff)", animation: "ade-spin 700ms linear infinite" } }),
    import_react.default.createElement("span", null, "Loading " + title + "...")
  );
  const onHeaderDragStart = (e) => {
    reorderDragFromSessionId = pane.sessionId;
    if (e.dataTransfer) {
      try {
        e.dataTransfer.effectAllowed = "move";
      } catch (_) {
      }
      try {
        e.dataTransfer.setData(REORDER_MIME, pane.sessionId);
      } catch (_) {
      }
      try {
        e.dataTransfer.setData("text/plain", pane.sessionId);
      } catch (_) {
      }
    }
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-ade-pane][data-ade-session-id="${pane.sessionId}"]`);
      if (el) el.setAttribute("data-ade-dragging-source", "true");
    });
  };
  const onHeaderDragEnd = () => {
    reorderDragFromSessionId = null;
    hideOverlay();
    const el = document.querySelector(`[data-ade-pane][data-ade-dragging-source="true"]`);
    if (el) el.removeAttribute("data-ade-dragging-source");
  };
  return import_react.default.createElement(
    "div",
    {
      "data-ade-pane": "",
      "data-ade-session-id": pane.sessionId,
      "data-ade-slot": String(idx),
      "data-ade-hypr-anim": "true",
      onAnimationEnd: (e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.removeAttribute("data-ade-hypr-anim");
        }
      },
      style: {
        position: "absolute",
        left: `calc(${rect.left}% + 3px)`,
        top: `calc(${rect.top}% + 3px)`,
        width: `calc(${rect.width}% - 6px)`,
        height: `calc(${rect.height}% - 6px)`,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        minHeight: 0,
        borderRadius: "10px",
        border: `1px solid ${accent.border}`,
        borderTop: `2px solid ${accent.dot}`,
        background: "rgba(10, 10, 14, 0.28)",
        "--dsw-alias-bg-base": "transparent",
        "--dsw-specific-sidebar-fill": "transparent",
        boxShadow: `0 4px 16px rgba(0,0,0,0.22), 0 0 10px ${accent.glow.replace("0.45", "0.12")}`,
        pointerEvents: isDraggingDivider ? "none" : "auto",
        transition: isDraggingDivider ? "none" : "left 280ms cubic-bezier(0.22, 1, 0.36, 1), top 280ms cubic-bezier(0.22, 1, 0.36, 1), width 280ms cubic-bezier(0.22, 1, 0.36, 1), height 280ms cubic-bezier(0.22, 1, 0.36, 1)",
        willChange: "auto"
      }
    },
    import_react.default.createElement(
      "div",
      {
        style: paneHeaderStyle,
        "data-ade-header": "",
        draggable: true,
        onDragStart: onHeaderDragStart,
        onDragEnd: onHeaderDragEnd,
        onDragOver: (e) => e.preventDefault()
      },
      import_react.default.createElement("span", {
        draggable: false,
        "data-ade-panedot": "",
        style: {
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: accent.dot,
          boxShadow: `0 0 6px ${accent.glow}`,
          flex: "0 0 auto",
          pointerEvents: "none"
        }
      }),
      ws?.title ? import_react.default.createElement(
        "span",
        {
          draggable: false,
          "data-ade-pane-workspace": "",
          title: ws.path || ws.title,
          style: {
            maxWidth: 140,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            padding: "2px 7px",
            borderRadius: 999,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: accent.badgeFg,
            background: accent.badgeBg,
            border: `1px solid ${accent.badgeBorder}`,
            flex: "0 0 auto",
            pointerEvents: "none"
          }
        },
        ws.title
      ) : null,
      import_react.default.createElement("span", { style: paneTitleStyle, draggable: false }, title),
      import_react.default.createElement(ADEPaneTelemetry, {
        sessionId: pane.sessionId,
        useSessionStatus
      }),
      import_react.default.createElement("button", {
        style: { ...closeButtonStyle, fontWeight: 700 },
        "aria-label": splitDirection === "col" ? "Split side by side (horizontal)" : "Split stacked (vertical)",
        title: splitDirection === "col" ? "Switch this split to side-by-side" : "Switch this split to stacked",
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: () => togglePaneSplit2(pane.sessionId)
      }, splitDirection === "col" ? "\u21C4" : "\u21C5"),
      import_react.default.createElement("button", {
        style: closeButtonStyle,
        "aria-label": "Close pane",
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: () => closePane(pane.sessionId)
      }, "\xD7")
    ),
    import_react.default.createElement(
      "div",
      { style: { flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" } },
      import_react.default.createElement(
        import_react.default.Suspense,
        { fallback: pendingPlaceholder },
        shouldRenderContent ? import_react.default.createElement(
          PaneErrorBoundary,
          null,
          import_react.default.createElement(SessionProvider, { session: ref }, renderSlot("main.conversation", {}))
        ) : pendingPlaceholder
      )
    )
  );
}
var paneHeaderStyle = {
  height: 32,
  padding: "0 10px",
  background: "rgba(20, 20, 28, 0.72)",
  backdropFilter: "blur(12px) saturate(150%)",
  WebkitBackdropFilter: "blur(12px) saturate(150%)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  userSelect: "none",
  cursor: "grab",
  flex: "0 0 auto"
};
var paneTitleStyle = {
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--dsw-alias-fg-l1, #f4f4f5)",
  fontFamily: "system-ui, -apple-system, sans-serif",
  pointerEvents: "none"
};
var closeButtonStyle = {
  background: "transparent",
  border: "none",
  color: "var(--dsw-alias-fg-l3, rgba(255,255,255,0.45))",
  cursor: "pointer",
  padding: "2px 6px",
  borderRadius: 4,
  fontSize: 14,
  lineHeight: 1
};
var dropOverlay = null;
function overlay() {
  if (!dropOverlay) {
    dropOverlay = document.createElement("div");
    dropOverlay.id = "dsh-ade-drag-preview";
    Object.assign(dropOverlay.style, {
      position: "fixed",
      pointerEvents: "none",
      zIndex: "99999",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "2px solid rgba(56, 189, 248, 0.9)",
      background: "rgba(56, 189, 248, 0.12)",
      borderRadius: "10px",
      boxShadow: "0 0 24px rgba(56, 189, 248, 0.35), inset 0 0 16px rgba(56, 189, 248, 0.15)",
      font: "600 13px/1.3 system-ui, sans-serif",
      color: "#e0f2fe",
      textShadow: "0 1px 3px rgba(0,0,0,0.7)",
      opacity: "0",
      transform: "scale(0.97)",
      transition: "left 140ms cubic-bezier(0.2, 0.9, 0.3, 1), top 140ms cubic-bezier(0.2, 0.9, 0.3, 1), width 140ms cubic-bezier(0.2, 0.9, 0.3, 1), height 140ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 120ms ease"
    });
    document.body.appendChild(dropOverlay);
  }
  return dropOverlay;
}
function hideOverlay() {
  if (!dropOverlay) return;
  dropOverlay.style.opacity = "0";
  dropOverlay.style.transform = "scale(0.97)";
}
function apply(ctx) {
  pluginCtx = ctx;
  refreshHandles();
  injectMotionStyles();
  ensureConversationWrapped();
  ensureSidebarWrapped();
  ensureAliasRegistered();
  if (pluginCtx && pluginCtx.slots && pluginCtx.slots.subscribe) {
    pluginCtx.slots.subscribe("sidebar.workspaces", ensureSidebarWrapped);
    pluginCtx.slots.subscribe("main", ensureConversationWrapped);
  }
  restorePersistedSplit();
  let pendingSessionId = null;
  let warmedSessionId = null;
  let overCenter = false;
  let dropHandled = false;
  let currentTargetSessionId = null;
  let currentTargetZone = null;
  const isValidSessionId = (id) => {
    if (!id || !app || !app.sessions) return false;
    try {
      const snapshot = app.sessions.list.getSnapshot();
      return !!snapshot && !!snapshot.byId[id];
    } catch (_) {
      return false;
    }
  };
  const onDragStart = (e) => {
    try {
      const row = e.target && typeof e.target.closest === "function" ? e.target.closest("[data-row-key]") : null;
      const key = row && row.getAttribute ? row.getAttribute("data-row-key") || "" : "";
      if (!key.startsWith("session:")) return;
      const id = key.slice("session:".length);
      if (!id) return;
      pendingSessionId = id;
      dropHandled = false;
      if (e.dataTransfer) {
        try {
          e.dataTransfer.effectAllowed = "move";
        } catch (_) {
        }
        try {
          e.dataTransfer.setData("text/plain", id);
        } catch (_) {
        }
      }
      e.stopPropagation();
    } catch (_) {
    }
  };
  const onDragOver = (e) => {
    const isReorder = isReorderDrag(e);
    const dragSessionId = reorderDragFromSessionId || pendingSessionId;
    if (!dragSessionId && !isReorder) return;
    const probe = document.querySelector("[data-ade-split]") || document.querySelector(".mP3x-q_centerCol") || document.querySelector("[data-conversation-content]");
    let newOverCenter = e.clientX > 240;
    if (probe) {
      const r = probe.getBoundingClientRect();
      newOverCenter = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    overCenter = newOverCenter;
    if (!overCenter) {
      hideOverlay();
      currentTargetSessionId = null;
      currentTargetZone = null;
      return;
    }
    if (pendingSessionId && !isReorder && warmedSessionId !== pendingSessionId) {
      warmedSessionId = pendingSessionId;
      try {
        ensureReference(pendingSessionId);
      } catch (_) {
      }
    }
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      try {
        e.dataTransfer.dropEffect = "move";
      } catch (_) {
      }
    }
    const fromPoint = typeof document.elementFromPoint === "function" ? document.elementFromPoint(e.clientX, e.clientY) : null;
    const paneEl = fromPoint?.closest("[data-ade-pane]") || (e.target && typeof e.target.closest === "function" ? e.target.closest("[data-ade-pane]") : null);
    let targetSessionId = null;
    let rect = null;
    if (paneEl) {
      targetSessionId = paneEl.getAttribute("data-ade-session-id");
      rect = paneEl.getBoundingClientRect();
    } else {
      const fallbackTarget = document.querySelector("[data-ade-split]") || document.querySelector(".mP3x-q_centerCol") || document.querySelector("[data-conversation-content]");
      if (fallbackTarget) {
        rect = fallbackTarget.getBoundingClientRect();
        targetSessionId = currentMainSessionId() || state.panes[0]?.sessionId;
      }
    }
    if (reorderDragFromSessionId && targetSessionId === reorderDragFromSessionId) {
      const selfRes = computeDropZone(rect, e.clientX, e.clientY, true).zone;
      const splitInfo = getImmediateSplitInfo(state.tree ? state.tree.root : null, reorderDragFromSessionId);
      if (selfRes !== "center" && splitInfo && splitInfo.siblingPaneId && selfRes !== splitInfo.currentSide) {
        const siblingEl = document.querySelector(
          `[data-ade-pane][data-ade-session-id="${splitInfo.siblingPaneId}"]`
        );
        if (siblingEl) {
          const sibRect = siblingEl.getBoundingClientRect();
          const minL = Math.min(rect.left, sibRect.left);
          const minT = Math.min(rect.top, sibRect.top);
          const maxR = Math.max(rect.left + rect.width, sibRect.left + sibRect.width);
          const maxB = Math.max(rect.top + rect.height, sibRect.top + sibRect.height);
          rect = { left: minL, top: minT, width: maxR - minL, height: maxB - minT };
          targetSessionId = splitInfo.siblingPaneId;
        }
      }
      if (targetSessionId === reorderDragFromSessionId) {
        hideOverlay();
        currentTargetSessionId = null;
        currentTargetZone = null;
        return;
      }
    }
    if (!rect || !targetSessionId) {
      hideOverlay();
      currentTargetSessionId = null;
      currentTargetZone = null;
      return;
    }
    const allowCenter = isReorder;
    const drop = computeDropZone(rect, e.clientX, e.clientY, allowCenter);
    const zone = drop.zone;
    const previewBox = {
      left: drop.rect.left + 4,
      top: drop.rect.top + 4,
      width: Math.max(20, drop.rect.width - 8),
      height: Math.max(20, drop.rect.height - 8)
    };
    currentTargetSessionId = targetSessionId;
    currentTargetZone = zone;
    const ov = overlay();
    ov.style.left = `${previewBox.left}px`;
    ov.style.top = `${previewBox.top}px`;
    ov.style.width = `${previewBox.width}px`;
    ov.style.height = `${previewBox.height}px`;
    ov.style.opacity = "1";
    ov.style.transform = "scale(1)";
    const sourceName = isReorder ? sessionTitle(reorderDragFromSessionId) : sessionTitle(pendingSessionId);
    const targetName = sessionTitle(targetSessionId);
    const actionLabel = zone === "center" ? `Swap with ${targetName}` : `Split ${zone.toUpperCase()} of ${targetName}`;
    ov.textContent = `${sourceName} \u2192 ${actionLabel}`;
  };
  const onDrop = (e) => {
    hideOverlay();
    if (!overCenter) return;
    const targetSessionId = currentTargetSessionId;
    const zone = currentTargetZone;
    currentTargetSessionId = null;
    currentTargetZone = null;
    if (reorderDragFromSessionId) {
      const sourceId = reorderDragFromSessionId;
      reorderDragFromSessionId = null;
      e.preventDefault();
      e.stopPropagation();
      dropHandled = true;
      if (!targetSessionId || targetSessionId === sourceId || !zone) return;
      const currentTree = ensureTree(state.tree, state.panes);
      if (zone === "center") {
        const nextTree = swapTreePanes(currentTree, sourceId, targetSessionId);
        setTree(nextTree);
      } else {
        const nextTree = insertOrSplit(currentTree, sourceId, targetSessionId, zone);
        setTree(nextTree);
      }
      return;
    }
    if (pendingSessionId) {
      const droppedId = pendingSessionId;
      pendingSessionId = null;
      if (!isValidSessionId(droppedId)) return;
      e.preventDefault();
      e.stopPropagation();
      dropHandled = true;
      if (state.panes && state.panes.length > 0) {
        if (state.panes.some((p) => p.sessionId === droppedId)) return;
        const currentTree = ensureTree(state.tree, state.panes);
        const anchor = targetSessionId || state.panes[0]?.sessionId;
        const targetZone = zone === "center" || !zone ? "right" : zone;
        const nextTree = insertOrSplit(currentTree, droppedId, anchor, targetZone);
        activateSplitWithTree(nextTree);
      } else {
        const activeId = currentMainSessionId() || app?.sessions?.list?.getSnapshot?.()?.ids?.[0];
        let initialTree;
        const targetZone = zone === "center" || !zone ? "right" : zone;
        if (!activeId || activeId === droppedId) {
          const snapshot = app?.sessions?.list?.getSnapshot?.();
          const ids = snapshot?.ids || snapshot?.order || [];
          const otherId = ids.find((id) => id !== activeId);
          if (otherId) {
            initialTree = insertOrSplit({ root: { kind: "pane", id: activeId || droppedId } }, otherId, activeId || droppedId, targetZone);
          } else {
            initialTree = { root: { kind: "pane", id: droppedId } };
          }
        } else {
          initialTree = insertOrSplit({ root: { kind: "pane", id: activeId } }, droppedId, activeId, targetZone);
        }
        activateSplitWithTree(initialTree);
      }
    }
  };
  const onDragEnd = () => {
    hideOverlay();
    currentTargetSessionId = null;
    currentTargetZone = null;
    reorderDragFromSessionId = null;
    const el = document.querySelector(`[data-ade-pane][data-ade-dragging-source="true"]`);
    if (el) el.removeAttribute("data-ade-dragging-source");
    if (pendingSessionId && !dropHandled) {
      if (warmedSessionId === pendingSessionId) {
        releaseReference(pendingSessionId);
        warmedSessionId = null;
      }
      pendingSessionId = null;
    }
  };
  const onDragLeave = (e) => {
    if (!e.relatedTarget) hideOverlay();
  };
  window.addEventListener("dragstart", onDragStart, true);
  window.addEventListener("dragover", onDragOver, true);
  window.addEventListener("drop", onDrop, true);
  window.addEventListener("dragend", onDragEnd);
  window.addEventListener("dragleave", onDragLeave, true);
  const layoutSnapshot = app.layout ? app.layout.panelInfo : null;
  const isConversationPanel = (id) => id === null || id === "conversation";
  let lastInConversation = false;
  let savedSplitBeforeLeaving = null;
  if (layoutSnapshot) {
    const reconcile = () => {
      const panelId = layoutSnapshot.getSnapshot().activePanelId;
      const nowInConversation = isConversationPanel(panelId);
      if (lastInConversation && !nowInConversation && state.panes.length) {
        savedSplitBeforeLeaving = state.tree;
        for (const id of [...retained.keys()]) releaseReference(id);
        state = { tree: null, panes: [] };
        emit();
      } else if (!lastInConversation && nowInConversation && savedSplitBeforeLeaving) {
        const treeToRestore = savedSplitBeforeLeaving;
        savedSplitBeforeLeaving = null;
        activateSplitWithTree(treeToRestore);
      }
      lastInConversation = nowInConversation;
    };
    reconcile();
    const unsub = layoutSnapshot.subscribe ? layoutSnapshot.subscribe(reconcile) : null;
    const cleanup2 = () => {
      window.removeEventListener("dragstart", onDragStart, true);
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("drop", onDrop, true);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("dragleave", onDragLeave, true);
      hideOverlay();
      restoreConversationPanel();
      restoreSidebar();
      disposeAlias();
      if (typeof unsub === "function") unsub();
      for (const id of [...retained.keys()]) releaseReference(id);
      app = null;
    };
    return cleanup2;
  }
  const cleanup = () => {
    window.removeEventListener("dragstart", onDragStart, true);
    window.removeEventListener("dragover", onDragOver, true);
    window.removeEventListener("drop", onDrop, true);
    window.removeEventListener("dragend", onDragEnd);
    window.removeEventListener("dragleave", onDragLeave, true);
    hideOverlay();
    restoreConversationPanel();
    restoreSidebar();
    disposeAlias();
    for (const id of [...retained.keys()]) releaseReference(id);
    app = null;
  };
  return cleanup;
}
var inject = [
  "slots",
  "sessions",
  "layout",
  "uiWorkspace",
  "workspaces"
];

    return module.exports;
  }
  if (typeof window !== 'undefined' && window.__ModuleLoader__ && typeof window.__ModuleLoader__.load === 'function') {
    window.__ModuleLoader__.load({ id: "@community/dsh-plugin-ade", factory: factory });
    window.__ModuleLoader__.load({ id: "community-ade", factory: factory });
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(typeof require === 'function' ? require : function() { return {}; });
  }
})();
