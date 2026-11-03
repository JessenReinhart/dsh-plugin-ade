import React, { useSyncExternalStore } from 'react';
import {
  makeSplitId,
  normalizeSizes,
  getTreePaneIds,
  containsPane,
  removeNode,
  removePane,
  insertOrSplit,
  togglePaneSplit,
  getImmediateSplitDirection,
  getImmediateSplitInfo,
  swapTreePanes,
  replaceTreePaneId,
  updateTreeSizes,
  computeDropZone,
  calculateResize,
  computeTreeGeometry,
} from './layout-engine.js';

/**
 * ADE Multi-Pane — split the native DSH conversation view in place.
 *
 * Architecture (verified against dsh-client-ui-layout / -conversation / -session):
 *   - `main` is a keyed slot. `MainPanel` renders it with
 *     `entryKey: activePanelId ?? "conversation"`.
 *   - The native `conversation` entry already declares `main.conversation`;
 *     redeclaration is forbidden, so we swap that entry's component for
 *     ADESplitRoot and keep the native entry's children table. This is what
 *     hands ADESplitRoot `SessionProvider` and `renderSlot`.
 *   - A childless `ade-split` alias is registered only so
 *     `layout.hasMainPanel(PANEL_KEY)` is true for future selectPanel calls.
 *   - Each pane is `<SessionProvider session={reference}>` wrapping
 *     `renderSlot("main.conversation", {})` — i.e. the SAME native
 *     conversation (header + transcript + composer) the app already renders,
 *     just bound to a different session.
 *   - Feature 3: Sidebar "Layouts" section above Workspaces + layout presets & persistence.
 *   - Feature 5: Real-time agent status radar (pulsing RUNNING with live turn timers, ATTENTION, READY).
 */

const PANEL_KEY = 'ade-split';
const SAVED_LAYOUTS_KEY = 'dsh-ade-saved-layouts-v1';
const ACTIVE_STATE_KEY = 'dsh-ade-active-state-v1';

// ---- shared multi-pane state (accessed by both the harness hook and the
//    mounted React component; both run in the same client bundle instance) ----
let state = {
  tree: null, // LayoutTree: { root: LayoutNode | null }
  panes: [],  // [{ sessionId }] - stable mount order
};
let splitStartMs = 0;
const listeners = new Set();
const emit = () => { for (const l of listeners) l(); };
const getState = () => state;
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const layoutListeners = new Set();
let layoutsSnapshotCache = null;
function subscribeLayouts(fn) {
  layoutListeners.add(fn);
  return () => layoutListeners.delete(fn);
}
function emitLayoutsChange() {
  layoutsSnapshotCache = null;
  for (const fn of layoutListeners) {
    try { fn(); } catch (_) {}
  }
}

// ---- subagent swarm state (auto-split stack) ----
const SUBAGENT_AUTOSPLIT_KEY = 'dsh-ade-subagent-autosplit';
const swarmListeners = new Set();
let swarmSnapshot = { stacks: {}, knownIds: new Set() };
let swarmSnapshotCache = null;
let knownSubagentIds = new Set();
const PINNED_STACK_BY_PARENT = new Map();

function getSubagentAutosplitSetting() {
  try {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(SUBAGENT_AUTOSPLIT_KEY) !== 'off';
  } catch (_) {
    return true;
  }
}

function setSubagentAutosplitSetting(enabled) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (enabled) localStorage.removeItem(SUBAGENT_AUTOSPLIT_KEY);
      else localStorage.setItem(SUBAGENT_AUTOSPLIT_KEY, 'off');
    }
  } catch (_) {}
  emitSubagentSnapshot();
}

function emitSubagentSnapshot(patch) {
  swarmSnapshotCache = null;
  if (patch) swarmSnapshot = patch;
  for (const fn of swarmListeners) {
    try { fn(); } catch (_) {}
  }
}

function getSubagentSnapshot() {
  if (swarmSnapshotCache === null) {
    swarmSnapshotCache = {
      stacks: swarmSnapshot.stacks,
      known: swarmSnapshot.knownIds,
      pinned: PINNED_STACK_BY_PARENT,
      autosplit: getSubagentAutosplitSetting(),
    };
  }
  return swarmSnapshotCache;
}

function subscribeSubagent(fn) {
  swarmListeners.add(fn);
  return () => swarmListeners.delete(fn);
}

function readSessionsSnapshot() {
  if (!app || !app.sessions || !app.sessions.list || !app.sessions.list.getSnapshot) return null;
  try { return app.sessions.list.getSnapshot(); } catch (_) { return null; }
}

function childEntriesForParent(snapshot, parentId) {
  if (!snapshot || !parentId) return [];
  const byId = snapshot.byId || {};
  const projections = snapshot.projectionsBySession || {};
  const out = [];
  const seen = new Set();
  for (const [id, summary] of Object.entries(byId)) {
    if (summary.origin === 'subagent' && summary.parentId === parentId) {
      seen.add(id);
      out.push({ id, label: summary.title || summary.label || summary.name || 'Subagent', mode: summary.mode || 'subagent', running: summary.running === true });
    }
  }
  const projection = projections[parentId];
  const catalog = projection && projection.values ? projection.values.subagentCatalog : null;
  for (const entry of catalog || []) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      out.push({ id: entry.id, label: entry.label || entry.title || 'Subagent', mode: entry.mode || 'subagent', running: false });
    }
  }
  return out;
}

function subagentParentOf(snapshot, childId) {
  if (!snapshot || !childId) return null;
  const byId = snapshot.byId || {};
  const summary = byId[childId];
  if (summary && summary.origin === 'subagent' && summary.parentId) return summary.parentId;
  const projections = snapshot.projectionsBySession || {};
  for (const [parentId, projection] of Object.entries(projections)) {
    const catalog = projection && projection.values ? projection.values.subagentCatalog : null;
    if (Array.isArray(catalog) && catalog.some((entry) => entry.id === childId)) return parentId;
  }
  return null;
}

function stackForParent(parentId) {
  const snap = getSubagentSnapshot();
  return snap.stacks[parentId] || { parentId, children: [] };
}

function refreshSubagentStacks() {
  const snapshot = readSessionsSnapshot();
  const byParent = new Map();
  const sessionSnap = getState();
  const visibleIds = new Set(sessionSnap.panes.map((p) => p.sessionId));
  for (const pane of sessionSnap.panes) {
    const parentId = subagentParentOf(snapshot, pane.sessionId);
    if (!parentId) continue;
    if (!byParent.has(parentId)) byParent.set(parentId, { parentId, children: [] });
    const children = childEntriesForParent(snapshot, parentId);
    for (const child of children) {
      if (!byParent.get(parentId).children.some((c) => c.id === child.id)) {
        byParent.get(parentId).children.push({ ...child, visible: visibleIds.has(child.id) });
      }
    }
  }
  const nextStacks = {};
  for (const [parentId, stack] of byParent) nextStacks[parentId] = stack;
  swarmSnapshot = { stacks: nextStacks, knownIds: knownSubagentIds };
  emitSubagentSnapshot();
}

let cachedCustomLayouts = null;
function getSavedLayouts() {
  if (cachedCustomLayouts !== null) return cachedCustomLayouts;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SAVED_LAYOUTS_KEY) : null;
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
      id: 'custom-' + Date.now(),
      name: name || `Layout (${panes.length} panes)`,
      createdAt: Date.now(),
      isCustom: true,
      panes: panes.map((p) => ({ sessionId: p.sessionId })),
      tree,
    };
    list.unshift(newLayout);
    cachedCustomLayouts = list;
    if (typeof localStorage !== 'undefined') {
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVED_LAYOUTS_KEY, JSON.stringify(list));
    }
    emitLayoutsChange();
  } catch (_) {}
}

function persistActiveState() {
  try {
    if (typeof localStorage === 'undefined') return;
    if (state.panes && state.panes.length > 0 && state.tree) {
      localStorage.setItem(
        ACTIVE_STATE_KEY,
        JSON.stringify({
          tree: state.tree,
          panes: state.panes,
          timestamp: Date.now(),
        })
      );
    } else {
      localStorage.removeItem(ACTIVE_STATE_KEY);
    }
  } catch (_) {}
}

const REORDER_MIME = 'application/x-dsh-ade-reorder';
let reorderDragFromSessionId = null;
function isReorderDrag(e) {
  if (reorderDragFromSessionId !== null) return true;
  try {
    if (e && e.dataTransfer && e.dataTransfer.types) {
      return Array.prototype.indexOf.call(e.dataTransfer.types, REORDER_MIME) !== -1;
    }
  } catch (_) {}
  return false;
}

// Module-level context handles, wired in apply().
let app = null;
let pluginCtx = null;
function refreshHandles() {
  if (!pluginCtx) return;
  app = {
    sessions: pluginCtx.sessions || (app && app.sessions),
    layout: pluginCtx.layout || (app && app.layout),
    uiWorkspace: pluginCtx.uiWorkspace || (app && app.uiWorkspace),
    workspaces: pluginCtx.workspaces || (app && app.workspaces),
    slots: pluginCtx.slots || (app && app.slots),
  };
}

const retained = new Map(); // sessionId -> sessions.retain() reference

let regState = 'init';

const ADE_DEBUG = true;
const debugBuffer = [];
let debugVersion = 0;
const debugSubs = new Set();

function debugLog(tag, detail) {
  if (!ADE_DEBUG) return;
  let text;
  try {
    text = detail == null ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail));
  } catch (_) {
    text = String(detail);
  }
  const entry = { t: Date.now() % 1000000, tag, detail: text };
  debugBuffer.push(entry);
  if (debugBuffer.length > 160) debugBuffer.shift();
  debugVersion += 1;
  try {
    console.log('%c[ADE]%c ' + tag + ' %c' + text,
      'color:#38bdf8;font-weight:bold', 'color:inherit', 'color:#94a3b8');
  } catch (_) {
    console.log('[ADE] ' + tag + ' ' + text);
  }
  for (const cb of debugSubs) {
    try { cb(debugVersion); } catch (_) {}
  }
}

function subscribeDebug(cb) {
  debugSubs.add(cb);
  return () => { debugSubs.delete(cb); };
}
function getDebugSnapshot() {
  return { version: debugVersion, entries: debugBuffer.slice() };
}

if (typeof window !== 'undefined') {
  window.__adeDump = () => {
    try { console.table(debugBuffer.slice(-40).map((e) => ({ tag: e.tag, detail: e.detail }))); } catch (_) {}
    return getDebugSnapshot();
  };
  window.__adeState = () => state;
}

function currentMainSessionId() {
  if (!app || !app.sessions) return undefined;
  try {
    const byId = app.sessions.list.getSnapshot().byId;
    return Object.values(byId).find((r) => (r.retainedBy.mainView ?? 0) > 0)?.id;
  } catch (_) {
    return undefined;
  }
}

function ensureReference(sessionId) {
  if (!retained.has(sessionId)) {
    retained.set(sessionId, app.sessions.retain(sessionId, { source: 'ade-multipane' }));
  }
  return retained.get(sessionId);
}

function releaseReference(sessionId) {
  const ref = retained.get(sessionId);
  if (ref) {
    retained.delete(sessionId);
    try { ref.release(); } catch (_) { /* already released */ }
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
    const ws = (app && app.workspaces) || (app && app.uiWorkspace && app.uiWorkspace.workspaces);
    return (ws && ws.list && ws.list.getSnapshot().items) || [];
  } catch (_) {
    return [];
  }
}

function workspaceOf(sessionId) {
  const items = workspaceItems();
  let idx = -1;
  const byMembership = items.find((w, i) => {
    if (Array.isArray(w.sessionIds) && w.sessionIds.includes(sessionId)) { idx = i; return true; }
    return false;
  });
  if (byMembership) {
    return {
      id: byMembership.workspaceId || byMembership.id || '',
      title: byMembership.title || (byMembership.path ? workspaceTitleOf(byMembership.path) : '') || byMembership.workspaceId || '',
      path: byMembership.path || '',
      index: idx,
    };
  }
  const sessionRow = app?.sessions?.list?.getSnapshot?.()?.byId?.[sessionId];
  const cwd = sessionRow?.cwd;
  if (cwd) {
    const byPath = items.findIndex((w) => w.path === cwd);
    if (byPath >= 0) {
      const w = items[byPath];
      return {
        id: w.workspaceId || w.id || '',
        title: w.title || workspaceTitleOf(w.path) || w.workspaceId || '',
        path: w.path || '',
        index: byPath,
      };
    }
  }
  return null;
}

function workspaceTitleOf(path) {
  if (!path) return '';
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

const ADE_PALETTE = [
  { dot: '#38bdf8', badgeBg: 'rgba(56, 189, 248, 0.14)', badgeFg: '#bae6fd', badgeBorder: 'rgba(56, 189, 248, 0.35)', glow: 'rgba(56, 189, 248, 0.45)' },
  { dot: '#a855f7', badgeBg: 'rgba(168, 85, 247, 0.14)', badgeFg: '#e9d5ff', badgeBorder: 'rgba(168, 85, 247, 0.35)', glow: 'rgba(168, 85, 247, 0.45)' },
  { dot: '#34d399', badgeBg: 'rgba(52, 211, 153, 0.14)', badgeFg: '#a7f3d0', badgeBorder: 'rgba(52, 211, 153, 0.35)', glow: 'rgba(52, 211, 153, 0.45)' },
  { dot: '#f59e0b', badgeBg: 'rgba(245, 158, 11, 0.14)', badgeFg: '#fde68a', badgeBorder: 'rgba(245, 158, 11, 0.35)', glow: 'rgba(245, 158, 11, 0.45)' },
  { dot: '#ec4899', badgeBg: 'rgba(236, 72, 153, 0.14)', badgeFg: '#fbcfe8', badgeBorder: 'rgba(236, 72, 153, 0.35)', glow: 'rgba(236, 72, 153, 0.45)' },
  { dot: '#06b6d4', badgeBg: 'rgba(6, 182, 212, 0.14)', badgeFg: '#a5f3fc', badgeBorder: 'rgba(6, 182, 212, 0.35)', glow: 'rgba(6, 182, 212, 0.45)' },
  { dot: '#84cc16', badgeBg: 'rgba(132, 204, 22, 0.14)', badgeFg: '#d9f99d', badgeBorder: 'rgba(132, 204, 22, 0.35)', glow: 'rgba(132, 204, 22, 0.45)' },
  { dot: '#f97316', badgeBg: 'rgba(249, 115, 22, 0.14)', badgeFg: '#fed7aa', badgeBorder: 'rgba(249, 115, 22, 0.35)', glow: 'rgba(249, 115, 22, 0.45)' },
];

function accentFor(sessionId) {
  const ws = workspaceOf(sessionId);
  if (ws && ws.index >= 0 && ADE_PALETTE[ws.index]) {
    return ADE_PALETTE[ws.index % ADE_PALETTE.length];
  }
  let h = 0;
  for (let i = 0; i < sessionId.length; i++) h = ((h << 5) - h + sessionId.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % ADE_PALETTE.length;
  return ADE_PALETTE[idx];
}

function setTree(tree) {
  const activeIds = getTreePaneIds(tree ? tree.root : null);
  const existingMap = new Map(state.panes.map((p) => [p.sessionId, p]));
  // Panes must mirror tree traversal order. state.panes order drives the
  // ensureTree reconciliation; a stale (non-tree) order makes ensureTree
  // treat a legitimate move/swap as a structural mismatch and rebuild.
  const nextPanes = activeIds.map((id) => existingMap.get(id) || { sessionId: id });
  state = {
    tree,
    panes: nextPanes,
  };
  emit();
  persistActiveState();
}

function setPanes(sessionIds) {
  const ids = [...new Set(sessionIds)].filter(Boolean).slice(0, 6);
  if (ids.length === 0) {
    state = { tree: null, panes: [] };
    emit();
    persistActiveState();
    return;
  }
  let tree = { root: { kind: 'pane', id: ids[0] } };
  for (let i = 1; i < ids.length; i++) {
    tree = insertOrSplit(tree, ids[i], ids[i - 1], 'right');
  }
  setTree(tree);
}

function togglePaneSplitInState(sessionId) {
  if (!state.tree || !state.tree.root) return;
  const nextTree = togglePaneSplit(state.tree, sessionId);
  setTree(nextTree);
}

function swapSubagentInPane(currentSessionId, nextSessionId) {
  if (!currentSessionId || !nextSessionId || currentSessionId === nextSessionId) return;
  if (!state.tree || !state.tree.root) return;
  ensureReference(nextSessionId);
  const nextTree = replaceTreePaneId(state.tree, currentSessionId, nextSessionId);
  const nextPanes = (state.panes || []).map((p) => {
    if (p.sessionId === currentSessionId) return { ...p, sessionId: nextSessionId };
    return p;
  });
  state = {
    tree: nextTree,
    panes: nextPanes,
  };
  emit();
  refreshSubagentStacks();
  persistActiveState();
}

function popOutSubagent(paneSessionId, childIdToPopOut) {
  if (!childIdToPopOut || !state.tree || !state.tree.root) return;
  if ((state.panes || []).length >= 4) return;
  ensureReference(childIdToPopOut);
  const snapshot = readSessionsSnapshot();
  const parentId = subagentParentOf(snapshot, childIdToPopOut);
  const siblings = parentId ? childEntriesForParent(snapshot, parentId) : [];
  const otherSibling = siblings.find(
    (c) => c.id !== childIdToPopOut && !(state.panes || []).some((p) => p.sessionId === c.id)
  );

  if (paneSessionId === childIdToPopOut && otherSibling) {
    // Keep stack in this slot with another sibling, pop childIdToPopOut to right
    const swappedTree = replaceTreePaneId(state.tree, paneSessionId, otherSibling.id);
    const splitTree = insertOrSplit(swappedTree, childIdToPopOut, otherSibling.id, 'right');
    setTree(splitTree);
  } else {
    // Normal split to the right
    const splitTree = insertOrSplit(state.tree, childIdToPopOut, paneSessionId, 'right');
    setTree(splitTree);
  }
}

function closeSwarmPane(currentSessionId) {
  const snapshot = readSessionsSnapshot();
  const parentId = subagentParentOf(snapshot, currentSessionId) || currentSessionId;
  PINNED_STACK_BY_PARENT.delete(parentId);
  emitSubagentSnapshot();
  releaseReference(currentSessionId);
  const nextPanes = (state.panes || []).filter((p) => p.sessionId !== currentSessionId);
  if (!state.tree || !state.tree.root || nextPanes.length === 0) {
    deactivateSplit();
    return;
  }
  const nextTree = removePane(state.tree, currentSessionId);
  const remainingIds = getTreePaneIds(nextTree ? nextTree.root : null);
  if (remainingIds.length === 0) {
    deactivateSplit();
  } else if (remainingIds.length === 1) {
    deactivateSplit(remainingIds[0]);
  } else {
    setTree(nextTree);
  }
}

function openSubagentStack(parentId) {
  const snapshot = readSessionsSnapshot();
  const children = childEntriesForParent(snapshot, parentId);
  if (!children.length) return;
  const existing = children.find((c) => getTreePaneIds(state.tree ? state.tree.root : null).includes(c.id));
  if (existing) {
    PINNED_STACK_BY_PARENT.set(parentId, existing.id);
    emitSubagentSnapshot();
    return;
  }
  if ((state.panes || []).length >= 4) return;
  const firstChild = children.find((c) => c.running) || children[0];
  ensureReference(firstChild.id);
  if (!state.tree || !state.tree.root) return;
  const parentPane = (state.panes || []).find((p) => p.sessionId === parentId);
  const targetId = parentPane ? parentPane.sessionId : state.panes[0].sessionId;
  setTree(insertOrSplit(state.tree, firstChild.id, targetId, 'right'));
}

function reconcileSubagentAutoSplit() {
  if (!getSubagentAutosplitSetting()) {
    refreshSubagentStacks();
    return;
  }
  const snapshot = readSessionsSnapshot();
  if (!snapshot) return;
  const currentPanes = (state.panes || []).slice();
  const panesSet = new Set(currentPanes.map((p) => p.sessionId));

  let visibleParents = [];
  if (currentPanes.length === 0) {
    const mainId = currentMainSessionId();
    if (mainId) visibleParents = [mainId];
  } else {
    visibleParents = currentPanes
      .map((p) => subagentParentOf(snapshot, p.sessionId) || p.sessionId)
      .filter((id) => id);
    // Add the non-subagent panes themselves as parents (they may own children).
    for (const p of currentPanes) {
      if (!subagentParentOf(snapshot, p.sessionId)) visibleParents.push(p.sessionId);
    }
    visibleParents = [...new Set(visibleParents)];
  }

  const firstId = currentPanes[0] ? currentPanes[0].sessionId : currentMainSessionId();
  for (const parentId of visibleParents) {
    const children = childEntriesForParent(snapshot, parentId);
    if (!children.length) continue;
    const runningChild = children.find((c) => c.running);
    const target = runningChild || children.find((c) => !panesSet.has(c.id)) || children[0];

    const wantsAutoSwitch = runningChild;
    const currentlyShownChild = currentPanes.find((p) => subagentParentOf(snapshot, p.sessionId) === parentId && p.sessionId !== parentId);

    if (currentlyShownChild) {
      // Keep the stack pane's current session only when user pinned that tab.
      const pinnedValue = PINNED_STACK_BY_PARENT.get(parentId);
      if (wantsAutoSwitch && pinnedValue !== currentlyShownChild.sessionId) {
        swapSubagentInPane(currentlyShownChild.sessionId, target.id);
      }
    } else if (target && !panesSet.has(target.id)) {
      if (currentPanes.length === 0 && firstId) {
        ensureTree({ root: { kind: 'pane', id: firstId } }, [{ sessionId: firstId }]);
      }
      const anchor = panesSet.has(parentId) ? parentId : firstId || parentId;
      if (anchor && panesSet.has(anchor)) {
        ensureReference(target.id);
        setTree(insertOrSplit(state.tree || ensureTree(null, currentPanes), target.id, anchor, 'right'));
      }
    }
  }
  refreshSubagentStacks();
}

let originalConversationPanel = null;
let wrappedConversationEntry = null;

function ensureConversationWrapped() {
  refreshHandles();
  if (!app || !app.slots) {
    regState = 'no-slots';
    return false;
  }
  try {
    const entries = app.slots.entries('main') || [];
    const conv = entries.find((entry) => entry && entry.options && entry.options.key === 'conversation');
    if (!conv) return false;
    if (conv.component === ADESplitRoot) return true;
    if (typeof conv.component !== 'function') return false;
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
    } catch (_) {}
  }
  wrappedConversationEntry = null;
  originalConversationPanel = null;
}

let originalSidebarWorkspaces = null;
let wrappedSidebarEntry = null;

function ensureSidebarWrapped() {
  refreshHandles();
  if (!app || !app.slots) return false;
  try {
    const entries = app.slots.entries('sidebar.workspaces') || [];
    const entry = entries.find((e) => e && typeof e.component === 'function');
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
    } catch (_) {}
  }
  wrappedSidebarEntry = null;
  originalSidebarWorkspaces = null;
}

let cachedRenderSlot = null;
let cachedSessionProvider = null;
let cachedUseSessionStatus = null;
let aliasDispose = null;

function ensureAliasRegistered() {
  refreshHandles();
  if (!app || !app.slots) return false;
  try {
    const entries = app.slots.entries('main') || [];
    const has = entries.some((entry) => entry && entry.options && entry.options.key === PANEL_KEY);
    if (has) return true;
    aliasDispose = app.slots.register(
      {
        name: 'main',
        key: PANEL_KEY,
      },
      ADESplitRoot
    );
    return true;
  } catch (err) {
    return false;
  }
}

function disposeAlias() {
  try { aliasDispose?.(); } catch (_) {}
  aliasDispose = null;
}

function activateSplitWithTree(tree) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  splitStartMs = t0;
  refreshHandles();
  ensureConversationWrapped();
  ensureSidebarWrapped();
  ensureAliasRegistered();
  injectMotionStyles();

  const ids = getTreePaneIds(tree ? tree.root : null);
  for (const id of ids) {
    try { ensureReference(id); } catch (_) {}
  }

  try {
    if (app && app.layout && app.layout.panelInfo) {
      const active = app.layout.panelInfo.getSnapshot?.()?.activePanelId;
      const seatsCached = typeof cachedRenderSlot === 'function' && typeof cachedSessionProvider === 'function';
      const canKeepAlias = active === PANEL_KEY && seatsCached;
      if (!canKeepAlias && active !== null && active !== 'conversation') {
        app.layout.selectPanel(null);
      }
    }
  } catch (_) {}

  setTree(tree);
}

function activateSplit(paneIds) {
  let tree = null;
  if (paneIds && paneIds.length > 0) {
    tree = { root: { kind: 'pane', id: paneIds[0] } };
    for (let i = 1; i < paneIds.length; i++) {
      tree = insertOrSplit(tree, paneIds[i], paneIds[i - 1], 'right');
    }
  }
  activateSplitWithTree(tree);
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
    try { if (app.layout) app.layout.selectPanel(null); } catch (_) {}
  }
}

function ensureTree(rawTree, panes) {
  if (!panes || panes.length === 0) return null;
  const paneIds = panes.map((p) => p.sessionId);
  if (rawTree && rawTree.root) {
    const treeIds = getTreePaneIds(rawTree.root);
    if (treeIds.length === paneIds.length) {
      const set = new Set(paneIds);
      if (treeIds.every((id) => set.has(id))) {
        debugLog('ensureTree', { action: 'keep-rawTree', treeIds, paneIds });
        return rawTree;
      }
    }
  }
  debugLog('ensureTree', { action: 'rebuild-fallback', paneIds });
  let tree = { root: { kind: 'pane', id: paneIds[0] } };
  for (let i = 1; i < paneIds.length; i++) {
    tree = insertOrSplit(tree, paneIds[i], paneIds[i - 1], 'right');
  }
  return tree;
}

class PaneErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    debugLog('Pane error caught: ' + (error && error.message));
  }
  render() {
    if (this.state.error) {
      return React.createElement(
        'div',
        {
          style: {
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            color: '#f87171',
            background: 'var(--dsw-alias-bg-base, #1e1e24)',
            fontSize: 13,
            lineHeight: 1.5,
            textAlign: 'center',
          },
        },
        React.createElement('div', { style: { fontWeight: 600, marginBottom: 8 } }, 'Session view crashed'),
        React.createElement(
          'div',
          { style: { opacity: 0.8, maxWidth: 360, wordBreak: 'break-word', fontSize: 11, marginBottom: 12 } },
          String(this.state.error?.message || this.state.error)
        ),
        React.createElement(
          'button',
          {
            onClick: () => this.setState({ error: null }),
            style: {
              padding: '6px 14px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12,
            },
          },
          'Retry'
        )
      );
    }
    return this.props.children;
  }
}

const MOTION_STYLE_ID = 'dsh-ade-motion-css';
function injectMotionStyles() {
  try {
    const existing = document.getElementById(MOTION_STYLE_ID);
    if (existing) existing.remove();
    const style = document.createElement('style');
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
      /* Compact native header inside ADE split panes */
      [data-ade-split] [data-ade-pane] header[data-window-drag],
      [data-ade-split] [data-ade-pane] [data-conversation-session] > header,
      [data-ade-split] [data-ade-pane] [data-conversation-session] header {
        min-height: 0 !important;
        height: auto !important;
        padding: 4px 10px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
        background: transparent !important;
        grid-template-columns: 1fr !important;
      }
      /* Hide leading sidebar toggle and corner explorer toggle in split panes */
      [data-ade-split] [data-ade-pane] [data-conversation-header-leading],
      [data-ade-split] [data-ade-pane] header [class*="headerLeading"],
      [data-ade-split] [data-ade-pane] [data-conversation-header-corner],
      [data-ade-split] [data-ade-pane] header [class*="headerCorner"] {
        display: none !important;
      }
      /* Hide native session crumbs/title in split panes (ADE header displays title) */
      [data-ade-split] [data-ade-pane] header nav[aria-label],
      [data-ade-split] [data-ade-pane] header [class*="crumbs"],
      [data-ade-split] [data-ade-pane] header [class*="crumbSeg"] {
        display: none !important;
      }
      /* Hide native conversation tabs inside split panes */
      [data-ade-split] [data-ade-pane] [data-conversation-tabs],
      [data-ade-split] [data-ade-pane] header [role="tablist"],
      [data-ade-split] [data-ade-pane] header [class*="tabs"] {
        display: none !important;
      }
      /* Flatten titleRow container layout */
      [data-ade-split] [data-ade-pane] [class*="titleRow"] {
        min-height: 26px !important;
        padding-inline-start: 0 !important;
        width: 100% !important;
        display: flex !important;
        justify-content: flex-start !important;
        align-items: center !important;
        gap: 6px !important;
      }
      [data-ade-split] [data-ade-pane] [class*="titleCluster"] {
        flex: 1 !important;
        min-width: 0 !important;
        display: flex !important;
        justify-content: flex-start !important;
        align-items: center !important;
        gap: 6px !important;
      }
      /* Retain action buttons (preset selector, subagents dropdown, jobs) on the left */
      [data-ade-split] [data-ade-pane] header [class*="headerActions"],
      [data-ade-split] [data-ade-pane] [data-conversation-session] [class*="headerActions"] {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
      }
      /* Retain utilities (e.g. open in app, schedule) pushed to the right */
      [data-ade-split] [data-ade-pane] header [class*="headerUtilities"],
      [data-ade-split] [data-ade-pane] [data-conversation-session] [class*="headerUtilities"] {
        margin-left: auto !important;
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
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
      [data-ade-preset-strip] {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        padding: 1px 2px;
      }
      [data-ade-subagent-deck-track] {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
      }
      [data-ade-subagent-deck-track]::-webkit-scrollbar {
        height: 5px;
      }
      [data-ade-subagent-deck-track]::-webkit-scrollbar-track {
        background: transparent;
      }
      [data-ade-subagent-deck-track]::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.22);
        border-radius: 999px;
      }
      [data-ade-subagent-tab] {
        scroll-snap-align: start;
      }
      [data-ade-preset-btn] {
        width: 28px;
        height: 28px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin: 0;
        border-radius: 7px;
        color: var(--dsw-alias-label-secondary, rgba(255, 255, 255, 0.65));
        background: var(--dsw-alias-interactive-bg-base, rgba(255, 255, 255, 0.05));
        border: 1px solid transparent;
        cursor: pointer;
        transition: color 120ms ease, background 120ms ease, border-color 120ms ease;
      }
      [data-ade-preset-btn]:hover {
        color: var(--dsw-alias-label-primary, #e2e8f0);
        background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.1));
      }
      [data-ade-preset-btn][data-active="true"] {
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.14);
        border-color: rgba(56, 189, 248, 0.35);
      }
      [data-ade-save-form] {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 2px 2px 6px 2px;
      }
      [data-ade-save-input] {
        flex: 1;
        min-width: 0;
        height: 26px;
        padding: 0 8px;
        border-radius: 6px;
        border: 1px solid var(--dsw-alias-border-base, rgba(255, 255, 255, 0.12));
        background: var(--dsw-alias-bg-canvas, rgba(0, 0, 0, 0.25));
        color: var(--dsw-alias-label-primary, #e2e8f0);
        font: inherit;
        font-size: 12px;
        outline: none;
      }
      [data-ade-save-input]:focus {
        border-color: rgba(56, 189, 248, 0.6);
      }
      [data-ade-save-confirm],
      [data-ade-save-cancel] {
        height: 26px;
        padding: 0 8px;
        border-radius: 6px;
        border: 1px solid transparent;
        font-size: 11px;
        cursor: pointer;
      }
      [data-ade-save-confirm] {
        color: #38bdf8;
        background: rgba(56, 189, 248, 0.14);
        border-color: rgba(56, 189, 248, 0.3);
      }
      [data-ade-save-cancel] {
        color: var(--dsw-alias-label-secondary, rgba(255, 255, 255, 0.65));
        background: transparent;
      }
      [data-ade-subagent-deck] {
        animation: ade-deck-in 160ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      @keyframes ade-deck-in {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      [data-ade-subagent-tab][data-status="running"] .ade-swarm-dot {
        animation: ade-pulse 1.1s ease-in-out infinite;
      }
      [data-ade-subagent-tab]:hover {
        border-color: rgba(255, 255, 255, 0.2) !important;
        background: rgba(255, 255, 255, 0.08) !important;
      }
      @keyframes ade-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.45; transform: scale(0.78); }
      }
      [data-ade-autosplit-row]:hover {
        background: rgba(255, 255, 255, 0.05);
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
  } catch (_) {}
}

function getPresetLayouts() {
  return [
    {
      id: 'preset-col-2',
      name: 'Side by Side',
      panesCount: 2,
      subtitle: '2 Panes (Cols)',
      icon: 'col-2',
      buildTree: (ids) => ({
        root: {
          kind: 'split',
          id: makeSplitId(),
          direction: 'row',
          children: [{ kind: 'pane', id: ids[0] }, { kind: 'pane', id: ids[1] }],
          sizes: [0.5, 0.5],
        },
      }),
    },
    {
      id: 'preset-row-2',
      name: 'Stacked',
      panesCount: 2,
      subtitle: '2 Panes (Rows)',
      icon: 'row-2',
      buildTree: (ids) => ({
        root: {
          kind: 'split',
          id: makeSplitId(),
          direction: 'col',
          children: [{ kind: 'pane', id: ids[0] }, { kind: 'pane', id: ids[1] }],
          sizes: [0.5, 0.5],
        },
      }),
    },
    {
      id: 'preset-master-stack-3',
      name: 'Master + Stack',
      panesCount: 3,
      subtitle: '3 Panes (60/40)',
      icon: 'master-stack-3',
      buildTree: (ids) => ({
        root: {
          kind: 'split',
          id: makeSplitId(),
          direction: 'row',
          children: [
            { kind: 'pane', id: ids[0] },
            {
              kind: 'split',
              id: makeSplitId(),
              direction: 'col',
              children: [{ kind: 'pane', id: ids[1] }, { kind: 'pane', id: ids[2] }],
              sizes: [0.5, 0.5],
            },
          ],
          sizes: [0.6, 0.4],
        },
      }),
    },
    {
      id: 'preset-quad-4',
      name: 'Quad Grid',
      panesCount: 4,
      subtitle: '4 Panes (2x2)',
      icon: 'quad-4',
      buildTree: (ids) => ({
        root: {
          kind: 'split',
          id: makeSplitId(),
          direction: 'row',
          children: [
            {
              kind: 'split',
              id: makeSplitId(),
              direction: 'col',
              children: [{ kind: 'pane', id: ids[0] }, { kind: 'pane', id: ids[1] }],
              sizes: [0.5, 0.5],
            },
            {
              kind: 'split',
              id: makeSplitId(),
              direction: 'col',
              children: [{ kind: 'pane', id: ids[2] }, { kind: 'pane', id: ids[3] }],
              sizes: [0.5, 0.5],
            },
          ],
          sizes: [0.5, 0.5],
        },
      }),
    },
  ];
}

function resolveSessionsForCount(count) {
  const currentActive = currentMainSessionId() || (state.panes[0]?.sessionId);
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
      if (!app || !app.sessions) return new Set();
      const snap = app.sessions.list.getSnapshot();
      return new Set(snap.order || Object.keys(snap.byId || {}));
    } catch (_) {
      return new Set();
    }
  })();

  const fallbackPool = [...allKnownIds];
  let fallbackIdx = 0;

  function remapNode(node) {
    if (!node) return null;
    if (node.kind === 'pane') {
      let targetId = node.id;
      if (!allKnownIds.has(targetId)) {
        while (fallbackIdx < fallbackPool.length && fallbackPool[fallbackIdx] === targetId) {
          fallbackIdx++;
        }
        if (fallbackIdx < fallbackPool.length) {
          targetId = fallbackPool[fallbackIdx++];
        }
      }
      return { kind: 'pane', id: targetId };
    }
    return {
      kind: 'split',
      id: makeSplitId(),
      direction: node.direction,
      sizes: [...(node.sizes || [0.5, 0.5])],
      children: (node.children || []).map(remapNode),
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
    if (typeof localStorage === 'undefined') return;
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
          if (checkAndRestore() && typeof unsub === 'function') {
            try { unsub(); } catch (_) {}
          }
        });
      }
    }
  } catch (_) {}
}

function adeIcon(type, size) {
  const px = size || 12;
  const style = { flex: '0 0 auto', width: px, height: px };
  const stroke = { stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (type) {
    case 'chevron-right':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('path', { d: 'M5 2.5 9.5 7l-4.5 4.5', ...stroke })
      );
    case 'chevron-left':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('path', { d: 'M9 2.5 4.5 7l4.5 4.5', ...stroke })
      );
    case 'chevron-down':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('path', { d: 'M2.5 5 7 9.5 11.5 5', ...stroke })
      );
    case 'close':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('path', { d: 'M3 3l8 8M11 3l-8 8', ...stroke })
      );
    case 'plus':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('path', { d: 'M7 3v8M3 7h8', ...stroke })
      );
    case 'zap':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'currentColor', style },
        React.createElement('path', { d: 'M8 1.5 3 8h3.2l-.8 4.5L11 6H7.8L8 1.5Z' })
      );
    case 'diamond':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('path', { d: 'M7 2.5l4.5 5L7 11.5 2.5 7.5 7 2.5Z', ...stroke })
      );
    case 'check':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('path', { d: 'M3 7.5l2.5 2.5L11 4.5', ...stroke })
      );
    case 'popout':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('path', { d: 'M5.5 3.5h-2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2', ...stroke }),
        React.createElement('path', { d: 'M9 3.5h1.5v1.5', ...stroke }),
        React.createElement('path', { d: 'M10.5 3.5 6.5 7.5', ...stroke })
      );
    case 'stack':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('path', { d: 'M2.5 4.5h9M2.5 7h9M2.5 9.5h9', ...stroke }),
        React.createElement('rect', { x: 2.5, y: 2.5, width: 9, height: 9, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.3, fill: 'none' })
      );
    case 'split-rows':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('rect', { x: 1.5, y: 1, width: 11, height: 5.2, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 }),
        React.createElement('rect', { x: 1.5, y: 7.8, width: 11, height: 5.2, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 })
      );
    case 'split-cols':
      return React.createElement(
        'svg', { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('rect', { x: 1, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 }),
        React.createElement('rect', { x: 7.8, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 })
      );
    case 'trajectory':
      return React.createElement(
        'svg',
        { width: px, height: px, viewBox: '0 0 14 14', fill: 'none', style },
        React.createElement('circle', { cx: 3, cy: 11, r: 1.5, fill: 'currentColor' }),
        React.createElement('circle', { cx: 7, cy: 6.5, r: 1.2, fill: 'currentColor' }),
        React.createElement('circle', { cx: 11, cy: 3, r: 1.5, fill: 'currentColor' }),
        React.createElement('path', { d: 'M3 11 C 3 6.5, 5 6.5, 7 6.5 S 11 6.5, 11 3', ...stroke })
      );
    default:
      return null;
  }
}

function renderLayoutIcon(type) {
  switch (type) {
    case 'col-2':
      return React.createElement(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 14 14', fill: 'none', style: { flex: '0 0 auto' } },
        React.createElement('rect', { x: 1, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 }),
        React.createElement('rect', { x: 7.8, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 })
      );
    case 'row-2':
      return React.createElement(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 14 14', fill: 'none', style: { flex: '0 0 auto' } },
        React.createElement('rect', { x: 1.5, y: 1, width: 11, height: 5.2, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 }),
        React.createElement('rect', { x: 1.5, y: 7.8, width: 11, height: 5.2, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 })
      );
    case 'master-stack-3':
      return React.createElement(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 14 14', fill: 'none', style: { flex: '0 0 auto' } },
        React.createElement('rect', { x: 1, y: 1.5, width: 6.2, height: 11, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 }),
        React.createElement('rect', { x: 8.5, y: 1.5, width: 4.5, height: 5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 }),
        React.createElement('rect', { x: 8.5, y: 7.5, width: 4.5, height: 5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 })
      );
    case 'quad-4':
      return React.createElement(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 14 14', fill: 'none', style: { flex: '0 0 auto' } },
        React.createElement('rect', { x: 1, y: 1.5, width: 5.2, height: 5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 }),
        React.createElement('rect', { x: 7.8, y: 1.5, width: 5.2, height: 5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 }),
        React.createElement('rect', { x: 1, y: 7.5, width: 5.2, height: 5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 }),
        React.createElement('rect', { x: 7.8, y: 7.5, width: 5.2, height: 5, rx: 1.2, stroke: 'currentColor', strokeWidth: 1.2, fill: 'currentColor', fillOpacity: 0.18 })
      );
    default:
      return React.createElement(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 14 14', fill: 'none', style: { flex: '0 0 auto' } },
        React.createElement('rect', { x: 1, y: 1, width: 12, height: 12, rx: 2, stroke: 'currentColor', strokeWidth: 1.2, strokeDasharray: '2 1.5' }),
        React.createElement('path', { d: 'M7 3v8M3 7h8', stroke: 'currentColor', strokeWidth: 1, opacity: 0.6 })
      );
  }
}

function isPresetActive(preset, snap) {
  if (!snap.panes || snap.panes.length !== preset.panesCount) return false;
  if (!snap.tree || !snap.tree.root) return false;
  if (preset.id === 'preset-col-2') {
    return snap.tree.root.kind === 'split' && snap.tree.root.direction === 'row';
  }
  if (preset.id === 'preset-row-2') {
    return snap.tree.root.kind === 'split' && snap.tree.root.direction === 'col';
  }
  return false;
}

function isCustomActive(layout, snap) {
  if (!layout || !layout.panes || !snap.panes) return false;
  if (layout.panes.length !== snap.panes.length) return false;
  const currentIds = snap.panes.map((p) => p.sessionId).join(',');
  const savedIds = layout.panes.map((p) => p.sessionId).join(',');
  return currentIds === savedIds;
}

function ADELayoutsSection(props) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [isNaming, setIsNaming] = React.useState(false);
  const [nameInput, setNameInput] = React.useState('');
  const inputRef = React.useRef(null);

  const snap = useSyncExternalStore(subscribe, getState);
  const layoutSnap = useSyncExternalStore(subscribeLayouts, getLayoutsSnapshot);
  const subagentSnap = useSyncExternalStore(subscribeSubagent, getSubagentSnapshot);
  const { customLayouts } = layoutSnap;
  const presets = getPresetLayouts();
  const panes = snap.panes || [];
  const canSave = panes.length >= 1;
  const autosplit = subagentSnap ? !!subagentSnap.autosplit : true;

  React.useEffect(() => {
    if (isNaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isNaming]);

  const handleStartSave = (e) => {
    e.stopPropagation();
    if (!canSave) return;
    const defaultName = panes.length >= 2 ? `Split (${panes.length} panes)` : 'Layout';
    setNameInput(defaultName);
    setIsNaming(true);
    if (collapsed) setCollapsed(false);
  };

  const handleConfirmSave = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const treeToSave = ensureTree(snap.tree, panes);
    if (!treeToSave) return;
    const trimmed = (nameInput || '').trim() || (panes.length >= 2 ? `Split (${panes.length} panes)` : 'Layout');
    saveCustomLayout(trimmed, treeToSave, panes);
    setIsNaming(false);
    setNameInput('');
  };

  const handleCancelSave = (e) => {
    if (e) e.stopPropagation();
    setIsNaming(false);
    setNameInput('');
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

  return React.createElement(
    'div',
    { 'data-ade-sidebar-layouts': '' },
    React.createElement(
      'div',
      {
        style: {
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          padding: '0 4px',
          borderRadius: 'var(--dsw-radius-sm, 4px)',
          userSelect: 'none',
        },
        onClick: () => setCollapsed(!collapsed),
      },
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.42))',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          },
        },
        React.createElement(
  'span',
  { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12 } },
  adeIcon(collapsed ? 'chevron-right' : 'chevron-down', 10)
),
        React.createElement('span', null, 'LAYOUTS'),
        React.createElement(
          'span',
          {
            style: {
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.08)',
              color: 'var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.5))',
            },
          },
          String(customLayouts.length)
        )
      ),
      canSave
        ? React.createElement(
            'button',
            {
              type: 'button',
              title: isNaming ? 'Cancel naming' : 'Save current split as a named layout',
              onClick: isNaming ? handleCancelSave : handleStartSave,
              style: {
                background: isNaming ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                border: 'none',
                color: 'var(--dsw-alias-label-secondary, rgba(255, 255, 255, 0.65))',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 'var(--dsw-radius-sm, 4px)',
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
              },
            },
            React.createElement(
              'span',
              { style: { display: 'inline-flex', alignItems: 'center' } },
              adeIcon(isNaming ? 'close' : 'plus', 11)
            ),
            React.createElement('span', null, isNaming ? 'Cancel' : 'Save')
          )
        : null
    ),
    !collapsed
      ? React.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 } },
          isNaming
            ? React.createElement(
                'form',
                {
                  'data-ade-save-form': '',
                  onSubmit: handleConfirmSave,
                  onClick: (e) => e.stopPropagation(),
                },
                React.createElement('input', {
                  ref: inputRef,
                  'data-ade-save-input': '',
                  type: 'text',
                  value: nameInput,
                  placeholder: 'Layout name...',
                  onChange: (e) => setNameInput(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === 'Escape') handleCancelSave(e);
                  },
                }),
                React.createElement(
                  'button',
                  {
                    type: 'submit',
                    'data-ade-save-confirm': '',
                    title: 'Save layout',
                  },
                  'Save'
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    'data-ade-save-cancel': '',
                    title: 'Cancel',
                    onClick: handleCancelSave,
                  },
                  adeIcon('close', 11)
                )
              )
            : null,
          React.createElement(
            'div',
            { 'data-ade-preset-strip': '', title: 'Quick split presets' },
            presets.map((preset) => {
              const isActive = isPresetActive(preset, snap);
              return React.createElement(
                'button',
                {
                  key: preset.id,
                  type: 'button',
                  'data-ade-preset-btn': '',
                  'data-active': isActive ? 'true' : void 0,
                  onClick: () => handleApplyPreset(preset),
                  title: `${preset.name} (${preset.subtitle})`,
                },
                renderLayoutIcon(preset.icon)
              );
            })
          ),
          React.createElement(
            'div',
            {
              'data-ade-autosplit-row': '',
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 6px',
                margin: '2px 0 4px 0',
                borderRadius: 'var(--dsw-radius-sm, 4px)',
                fontSize: 11,
                color: 'var(--dsw-alias-label-secondary, rgba(255, 255, 255, 0.65))',
                cursor: 'default',
                userSelect: 'none',
              },
            },
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', color: autosplit ? '#38bdf8' : 'var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.4))' } }, adeIcon('zap', 11)),
              React.createElement('span', { style: { fontWeight: 500 } }, 'Auto-split Subagents')
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                title: autosplit ? 'Subagents automatically open in a stacked right pane' : 'Subagents do not auto-split',
                onClick: (e) => {
                  e.stopPropagation();
                  setSubagentAutosplitSetting(!autosplit);
                },
                style: {
                  background: autosplit ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                  border: `1px solid ${autosplit ? 'rgba(56, 189, 248, 0.38)' : 'rgba(255, 255, 255, 0.12)'}`,
                  color: autosplit ? '#38bdf8' : 'var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.45))',
                  fontSize: 9.5,
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: 999,
                  cursor: 'pointer',
                  letterSpacing: '0.04em',
                },
              },
              autosplit ? 'ON' : 'OFF'
            )
          ),
          customLayouts.length > 0
            ? customLayouts.map((layout) => {
                const isActive = isCustomActive(layout, snap);
                const paneCount = (layout.panes && layout.panes.length) || 0;
                return React.createElement(
                  'div',
                  {
                    key: layout.id,
                    'data-ade-layout-row': '',
                    'data-active': isActive ? 'true' : void 0,
                    onClick: () => handleApplyCustom(layout),
                    title: `${layout.name} (Saved layout with ${paneCount} panes)`,
                  },
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' } },
                    renderLayoutIcon('custom'),
                    React.createElement(
                      'span',
                      {
                        style: {
                          fontSize: 12,
                          fontWeight: isActive ? 600 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                      },
                      layout.name
                    )
                  ),
                  React.createElement(
                    'div',
                    { style: { display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' } },
                    React.createElement(
                      'span',
                      {
                        style: {
                          fontSize: 10,
                          fontWeight: 600,
                          color: isActive ? '#38bdf8' : 'var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.4))',
                          padding: '1px 4px',
                          borderRadius: 3,
                          background: isActive ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        },
                      },
                      `${paneCount}P`
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'ade-delete-btn',
                        title: 'Delete this saved layout',
                        onClick: (e) => handleDeleteCustom(e, layout.id),
                        style: {
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.4))',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: 3,
                          fontSize: 11,
                          lineHeight: 1,
                        },
                      },
                      adeIcon('close', 11)
                    )
                  )
                );
              })
            : React.createElement(
                'div',
                {
                  style: {
                    padding: '6px 8px',
                    fontSize: 11,
                    color: 'var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.4))',
                    fontStyle: 'italic',
                  },
                },
                'No saved layouts yet. Click + Save to save current split.'
              )
        )
      : null
  );
}

function ADESidebarWrapper(props) {
  const orig = originalSidebarWorkspaces;
  return React.createElement(
    'div',
    { 'data-ade-sidebar-root': '' },
    props.wide !== false ? React.createElement(ADELayoutsSection, { wide: props.wide }) : null,
    orig ? React.createElement(orig, props) : null
  );
}

function ADEPaneTelemetryReader(props) {
  const { sessionId, useSessionStatus } = props;
  const status = useSessionStatus(
    (snapshot) => (snapshot && typeof snapshot.get === 'function' ? snapshot.get(sessionId) : undefined)
  );

  const isRunning = !!status?.running;
  const isPending = !!status?.pendingInteraction;
  const isUnread = !!status?.completionUnread;

  const [elapsed, setElapsed] = React.useState(0);
  const startRef = React.useRef(0);

  React.useEffect(() => {
    if (isRunning) {
      if (!startRef.current) startRef.current = Date.now();
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    } else {
      startRef.current = 0;
      setElapsed(0);
    }
  }, [isRunning]);

  if (isRunning) {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    return React.createElement(
      'div',
      {
        'data-ade-telemetry': 'running',
        title: `Agent is active (${mm}:${ss})`,
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 7px',
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 700,
          color: '#fef08a',
          background: 'rgba(245, 158, 11, 0.14)',
          border: '1px solid rgba(245, 158, 11, 0.45)',
          boxShadow: '0 0 8px rgba(245, 158, 11, 0.2)',
          flex: '0 0 auto',
          userSelect: 'none',
        },
      },
      React.createElement('span', {
        style: {
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#fbbf24',
          boxShadow: '0 0 6px #f59e0b',
          animation: 'ade-pulse 1.2s ease-in-out infinite',
        },
      }),
      React.createElement('span', { style: { letterSpacing: '0.03em' } }, 'RUNNING'),
      React.createElement(
        'span',
        {
          style: {
            fontFamily: 'ui-monospace, monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 10,
            opacity: 0.9,
            marginLeft: 2,
          },
        },
        `${mm}:${ss}`
      )
    );
  }

  if (isPending) {
    return React.createElement(
      'div',
      {
        'data-ade-telemetry': 'pending',
        title: 'Action or permission required',
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 7px',
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 700,
          color: '#fed7aa',
          background: 'rgba(234, 88, 12, 0.16)',
          border: '1px solid rgba(234, 88, 12, 0.5)',
          boxShadow: '0 0 8px rgba(234, 88, 12, 0.25)',
          flex: '0 0 auto',
          userSelect: 'none',
          animation: 'ade-pulse 2s ease-in-out infinite',
        },
      },
      React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center' } }, adeIcon('diamond', 10)),
      React.createElement('span', { style: { letterSpacing: '0.03em' } }, 'ATTENTION')
    );
  }

  if (isUnread) {
    return React.createElement(
      'div',
      {
        'data-ade-telemetry': 'unread',
        title: 'Turn completed — unread response',
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 7px',
          borderRadius: 999,
          fontSize: 10.5,
          fontWeight: 700,
          color: '#86efac',
          background: 'rgba(34, 197, 94, 0.14)',
          border: '1px solid rgba(34, 197, 94, 0.45)',
          boxShadow: '0 0 8px rgba(34, 197, 94, 0.2)',
          flex: '0 0 auto',
          userSelect: 'none',
        },
      },
      React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center' } }, adeIcon('check', 11)),
      React.createElement('span', { style: { letterSpacing: '0.03em' } }, 'READY')
    );
  }

  return null;
}

function ADEPaneTelemetry(props) {
  if (typeof props.useSessionStatus !== 'function') return null;
  return React.createElement(ADEPaneTelemetryReader, props);
}

function useSubagentChildStatus(sessionId, useSessionStatus) {
  if (typeof useSessionStatus !== 'function') return { running: false, pending: false };
  return useSessionStatus(
    (snapshot) => (snapshot && typeof snapshot.get === 'function' ? snapshot.get(sessionId) : undefined)
  );
}

function ADESubagentChip(props) {
  const { child, active, onSelect, onPopOut, useSessionStatus } = props;
  const status = useSubagentChildStatus(child.id, useSessionStatus);
  const running = !!(status && status.running);
  const pending = !!(status && status.pendingInteraction);
  const dotColor = running ? '#34d399' : pending ? '#f59e0b' : 'rgba(255, 255, 255, 0.38)';
  const glowColor = running ? 'rgba(52, 211, 153, 0.5)' : pending ? 'rgba(245, 158, 11, 0.5)' : 'transparent';
  const chipRef = React.useRef(null);

  React.useEffect(() => {
    if (active && chipRef.current) {
      chipRef.current.scrollIntoView({ inline: 'nearest', block: 'nearest' });
    }
  }, [active]);

  return React.createElement(
    'button',
    {
      key: child.id,
      ref: chipRef,
      type: 'button',
      'data-ade-subagent-tab': active ? 'active' : '',
      'data-status': running ? 'running' : pending ? 'pending' : 'idle',
      title: child.label || child.id,
      draggable: false,
      onClick: () => onSelect(child.id),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 24,
        padding: '0 6px',
        borderRadius: 6,
        background: active ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.04)',
        border: `1px solid ${active ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
        color: active ? '#e0f2fe' : 'var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.7))',
        fontSize: 11.5,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        flex: '0 0 auto',
        transition: 'background 150ms ease, border-color 150ms ease, color 150ms ease',
        whiteSpace: 'nowrap',
        maxWidth: 160,
        boxShadow: active ? 'none' : void 0,
      },
    },
    React.createElement('span', {
      className: 'ade-swarm-dot',
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: dotColor,
        boxShadow: `0 0 6px ${glowColor}`,
        flex: '0 0 auto',
      },
    }),
    React.createElement('span', {
      style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
    }, child.label || child.id),
    React.createElement(ADESubagentKidActions, {
      childId: child.id,
      active,
      onPopOut,
    })
  );
}

function ADESubagentKidActions(props) {
  const { childId, active, onPopOut } = props;
  return React.createElement(
    'span',
    { style: { display: 'inline-flex', gap: 4, marginLeft: 2 } },
    active
      ? React.createElement('button', {
          type: 'button',
          title: 'Pop this subagent into its own pane',
          style: {
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            padding: '0 2px',
            borderRadius: 3,
          },
          'data-ade-popout': '',
          onClick: (e) => { e.stopPropagation(); onPopOut(childId); },
        }, adeIcon('popout', 10))
      : null
  );
}

function ADESubagentDeck(props) {
  const { parentId, paneSessionId, useSessionStatus } = props;
  const snap = useSyncExternalStore(subscribeSubagent, getSubagentSnapshot);
  const sessionSnapshot = readSessionsSnapshot();
  const children = childEntriesForParent(sessionSnapshot, parentId);
  const pinned = snap.pinned && snap.pinned instanceof Map ? snap.pinned : PINNED_STACK_BY_PARENT;

  const statusSnap = useSessionStatus
    ? useSessionStatus((s) => s)
    : null;
  const runningCount = children.reduce((acc, child) => {
    const st = statusSnap && typeof statusSnap.get === 'function' ? statusSnap.get(child.id) : undefined;
    return acc + (st && st.running ? 1 : 0);
  }, 0);
  void pinned;

  const onSelect = (childId) => {
    PINNED_STACK_BY_PARENT.set(parentId, childId);
    emitSubagentSnapshot();
    if (!childId || childId === paneSessionId) return;
    swapSubagentInPane(paneSessionId, childId);
  };

  const onPopOut = (childId) => popOutSubagent(paneSessionId, childId);
  const onDismiss = () => {
    PINNED_STACK_BY_PARENT.delete(parentId);
    emitSubagentSnapshot();
    const paneToClose = (state.panes || []).find((p) => p.sessionId === paneSessionId);
    if (paneToClose) closeSwarmPane(paneSessionId);
  };

  const trackRef = React.useRef(null);
  const [deckScroll, setDeckScroll] = React.useState({ left: false, right: false });

  const updateDeckScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setDeckScroll({
      left: el.scrollLeft > 1,
      right: max > 0 && el.scrollLeft < max - 1,
    });
  };

  React.useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (!delta) return;
      const max = el.scrollWidth - el.clientWidth;
      if ((delta < 0 && el.scrollLeft <= 0) || (delta > 0 && el.scrollLeft >= max)) return;
      e.preventDefault();
      el.scrollLeft += delta;
      updateDeckScroll();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('scroll', updateDeckScroll, { passive: true });
    updateDeckScroll();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateDeckScroll) : null;
    if (ro) ro.observe(el);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('scroll', updateDeckScroll);
      if (ro) ro.disconnect();
    };
  }, [children.length]);

  const nudgeDeck = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 140, behavior: 'smooth' });
  };

  const handleDeckWheel = (e) => {
    const el = e.currentTarget;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
    if (!delta) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = el.scrollLeft + delta;
    const canScroll = next > 0 && next < max;
    el.scrollLeft = Math.max(0, Math.min(next, max));
    if (canScroll) e.preventDefault();
  };

  return React.createElement(
    'div',
    {
      'data-ade-subagent-deck': '',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 8px 8px',
        background: 'rgba(10, 10, 14, 0.35)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        flex: '0 0 auto',
        minHeight: 41,
        boxSizing: 'border-box',
      },
    },
    React.createElement(
      'div',
      {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 22,
          padding: '0 7px',
          borderRadius: 999,
          background: runningCount > 0 ? 'rgba(52, 211, 153, 0.14)' : 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          flex: '0 0 auto',
        },
      },
      children.length > 0
        ? React.createElement('span', {
            style: {
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: runningCount > 0 ? '#a7f3d0' : 'var(--dsw-alias-label-tertiary, rgba(255,255,255,0.55))',
            },
          }, 'SWARM')
        : null,
      React.createElement('span', {
        style: {
          fontSize: 10.5,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--dsw-alias-label-secondary, rgba(255,255,255,0.8))',
        },
      }, String(children.length))
    ),
    React.createElement(
      'div',
      {
        'data-ade-subagent-deck-track': '',
        ref: trackRef,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto',
          overflowY: 'hidden',
          flex: '1 1 auto',
          minWidth: 0,
          paddingBottom: 4,
          scrollSnapType: 'x proximity',
        },
      },
      children.map((child) =>
        React.createElement(ADESubagentChip, {
          key: child.id,
          child,
          active: child.id === paneSessionId,
          useSessionStatus,
          onSelect,
          onPopOut,
        })
      )
    ),
    deckScroll.left
      ? React.createElement(
          'button',
          {
            type: 'button',
            title: 'Scroll subagent tabs left',
            draggable: false,
            onClick: () => nudgeDeck(-1),
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              padding: 0,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.75)',
              cursor: 'pointer',
              flex: '0 0 auto',
              order: 0,
            },
          },
          adeIcon('chevron-left', 11)
        )
      : null,
    deckScroll.right
      ? React.createElement(
          'button',
          {
            type: 'button',
            title: 'Scroll subagent tabs right',
            draggable: false,
            onClick: () => nudgeDeck(1),
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              padding: 0,
              borderRadius: 999,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.75)',
              cursor: 'pointer',
              flex: '0 0 auto',
              order: 2,
            },
          },
          adeIcon('chevron-right', 11)
        )
      : null,
    React.createElement(
      'span',
      { style: { display: 'inline-flex', alignItems: 'center', gap: 4, flex: '0 0 auto', order: 3 } },
      React.createElement('button', {
        type: 'button',
        title: 'Dismiss this subagent stack',
        style: {
          background: 'transparent',
          border: 'none',
          color: 'rgba(255, 255, 255, 0.55)',
          cursor: 'pointer',
          fontSize: 15,
          lineHeight: 1,
          padding: '2px 4px',
          borderRadius: 4,
        },
        'data-ade-dismiss-deck': '',
        onClick: onDismiss,
      }, adeIcon('close', 11))
    )
  );
}

function ADESubagentParentBadge(props) {
  const { parentId, onClick } = props;
  const sessionSnapshot = readSessionsSnapshot();
  const children = childEntriesForParent(sessionSnapshot, parentId);
  if (!children.length) return null;
  return React.createElement(
    'button',
    {
      type: 'button',
      'data-ade-subagent-badge': '',
      title: `${children.length} subagent${children.length === 1 ? '' : 's'}. Click to open the swarm stack.`,
      draggable: false,
      onClick,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 20,
        padding: '0 7px',
        marginLeft: 2,
        borderRadius: 999,
        background: 'rgba(56, 189, 248, 0.14)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        color: '#bae6fd',
        fontSize: 10.5,
        fontWeight: 700,
        cursor: 'pointer',
        flex: '0 0 auto',
        fontVariantNumeric: 'tabular-nums',
      },
    },
    adeIcon('stack', 12),
    String(children.length)
  );
}

function ADESplitRoot(props) {
  const renderSlot = typeof props.renderSlot === 'function' ? props.renderSlot : cachedRenderSlot;
  const SessionProvider = typeof props.SessionProvider === 'function' ? props.SessionProvider : cachedSessionProvider;
  if (props.useSessionStatus) cachedUseSessionStatus = props.useSessionStatus;
  const useSessionStatus = props.useSessionStatus || cachedUseSessionStatus;

  const snap = useSyncExternalStore(subscribe, getState);
  const panes = snap.panes;
  const rawTree = snap.tree;
  const tree = React.useMemo(() => ensureTree(rawTree, panes), [rawTree, panes]);
  const geometry = React.useMemo(() => computeTreeGeometry(tree ? tree.root : null), [tree]);

  const [draggingDividerId, setDraggingDividerId] = React.useState(null);
  const containerRef = React.useRef(null);

  const totalPanes = panes.length;
  const [mountedCount, setMountedCount] = React.useState(() => (totalPanes > 0 ? 1 : 0));
  const mountedRef = React.useRef(mountedCount);
  mountedRef.current = mountedCount;

  React.useEffect(() => {
    if (totalPanes <= 0) return undefined;
    if (mountedRef.current >= totalPanes) return undefined;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      mountedRef.current = Math.min(mountedRef.current + 1, totalPanes);
      if (typeof React.startTransition === 'function') {
        React.startTransition(() => setMountedCount(mountedRef.current));
      } else {
        setMountedCount(mountedRef.current);
      }
      if (mountedRef.current < totalPanes) setTimeout(step, 90);
    };
    const first = setTimeout(step, 24);
    return () => { cancelled = true; clearTimeout(first); };
  }, [totalPanes]);

  const [metaTick, setMetaTick] = React.useState(0);
  React.useEffect(() => {
    const unsubSessions = app?.sessions?.list?.subscribe?.(() => setMetaTick((t) => t + 1));
    const unsubWs = (app?.workspaces || app?.uiWorkspace?.workspaces)?.list?.subscribe?.(() => setMetaTick((t) => t + 1));
    return () => {
      unsubSessions?.();
      unsubWs?.();
    };
  }, []);

  React.useEffect(() => {
    if (typeof props.renderSlot === 'function') cachedRenderSlot = props.renderSlot;
    if (typeof props.SessionProvider === 'function') cachedSessionProvider = props.SessionProvider;
    if (typeof props.useSessionStatus === 'function') cachedUseSessionStatus = props.useSessionStatus;
  }, [props.renderSlot, props.SessionProvider, props.useSessionStatus]);

  if (panes.length === 0) {
    if (originalConversationPanel) {
      return React.createElement(originalConversationPanel, props);
    }
    return renderSlot ? renderSlot('main.conversation', {}) : null;
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
    const isRow = div.direction === 'row';
    const startCoord = isRow ? e.clientX : e.clientY;
    const parentPx = isRow
      ? Math.max(1, (containerRect.width * div.parentBox.width) / 100)
      : Math.max(1, (containerRect.height * div.parentBox.height) / 100);
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
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDraggingDividerId(null);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return React.createElement(
    'div',
    {
      ref: containerRef,
      style: {
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
      },
      'data-ade-split': '',
    },
    panes.map((pane, idx) => {
      const rect = geometry.panes[pane.sessionId] || { left: 0, top: 0, width: 100, height: 100 };
      const splitDirection = getImmediateSplitDirection(tree ? tree.root : null, pane.sessionId) || 'row';
      return React.createElement(ADESplitPaneItem, {
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
        useSessionStatus,
      });
    }),
    geometry.dividers.map((div) => {
      const isRow = div.direction === 'row';
      return React.createElement('div', {
        key: div.id,
        'data-ade-divider': '',
        'data-ade-dir': div.direction,
        'data-ade-dragging': draggingDividerId === div.id ? 'true' : void 0,
        style: {
          position: 'absolute',
          left: isRow ? `calc(${div.left}% - 4px)` : `${div.left}%`,
          top: isRow ? `${div.top}%` : `calc(${div.top}% - 4px)`,
          width: isRow ? '8px' : `${div.width}%`,
          height: isRow ? `${div.height}%` : '8px',
          cursor: isRow ? 'col-resize' : 'row-resize',
          zIndex: 10,
        },
        onPointerDown: onDividerDown(div),
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
    togglePaneSplit,
    renderSlot,
    SessionProvider,
    mountedCount,
    useSessionStatus,
  } = props;
  const ref = ensureReference(pane.sessionId);
  const accent = accentFor(pane.sessionId);
  const title = sessionTitle(pane.sessionId);
  const ws = workspaceOf(pane.sessionId);
  const mounted = idx === 0 || idx < mountedCount;
  const swarmSnapshot = useSyncExternalStore(subscribeSubagent, getSubagentSnapshot);
  void swarmSnapshot;
  const sessionsSnapshot = readSessionsSnapshot();
  const paneParentId = subagentParentOf(sessionsSnapshot, pane.sessionId);
  const stackChildren = paneParentId ? childEntriesForParent(sessionsSnapshot, paneParentId) : [];
  const parentChildren = !paneParentId ? childEntriesForParent(sessionsSnapshot, pane.sessionId) : [];

  const isImmediatelyOpen = (() => {
    if (idx === 0) return true;
    try {
      return !!(ref && ref.binding && ref.binding.session && ref.binding.session.openState === 'open');
    } catch (_) {
      return false;
    }
  })();

  const [isOpen, setIsOpen] = React.useState(isImmediatelyOpen);

  const paneElRef = React.useRef(null);
  const [viewState, setViewState] = React.useState({ hasMultiple: false, isTrajectory: false });

  const inspectTabs = React.useCallback(() => {
    const paneEl = paneElRef.current;
    if (!paneEl) return;
    const tabButtons = Array.from(paneEl.querySelectorAll('[data-conversation-tabs] button[role="tab"], [role="tablist"] button[role="tab"]'));
    const hasMore = !!paneEl.querySelector('[aria-haspopup="menu"]');
    const trajectoryBtn = tabButtons.find((b) => ((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase().includes('trajectory')) || null;
    const chatBtn = tabButtons.find((b) => /^\s*chat\b/i.test((b.textContent || '').trim())) || tabButtons[0] || null;
    const activeBtn = tabButtons.find((b) => b.getAttribute('aria-selected') === 'true') || null;
    const hasMultiple = tabButtons.length > 1 || (tabButtons.length >= 1 && hasMore);
    const isTrajectory = trajectoryBtn
      ? trajectoryBtn.getAttribute('aria-selected') === 'true'
      : activeBtn && activeBtn !== chatBtn;
    const next = { hasMultiple, isTrajectory: !!isTrajectory };
    setViewState((prev) => (prev.hasMultiple === next.hasMultiple && prev.isTrajectory === next.isTrajectory ? prev : next));
  }, [pane.sessionId]);

  React.useEffect(() => {
    inspectTabs();
    const paneEl = paneElRef.current;
    if (!paneEl || typeof MutationObserver === 'undefined') return undefined;
    const observer = new MutationObserver(() => inspectTabs());
    observer.observe(paneEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-selected', 'class'],
    });
    return () => observer.disconnect();
  }, [inspectTabs]);

  const handleToggleTrajectory = () => {
    const paneEl = paneElRef.current;
    if (!paneEl) return;
    const tabButtons = Array.from(paneEl.querySelectorAll('[data-conversation-tabs] button[role="tab"], [role="tablist"] button[role="tab"]'));
    const trajectoryBtn = tabButtons.find((b) => ((b.textContent || '') + ' ' + (b.getAttribute('aria-label') || '')).toLowerCase().includes('trajectory')) || null;
    const chatBtn = tabButtons.find((b) => /^\s*chat\b/i.test((b.textContent || '').trim())) || tabButtons[0] || null;
    if (trajectoryBtn) {
      if (trajectoryBtn.getAttribute('aria-selected') === 'true') {
        if (chatBtn) chatBtn.click();
      } else {
        trajectoryBtn.click();
      }
      inspectTabs();
      return;
    }
    const moreBtn = paneEl.querySelector('button[aria-haspopup="menu"]');
    if (moreBtn && tabButtons.length >= 1) {
      moreBtn.click();
      setTimeout(() => {
        const items = Array.from(document.querySelectorAll('[role="menu"] a, [role="menu"] button, [role="menuitem"], [role="listbox"] button'));
        const target = items.find((el) => (el.textContent || '').toLowerCase().includes('trajectory')) || items[0];
        if (target) target.click();
      }, 80);
    }
  };

  React.useEffect(() => {
    if (isOpen || !mounted) return undefined;
    let active = true;
    if (ref && ref.ready && typeof ref.ready.then === 'function') {
      ref.ready.then(() => {
        if (!active) return;
        requestAnimationFrame(() => {
          if (!active) return;
          if (typeof React.startTransition === 'function') {
            React.startTransition(() => setIsOpen(true));
          } else {
            setIsOpen(true);
          }
        });
      });
    } else {
      setIsOpen(true);
    }
    return () => { active = false; };
  }, [mounted, isOpen, ref]);

  const shouldRenderContent = mounted && isOpen;
  const pendingPlaceholder = React.createElement(
    'div',
    { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--dsw-alias-fg-l2, rgba(255,255,255,0.45))', font: '13px/1.4 system-ui, sans-serif', background: 'var(--dsw-alias-bg-base, #1e1e24)' } },
    React.createElement('div', { style: { width: 22, height: 22, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.12)', borderTopColor: 'var(--dsw-alias-brand, #4f78ff)', animation: 'ade-spin 700ms linear infinite' } }),
    React.createElement('span', null, 'Loading ' + title + '...')
  );

  const onHeaderDragStart = (e) => {
    reorderDragFromSessionId = pane.sessionId;
    debugLog('header.dragstart', { source: pane.sessionId, x: e.clientX, y: e.clientY });
    if (e.dataTransfer) {
      try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
      try { e.dataTransfer.setData(REORDER_MIME, pane.sessionId); } catch (_) {}
      try { e.dataTransfer.setData('text/plain', pane.sessionId); } catch (_) {}
    }
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-ade-pane][data-ade-session-id="${pane.sessionId}"]`);
      if (el) el.setAttribute('data-ade-dragging-source', 'true');
    });
  };

  const onHeaderDragEnd = () => {
    reorderDragFromSessionId = null;
    hideOverlay();
    const el = document.querySelector(`[data-ade-pane][data-ade-dragging-source="true"]`);
    if (el) el.removeAttribute('data-ade-dragging-source');
  };

  return React.createElement(
    'div',
    {
      ref: paneElRef,
      'data-ade-pane': '',
      'data-ade-session-id': pane.sessionId,
      'data-ade-slot': String(idx),
      'data-ade-hypr-anim': 'true',
      onAnimationEnd: (e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.removeAttribute('data-ade-hypr-anim');
        }
      },
      style: {
        position: 'absolute',
        left: `calc(${rect.left}% + 3px)`,
        top: `calc(${rect.top}% + 3px)`,
        width: `calc(${rect.width}% - 6px)`,
        height: `calc(${rect.height}% - 6px)`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        borderRadius: '10px',
        border: `1px solid ${accent.border}`,
        borderTop: `2px solid ${accent.dot}`,
        background: 'rgba(10, 10, 14, 0.28)',
        '--dsw-alias-bg-base': 'transparent',
        '--dsw-specific-sidebar-fill': 'transparent',
        boxShadow: `0 4px 16px rgba(0,0,0,0.22), 0 0 10px ${accent.glow.replace('0.45', '0.12')}`,
        pointerEvents: isDraggingDivider ? 'none' : 'auto',
        transition: isDraggingDivider
          ? 'none'
          : 'left 280ms cubic-bezier(0.22, 1, 0.36, 1), top 280ms cubic-bezier(0.22, 1, 0.36, 1), width 280ms cubic-bezier(0.22, 1, 0.36, 1), height 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        willChange: 'auto',
      },
    },
    React.createElement(
      'div',
      {
        style: paneHeaderStyle,
        'data-ade-header': '',
        draggable: true,
        onDragStart: onHeaderDragStart,
        onDragEnd: onHeaderDragEnd,
        onDragOver: (e) => e.preventDefault(),
      },
      React.createElement('span', {
        draggable: false,
        'data-ade-panedot': '',
        style: {
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: accent.dot,
          boxShadow: `0 0 6px ${accent.glow}`,
          flex: '0 0 auto',
          pointerEvents: 'none',
        },
      }),
      ws?.title
        ? React.createElement(
            'span',
            {
              draggable: false,
              'data-ade-pane-workspace': '',
              title: ws.path || ws.title,
              style: {
                maxWidth: 140,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '2px 7px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.02em',
                color: accent.badgeFg,
                background: accent.badgeBg,
                border: `1px solid ${accent.badgeBorder}`,
                flex: '0 0 auto',
                pointerEvents: 'none',
              },
            },
            ws.title
          )
        : null,
      React.createElement('span', { style: paneTitleStyle, draggable: false }, title),
      React.createElement(ADEPaneTelemetry, {
        sessionId: pane.sessionId,
        useSessionStatus,
      }),
      parentChildren.length > 0
        ? React.createElement(ADESubagentParentBadge, {
            parentId: pane.sessionId,
            onClick: () => openSubagentStack(pane.sessionId),
          })
        : null,
      viewState.hasMultiple
        ? React.createElement('button', {
            type: 'button',
            style: {
              ...closeButtonStyle,
              color: viewState.isTrajectory
                ? 'var(--dsw-alias-brand, #4f78ff)'
                : 'var(--dsw-alias-fg-l3, rgba(255,255,255,0.45))',
            },
            'aria-label': viewState.isTrajectory ? 'Switch to chat view' : 'Switch to trajectory view',
            title: viewState.isTrajectory ? 'Show chat' : 'Show trajectory',
            'aria-pressed': viewState.isTrajectory,
            draggable: false,
            onDragStart: (e) => e.preventDefault(),
            onClick: handleToggleTrajectory,
          }, adeIcon('trajectory', 12))
        : null,
      React.createElement('button', {
        type: 'button',
        style: { ...closeButtonStyle, fontWeight: 700 },
        'aria-label': splitDirection === 'col' ? 'Split side by side (horizontal)' : 'Split stacked (vertical)',
        title: splitDirection === 'col' ? 'Switch this split to side-by-side' : 'Switch this split to stacked',
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: () => togglePaneSplit(pane.sessionId),
      }, adeIcon(splitDirection === 'col' ? 'split-cols' : 'split-rows', 12)),
      React.createElement('button', {
        type: 'button',
        style: closeButtonStyle,
        'aria-label': 'Close pane',
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: () => closePane(pane.sessionId),
      }, adeIcon('close', 12))
    ),
    stackChildren.length > 0
      ? React.createElement(ADESubagentDeck, {
          parentId: paneParentId,
          paneSessionId: pane.sessionId,
          useSessionStatus,
        })
      : null,
    React.createElement(
      'div',
      { style: { flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' } },
      React.createElement(
        React.Suspense,
        { fallback: pendingPlaceholder },
        shouldRenderContent
          ? React.createElement(
              PaneErrorBoundary,
              null,
              React.createElement(SessionProvider, { session: ref }, renderSlot('main.conversation', {}))
            )
          : pendingPlaceholder
      )
    )
  );
}

const paneHeaderStyle = {
  height: 32,
  padding: '0 10px',
  background: 'rgba(20, 20, 28, 0.72)',
  backdropFilter: 'blur(12px) saturate(150%)',
  WebkitBackdropFilter: 'blur(12px) saturate(150%)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  userSelect: 'none',
  cursor: 'grab',
  flex: '0 0 auto',
};

const paneTitleStyle = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--dsw-alias-fg-l1, #f4f4f5)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  pointerEvents: 'none',
};

const closeButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--dsw-alias-fg-l3, rgba(255,255,255,0.45))',
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 4,
  fontSize: 14,
  lineHeight: 1,
};

let dropOverlay = null;
function overlay() {
  if (!dropOverlay) {
    dropOverlay = document.createElement('div');
    dropOverlay.id = 'dsh-ade-drag-preview';
    Object.assign(dropOverlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '99999',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px solid rgba(56, 189, 248, 0.9)',
      background: 'rgba(56, 189, 248, 0.12)',
      borderRadius: '10px',
      boxShadow: '0 0 24px rgba(56, 189, 248, 0.35), inset 0 0 16px rgba(56, 189, 248, 0.15)',
      font: '600 13px/1.3 system-ui, sans-serif',
      color: '#e0f2fe',
      textShadow: '0 1px 3px rgba(0,0,0,0.7)',
      opacity: '0',
      transform: 'scale(0.97)',
      transition: 'left 140ms cubic-bezier(0.2, 0.9, 0.3, 1), top 140ms cubic-bezier(0.2, 0.9, 0.3, 1), width 140ms cubic-bezier(0.2, 0.9, 0.3, 1), height 140ms cubic-bezier(0.2, 0.9, 0.3, 1), opacity 120ms ease',
    });
    document.body.appendChild(dropOverlay);
  }
  return dropOverlay;
}
function hideOverlay() {
  if (!dropOverlay) return;
  dropOverlay.style.opacity = '0';
  dropOverlay.style.transform = 'scale(0.97)';
}

export function apply(ctx) {
  pluginCtx = ctx;
  refreshHandles();

  injectMotionStyles();
  ensureConversationWrapped();
  ensureSidebarWrapped();
  ensureAliasRegistered();

  if (pluginCtx && pluginCtx.slots && pluginCtx.slots.subscribe) {
    pluginCtx.slots.subscribe('sidebar.workspaces', ensureSidebarWrapped);
    pluginCtx.slots.subscribe('main', ensureConversationWrapped);
  }

  restorePersistedSplit();

  // Seed known subagent ids from the current snapshot, then react only to NEW
  // children so historical subagents do not fan out on startup.
  const seedKnownSubagentIds = () => {
    const snapshot = readSessionsSnapshot();
    if (!snapshot || !snapshot.byId) return;
    for (const [id, summary] of Object.entries(snapshot.byId)) {
      if (summary && summary.origin === 'subagent') knownSubagentIds.add(id);
    }
    refreshSubagentStacks();
  };
  seedKnownSubagentIds();

  let subagentUnsub = null;
  if (app && app.sessions && app.sessions.list && app.sessions.list.subscribe) {
    subagentUnsub = app.sessions.list.subscribe(() => {
      try {
        reconcileSubagentAutoSplit();
      } catch (err) {
        if (typeof console !== 'undefined') console.error('[ADE] subagent reconcile failed', err);
      }
    });
  }

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
      const row = e.target && typeof e.target.closest === 'function'
        ? e.target.closest('[data-row-key]')
        : null;
      const key = row && row.getAttribute ? row.getAttribute('data-row-key') || '' : '';
      if (!key.startsWith('session:')) return;
      const id = key.slice('session:'.length);
      if (!id) return;
      pendingSessionId = id;
      dropHandled = false;
      debugLog('sidebar.dragstart', { id, x: e.clientX, y: e.clientY });
      if (e.dataTransfer) {
        try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {}
        try { e.dataTransfer.setData('text/plain', id); } catch (_) {}
      }
      e.stopPropagation();
    } catch (_) {}
  };

  const onDragOver = (e) => {
    const isReorder = isReorderDrag(e);
    const dragSessionId = reorderDragFromSessionId || pendingSessionId;
    if (!dragSessionId && !isReorder) return;

    const probe = document.querySelector('[data-ade-split]') ||
      document.querySelector('.mP3x-q_centerCol') ||
      document.querySelector('[data-conversation-content]');
    let newOverCenter = e.clientX > 240;
    let probeRect = null;
    if (probe) {
      const r = probe.getBoundingClientRect();
      probeRect = r;
      newOverCenter = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    overCenter = newOverCenter;
    if (!overCenter) {
      if (currentTargetSessionId !== null) debugLog('dragover.exit', { x: e.clientX, y: e.clientY, probe: probeRect && { left: probeRect.left, top: probeRect.top, right: probeRect.right, bottom: probeRect.bottom } });
      hideOverlay();
      currentTargetSessionId = null;
      currentTargetZone = null;
      return;
    }

    if (pendingSessionId && !isReorder && warmedSessionId !== pendingSessionId) {
      warmedSessionId = pendingSessionId;
      try { ensureReference(pendingSessionId); } catch (_) {}
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      try { e.dataTransfer.dropEffect = 'move'; } catch (_) {}
    }

    const fromPoint = typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(e.clientX, e.clientY)
      : null;
    const paneEl = fromPoint?.closest('[data-ade-pane]') || (
      e.target && typeof e.target.closest === 'function' ? e.target.closest('[data-ade-pane]') : null
    );
    let targetSessionId = null;
    let rect = null;

    if (paneEl) {
      targetSessionId = paneEl.getAttribute('data-ade-session-id');
      rect = paneEl.getBoundingClientRect();
    } else {
      const fallbackTarget = document.querySelector('[data-ade-split]') ||
        document.querySelector('.mP3x-q_centerCol') ||
        document.querySelector('[data-conversation-content]');
      if (fallbackTarget) {
        rect = fallbackTarget.getBoundingClientRect();
        targetSessionId = currentMainSessionId() || (state.panes[0]?.sessionId);
      }
    }

    if (reorderDragFromSessionId && targetSessionId === reorderDragFromSessionId) {
      const selfRes = computeDropZone(rect, e.clientX, e.clientY, true).zone;
      const splitInfo = getImmediateSplitInfo(state.tree ? state.tree.root : null, reorderDragFromSessionId);
      if (
        selfRes !== 'center' &&
        splitInfo &&
        splitInfo.siblingPaneId &&
        selfRes !== splitInfo.currentSide
      ) {
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
      height: Math.max(20, drop.rect.height - 8),
    };
    currentTargetSessionId = targetSessionId;
    currentTargetZone = zone;

    const ov = overlay();
    ov.style.left = `${previewBox.left}px`;
    ov.style.top = `${previewBox.top}px`;
    ov.style.width = `${previewBox.width}px`;
    ov.style.height = `${previewBox.height}px`;
    ov.style.opacity = '1';
    ov.style.transform = 'scale(1)';

    const sourceName = isReorder ? sessionTitle(reorderDragFromSessionId) : sessionTitle(pendingSessionId);
    const targetName = sessionTitle(targetSessionId);
    const actionLabel = zone === 'center'
      ? `Swap with ${targetName}`
      : `Split ${zone.toUpperCase()} of ${targetName}`;
    ov.textContent = `${sourceName} → ${actionLabel}`;
  };

  const onDrop = (e) => {
    debugLog('drop', {
      overCenter,
      target: currentTargetSessionId,
      zone: currentTargetZone,
      reorderSource: reorderDragFromSessionId,
      pending: pendingSessionId,
      x: e.clientX,
      y: e.clientY,
      types: e.dataTransfer && e.dataTransfer.types ? Array.from(e.dataTransfer.types) : [],
    });
    hideOverlay();
    if (!overCenter) {
      debugLog('drop.bail', 'overCenter=false');
      return;
    }
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

      if (!targetSessionId || targetSessionId === sourceId || !zone) {
        debugLog('drop.bail', { reason: 'bad-reorder-target', targetSessionId, sourceId, zone });
        return;
      }

      const currentTree = ensureTree(state.tree, state.panes);
      if (zone === 'center') {
        const nextTree = swapTreePanes(currentTree, sourceId, targetSessionId);
        debugLog('drop.swap', { sourceId, targetSessionId });
        setTree(nextTree);
      } else {
        const nextTree = insertOrSplit(currentTree, sourceId, targetSessionId, zone);
        debugLog('drop.move', { sourceId, targetSessionId, zone });
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
        const targetZone = zone === 'center' || !zone ? 'right' : zone;
        const nextTree = insertOrSplit(currentTree, droppedId, anchor, targetZone);
        activateSplitWithTree(nextTree);
      } else {
        const activeId = currentMainSessionId() || (app?.sessions?.list?.getSnapshot?.()?.ids?.[0]);
        let initialTree;
        const targetZone = zone === 'center' || !zone ? 'right' : zone;
        if (!activeId || activeId === droppedId) {
          const snapshot = app?.sessions?.list?.getSnapshot?.();
          const ids = snapshot?.ids || snapshot?.order || [];
          const otherId = ids.find((id) => id !== activeId);
          if (otherId) {
            initialTree = insertOrSplit({ root: { kind: 'pane', id: activeId || droppedId } }, otherId, activeId || droppedId, targetZone);
          } else {
            initialTree = { root: { kind: 'pane', id: droppedId } };
          }
        } else {
          initialTree = insertOrSplit({ root: { kind: 'pane', id: activeId } }, droppedId, activeId, targetZone);
        }
        activateSplitWithTree(initialTree);
      }
    }
  };

  const onDragEnd = () => {
    debugLog('dragend', { dropHandled, reorderSource: reorderDragFromSessionId, pending: pendingSessionId });
    hideOverlay();
    currentTargetSessionId = null;
    currentTargetZone = null;
    reorderDragFromSessionId = null;
    const el = document.querySelector(`[data-ade-pane][data-ade-dragging-source="true"]`);
    if (el) el.removeAttribute('data-ade-dragging-source');
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

  window.addEventListener('dragstart', onDragStart, true);
  window.addEventListener('dragover', onDragOver, true);
  window.addEventListener('drop', onDrop, true);
  window.addEventListener('dragend', onDragEnd);
  window.addEventListener('dragleave', onDragLeave, true);

  const layoutSnapshot = app.layout ? app.layout.panelInfo : null;
  const isConversationPanel = (id) => id === null || id === 'conversation';
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

    const cleanup = () => {
      window.removeEventListener('dragstart', onDragStart, true);
      window.removeEventListener('dragover', onDragOver, true);
      window.removeEventListener('drop', onDrop, true);
      window.removeEventListener('dragend', onDragEnd);
      window.removeEventListener('dragleave', onDragLeave, true);
      hideOverlay();
      restoreConversationPanel();
      restoreSidebar();
      disposeAlias();
      if (typeof unsub === 'function') unsub();
      if (typeof subagentUnsub === 'function') subagentUnsub();
      for (const id of [...retained.keys()]) releaseReference(id);
      app = null;
    };
    return cleanup;
  }

  const cleanup = () => {
    window.removeEventListener('dragstart', onDragStart, true);
    window.removeEventListener('dragover', onDragOver, true);
    window.removeEventListener('drop', onDrop, true);
    window.removeEventListener('dragend', onDragEnd);
    window.removeEventListener('dragleave', onDragLeave, true);
    hideOverlay();
    restoreConversationPanel();
    restoreSidebar();
    disposeAlias();
    if (typeof subagentUnsub === 'function') subagentUnsub();
    for (const id of [...retained.keys()]) releaseReference(id);
    app = null;
  };
  return cleanup;
}

export const inject = [
  'slots',
  'sessions',
  'layout',
  'uiWorkspace',
  'workspaces',
];
