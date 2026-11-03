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
 */

const PANEL_KEY = 'ade-split';

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

function debugLog(_msg) {
  // Production no-op
}

function currentMainSessionId() {
  if (!app || !app.sessions) return undefined;
  const byId = app.sessions.list.getSnapshot().byId;
  return Object.values(byId).find((r) => (r.retainedBy.mainView ?? 0) > 0)?.id;
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
  let cwd = '';
  try {
    const row = app && app.sessions && app.sessions.list.getSnapshot().byId[sessionId];
    cwd = row && row.cwd ? row.cwd : '';
  } catch (_) {}
  if (cwd) {
    const byPath = items.findIndex((w) => w.path && (w.path === cwd || cwd.startsWith(w.path)));
    if (byPath >= 0) {
      const hit = items[byPath];
      return {
        id: hit.workspaceId || hit.id || '',
        title: hit.title || workspaceTitleOf(hit.path) || hit.workspaceId || '',
        path: hit.path || '',
        index: byPath,
      };
    }
  }
  const title = cwd ? workspaceTitleOf(cwd) : '';
  return title ? { id: '', title, path: cwd, index: -1 } : null;
}

function workspaceTitleOf(path) {
  const trimmed = String(path || '').replace(/[/\\]+$/, '');
  if (!trimmed) return '';
  const sep = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return trimmed.slice(sep + 1);
}

const ADE_PALETTE = [
  { dot: '#38bdf8', border: 'rgba(56, 189, 248, 0.85)', glow: 'rgba(56, 189, 248, 0.45)', badgeBg: 'rgba(56, 189, 248, 0.14)', badgeFg: '#7dd3fc', badgeBorder: 'rgba(56, 189, 248, 0.45)' },
  { dot: '#4ade80', border: 'rgba(74, 222, 128, 0.85)', glow: 'rgba(74, 222, 128, 0.45)', badgeBg: 'rgba(74, 222, 128, 0.14)', badgeFg: '#86efac', badgeBorder: 'rgba(74, 222, 128, 0.45)' },
  { dot: '#fb923c', border: 'rgba(251, 146, 60, 0.85)', glow: 'rgba(251, 146, 60, 0.45)', badgeBg: 'rgba(251, 146, 60, 0.14)', badgeFg: '#fdba74', badgeBorder: 'rgba(251, 146, 60, 0.45)' },
  { dot: '#c084fc', border: 'rgba(192, 132, 252, 0.85)', glow: 'rgba(192, 132, 252, 0.45)', badgeBg: 'rgba(192, 132, 252, 0.14)', badgeFg: '#d8b4fe', badgeBorder: 'rgba(192, 132, 252, 0.45)' },
  { dot: '#f472b6', border: 'rgba(244, 114, 182, 0.85)', glow: 'rgba(244, 114, 182, 0.45)', badgeBg: 'rgba(244, 114, 182, 0.14)', badgeFg: '#f9a8d4', badgeBorder: 'rgba(244, 114, 182, 0.45)' },
  { dot: '#facc15', border: 'rgba(250, 204, 21, 0.85)', glow: 'rgba(250, 204, 21, 0.45)', badgeBg: 'rgba(250, 204, 21, 0.14)', badgeFg: '#fde047', badgeBorder: 'rgba(250, 204, 21, 0.45)' },
  { dot: '#2dd4bf', border: 'rgba(45, 212, 191, 0.85)', glow: 'rgba(45, 212, 191, 0.45)', badgeBg: 'rgba(45, 212, 191, 0.14)', badgeFg: '#5eead4', badgeBorder: 'rgba(45, 212, 191, 0.45)' },
  { dot: '#818cf8', border: 'rgba(129, 140, 248, 0.85)', glow: 'rgba(129, 140, 248, 0.45)', badgeBg: 'rgba(129, 140, 248, 0.14)', badgeFg: '#a5b4fc', badgeBorder: 'rgba(129, 140, 248, 0.45)' },
  { dot: '#f87171', border: 'rgba(248, 113, 113, 0.85)', glow: 'rgba(248, 113, 113, 0.45)', badgeBg: 'rgba(248, 113, 113, 0.14)', badgeFg: '#fca5a5', badgeBorder: 'rgba(248, 113, 113, 0.45)' },
  { dot: '#94a3b8', border: 'rgba(148, 163, 184, 0.85)', glow: 'rgba(148, 163, 184, 0.45)', badgeBg: 'rgba(148, 163, 184, 0.14)', badgeFg: '#cbd5e1', badgeBorder: 'rgba(148, 163, 184, 0.45)' },
];

function accentFor(sessionId) {
  const ws = workspaceOf(sessionId);
  if (ws && ws.index >= 0 && ADE_PALETTE[ws.index]) {
    return ADE_PALETTE[ws.index];
  }
  const key = (ws && (ws.id || ws.path || ws.title)) || sessionId;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ADE_PALETTE[Math.abs(h) % ADE_PALETTE.length];
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
    panes: preserved,
  };
  emit();
}

function setPanes(sessionIds) {
  const ids = [...new Set(sessionIds)].filter(Boolean).slice(0, 6);
  if (ids.length === 0) {
    state = { tree: null, panes: [] };
    emit();
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

let cachedRenderSlot = null;
let cachedSessionProvider = null;
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
  try {
    if (remainingSessionId && app.uiWorkspace) app.uiWorkspace.openSession(remainingSessionId);
    else if (app.layout) app.layout.selectPanel(null);
  } catch (e) {
    try { if (app.layout) app.layout.selectPanel(null); } catch (_) {}
  }
}

class PaneErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    console.error('[ADE] Pane rendered error:', error, info);
  }
  render() {
    if (this.state.error) {
      return React.createElement(
        'div',
        { style: { padding: 16, color: '#f87171', font: '13px/1.4 system-ui, sans-serif' } },
        React.createElement('div', { style: { fontWeight: 600, marginBottom: 8 } }, 'Pane failed to load:'),
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', font: '12px/1.3 monospace', background: 'rgba(0,0,0,0.3)', padding: 8, borderRadius: 4 } }, (this.state.error && this.state.error.message) || String(this.state.error))
      );
    }
    return this.props.children;
  }
}

const paneHeaderStyle = {
  flex: '0 0 34px',
  display: 'flex',
  alignItems: 'center',
  padding: '0 10px',
  gap: 8,
  borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08))',
  background: 'rgba(14, 14, 20, 0.42)',
  backdropFilter: 'blur(12px) saturate(150%)',
  WebkitBackdropFilter: 'blur(12px) saturate(150%)',
  userSelect: 'none',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--dsw-alias-fg-l2, rgba(255,255,255,0.7))',
  cursor: 'grab',
};

const paneTitleStyle = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
};

const closeButtonStyle = {
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  padding: '2px 6px',
  fontSize: 14,
  lineHeight: 1,
  borderRadius: 4,
};

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
      [data-ade-split] [data-ade-pane] [data-conversation-content],
      [data-ade-split] [data-ade-pane] [data-conversation-region="chat"],
      [data-ade-split] [data-ade-pane] [data-conversation-scroll] {
        background-color: transparent !important;
        --dsw-alias-bg-base: transparent !important;
      }
      [data-ade-split] [data-ade-pane][data-ade-hypr-anim='true'] {
        animation: ade-hypr-pop-in 260ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
      }
      [data-ade-split] [data-ade-pane][data-ade-slot='0'] {
        animation-name: ade-hypr-side-in;
      }
      [data-ade-split] [data-ade-pane][data-ade-dragging-source="true"] {
        opacity: 0.4;
        transform: scale(0.985);
        border: 1px dashed rgba(56,189,248,0.7);
      }
      [data-ade-split] > [data-ade-divider] {
        position: absolute;
        z-index: 10;
        background: transparent;
        transition: background 120ms ease;
      }
      [data-ade-split] > [data-ade-divider][data-ade-dir='row'] {
        width: 8px;
        cursor: col-resize;
      }
      [data-ade-split] > [data-ade-divider][data-ade-dir='col'] {
        height: 8px;
        cursor: row-resize;
      }
      [data-ade-split] > [data-ade-divider]::before {
        content: '';
        position: absolute;
        background: var(--dsw-alias-border-l1, rgba(255,255,255,0.12));
        border-radius: 999px;
        transition: background 120ms ease, box-shadow 120ms ease;
      }
      [data-ade-split] > [data-ade-divider][data-ade-dir='row']::before {
        left: 3px; right: 3px; top: 0; bottom: 0;
      }
      [data-ade-split] > [data-ade-divider][data-ade-dir='col']::before {
        top: 3px; bottom: 3px; left: 0; right: 0;
      }
      [data-ade-split] > [data-ade-divider]:hover::before,
      [data-ade-split] > [data-ade-divider][data-ade-dragging='true']::before {
        background: var(--dsw-alias-brand, #38bdf8);
        box-shadow: 0 0 10px rgba(56,189,248,0.85);
      }
      #dsh-ade-drag-preview {
        position: fixed;
        pointer-events: none;
        z-index: 9999;
        border: 2px solid rgba(56, 189, 248, 0.9);
        background: rgba(56, 189, 248, 0.12);
        border-radius: 10px;
        box-shadow: 0 0 24px rgba(56, 189, 248, 0.35), inset 0 0 16px rgba(56, 189, 248, 0.15);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        font: 600 13px/1.3 system-ui, sans-serif;
        color: #e0f2fe;
        text-shadow: 0 1px 3px rgba(0,0,0,0.7);
        transition: left 140ms cubic-bezier(0.2, 0.9, 0.3, 1),
                    top 140ms cubic-bezier(0.2, 0.9, 0.3, 1),
                    width 140ms cubic-bezier(0.2, 0.9, 0.3, 1),
                    height 140ms cubic-bezier(0.2, 0.9, 0.3, 1),
                    opacity 120ms ease;
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

function ensureTree(currentTree, panes) {
  if (currentTree && currentTree.root) return currentTree;
  if (!panes || panes.length === 0) return { root: null };
  if (panes.length === 1) return { root: { kind: 'pane', id: panes[0].sessionId } };
  let cur = { root: { kind: 'pane', id: panes[0].sessionId } };
  for (let i = 1; i < panes.length; i++) {
    cur = insertOrSplit(cur, panes[i].sessionId, panes[i - 1].sessionId, 'right');
  }
  return cur;
}

function ADESplitRoot(props) {
  const renderSlot = typeof props.renderSlot === 'function' ? props.renderSlot : cachedRenderSlot;
  const SessionProvider = typeof props.SessionProvider === 'function' ? props.SessionProvider : cachedSessionProvider;
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
    const ws = (app && app.workspaces) || (app && app.uiWorkspace && app.uiWorkspace.workspaces);
    const unsubs = [];
    const bump = () => setMetaTick((t) => t + 1);
    try {
      if (ws && ws.list && typeof ws.list.subscribe === 'function') unsubs.push(ws.list.subscribe(bump));
    } catch (_) {}
    try {
      if (app && app.sessions && app.sessions.list && typeof app.sessions.list.subscribe === 'function') unsubs.push(app.sessions.list.subscribe(bump));
    } catch (_) {}
    return () => {
      for (const u of unsubs) { try { u(); } catch (_) {} }
    };
  }, []);
  void metaTick;

  if (typeof renderSlot === 'function') cachedRenderSlot = renderSlot;
  if (typeof SessionProvider === 'function') cachedSessionProvider = SessionProvider;

  if (!SessionProvider || typeof renderSlot !== 'function') {
    if (panes.length === 0 && originalConversationPanel) {
      return React.createElement(originalConversationPanel, props);
    }
    return React.createElement('div', { style: { padding: 16, color: '#f87171' } }, '[ADE] slot seats unavailable');
  }
  if (panes.length === 0) {
    return renderSlot('main.conversation', {});
  }

  const closePane = (sessionId) => {
    const nextTree = removePane(state.tree, sessionId);
    releaseReference(sessionId);
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
  } = props;
  const ref = ensureReference(pane.sessionId);
  const accent = accentFor(pane.sessionId);
  const title = sessionTitle(pane.sessionId);
  const ws = workspaceOf(pane.sessionId);
  const mounted = idx === 0 || idx < mountedCount;

  const isImmediatelyOpen = (() => {
    if (idx === 0) return true;
    try {
      return !!(ref && ref.binding && ref.binding.session && ref.binding.session.openState === 'open');
    } catch (_) {
      return false;
    }
  })();

  const [isOpen, setIsOpen] = React.useState(isImmediatelyOpen);

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
      }).catch(() => {
        if (active) setIsOpen(true);
      });
    } else {
      setIsOpen(true);
    }
    return () => { active = false; };
  }, [ref, mounted, isOpen]);

  const shouldRenderContent = mounted && isOpen;
  const pendingPlaceholder = React.createElement(
    'div',
    { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--dsw-alias-fg-l2, rgba(255,255,255,0.45))', font: '13px/1.4 system-ui, sans-serif', background: 'var(--dsw-alias-bg-base, #1e1e24)' } },
    React.createElement('div', { style: { width: 22, height: 22, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.12)', borderTopColor: 'var(--dsw-alias-brand, #4f78ff)', animation: 'ade-spin 700ms linear infinite' } }),
    React.createElement('span', null, 'Loading ' + title + '...')
  );

  const onHeaderDragStart = (e) => {
    reorderDragFromSessionId = pane.sessionId;
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
      'data-ade-pane': '',
      'data-ade-session-id': pane.sessionId,
      'data-ade-slot': String(idx),
      'data-ade-hypr-anim': 'true',
      onAnimationEnd: (e) => {
        if (e.target === e.currentTarget) {
          e.currentTarget.removeAttribute('data-ade-hypr-anim');
        }
      },
      'data-ade-pending': !shouldRenderContent ? 'true' : void 0,
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
      React.createElement('button', {
        style: { ...closeButtonStyle, fontWeight: 700 },
        'aria-label': splitDirection === 'col' ? 'Split side by side (horizontal)' : 'Split stacked (vertical)',
        title: splitDirection === 'col' ? 'Switch this split to side-by-side' : 'Switch this split to stacked',
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: () => togglePaneSplit(pane.sessionId),
      }, splitDirection === 'col' ? '⇄' : '⇅'),
      React.createElement('button', {
        style: closeButtonStyle,
        'aria-label': 'Close pane',
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: () => closePane(pane.sessionId),
      }, '×')
    ),
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

let dropOverlay = null;
function overlay() {
  if (!dropOverlay) {
    dropOverlay = document.createElement('div');
    dropOverlay.id = 'dsh-ade-drag-preview';
    dropOverlay.textContent = '';
    Object.assign(dropOverlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '9999',
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
  ensureAliasRegistered();

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
    if (probe) {
      const r = probe.getBoundingClientRect();
      newOverCenter = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    overCenter = newOverCenter;
    if (!overCenter) {
      hideOverlay();
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';

    // Warm cold session on first dragover frame
    if (pendingSessionId && warmedSessionId !== pendingSessionId) {
      try {
        if (warmedSessionId) releaseReference(warmedSessionId);
        warmedSessionId = pendingSessionId;
        ensureReference(pendingSessionId);
      } catch (_) {
        warmedSessionId = null;
      }
    }

    const paneEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ade-pane]');
    let targetSessionId = null;
    let targetRect = null;
    if (paneEl) {
      targetSessionId = paneEl.getAttribute('data-ade-session-id');
      targetRect = paneEl.getBoundingClientRect();
    } else {
      const container =
        document.querySelector('[data-ade-split]') ||
        document.querySelector('.mP3x-q_centerCol') ||
        document.querySelector('[data-conversation-content]') ||
        document.body;
      targetRect = container.getBoundingClientRect();
      targetSessionId = currentMainSessionId() || (state.panes[0] && state.panes[0].sessionId);
    }

    if (reorderDragFromSessionId && targetSessionId === reorderDragFromSessionId) {
      const selfRes = computeDropZone(targetRect, e.clientX, e.clientY, true);
      const splitInfo = getImmediateSplitInfo(state.tree ? state.tree.root : null, reorderDragFromSessionId);
      if (
        selfRes.zone !== 'center' &&
        splitInfo &&
        splitInfo.siblingPaneId &&
        selfRes.zone !== splitInfo.currentSide
      ) {
        const siblingEl = document.querySelector(`[data-ade-pane][data-ade-session-id="${splitInfo.siblingPaneId}"]`);
        if (siblingEl) {
          const sibRect = siblingEl.getBoundingClientRect();
          const minL = Math.min(targetRect.left, sibRect.left);
          const minT = Math.min(targetRect.top, sibRect.top);
          const maxR = Math.max(targetRect.left + targetRect.width, sibRect.left + sibRect.width);
          const maxB = Math.max(targetRect.top + targetRect.height, sibRect.top + sibRect.height);
          targetRect = {
            left: minL,
            top: minT,
            width: maxR - minL,
            height: maxB - minT,
          };
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

    const allowCenter = !!reorderDragFromSessionId;
    const { zone, rect: previewRect } = computeDropZone(targetRect, e.clientX, e.clientY, allowCenter);
    currentTargetSessionId = targetSessionId;
    currentTargetZone = zone;

    const el = overlay();
    el.style.display = 'flex';
    el.style.left = (previewRect.left + 4) + 'px';
    el.style.top = (previewRect.top + 4) + 'px';
    el.style.width = Math.max(20, previewRect.width - 8) + 'px';
    el.style.height = Math.max(20, previewRect.height - 8) + 'px';
    el.style.opacity = '1';
    el.style.transform = 'scale(1)';

    let icon = '⇄';
    let badgeText = '';
    const targetTitle = targetSessionId ? sessionTitle(targetSessionId) : 'chat';
    if (zone === 'center') {
      icon = '⇄';
      badgeText = `Swap with "${targetTitle}"`;
    } else if (zone === 'top') {
      icon = '⇅';
      badgeText = 'Split Top (Vertical)';
    } else if (zone === 'bottom') {
      icon = '⇅';
      badgeText = 'Split Bottom (Vertical)';
    } else if (zone === 'left') {
      icon = '⇄';
      badgeText = 'Split Left (Horizontal)';
    } else if (zone === 'right') {
      icon = '⇄';
      badgeText = 'Split Right (Horizontal)';
    }

    el.innerHTML = `<div style="background: rgba(15,23,42,0.88); border: 1px solid rgba(56,189,248,0.5); border-radius: 8px; padding: 6px 14px; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.6); pointer-events: none; font-size: 13px; font-weight: 600; color: #38bdf8;"><span style="font-size: 16px;">${icon}</span><span>${badgeText}</span></div>`;
  };

  const onDrop = (e) => {
    hideOverlay();
    const isReorder = isReorderDrag(e);
    const dragSessionId = reorderDragFromSessionId || pendingSessionId;
    if (!dragSessionId && !isReorder) return;

    dropHandled = true;
    if (!overCenter) return;
    e.preventDefault();
    e.stopPropagation();

    const zone = currentTargetZone || 'right';
    const targetId = currentTargetSessionId;

    if (reorderDragFromSessionId) {
      const sourceId = reorderDragFromSessionId;
      reorderDragFromSessionId = null;
      const dragEl = document.querySelector('[data-ade-dragging-source="true"]');
      if (dragEl) dragEl.removeAttribute('data-ade-dragging-source');

      if (!targetId || sourceId === targetId) return;

      if (zone === 'center') {
        const nextTree = swapTreePanes(state.tree, sourceId, targetId);
        setTree(nextTree);
      } else {
        const nextTree = insertOrSplit(state.tree, sourceId, targetId, zone);
        setTree(nextTree);
      }
      return;
    }

    if (pendingSessionId) {
      const droppedId = pendingSessionId;
      pendingSessionId = null;
      if (!isValidSessionId(droppedId)) return;

      if (state.panes && state.panes.length > 0) {
        if (state.panes.some((p) => p.sessionId === droppedId)) return;
        const finalTargetId = targetId || state.panes[0].sessionId;
        const nextTree = insertOrSplit(state.tree, droppedId, finalTargetId, zone);
        activateSplitWithTree(nextTree);
      } else {
        const activeId = currentMainSessionId() || (app.sessions && app.sessions.list.getSnapshot().ids[0]);
        let initialTree;
        if (!activeId || activeId === droppedId) {
          const snapshot = app.sessions ? app.sessions.list.getSnapshot() : null;
          const otherId = snapshot ? snapshot.ids.find((id) => id !== activeId) : null;
          if (otherId) {
            initialTree = insertOrSplit({ root: { kind: 'pane', id: activeId || droppedId } }, otherId, activeId || droppedId, zone);
          } else {
            initialTree = { root: { kind: 'pane', id: droppedId } };
          }
        } else {
          initialTree = insertOrSplit({ root: { kind: 'pane', id: activeId } }, droppedId, activeId, zone);
        }
        activateSplitWithTree(initialTree);
      }
    }
  };

  const onDragEnd = () => {
    hideOverlay();
    if (warmedSessionId && !state.panes.some((p) => p.sessionId === warmedSessionId)) {
      releaseReference(warmedSessionId);
    }
    warmedSessionId = null;
    pendingSessionId = null;
    reorderDragFromSessionId = null;
    overCenter = false;
    dropHandled = false;
    currentTargetSessionId = null;
    currentTargetZone = null;
    const dragEl = document.querySelector('[data-ade-dragging-source="true"]');
    if (dragEl) dragEl.removeAttribute('data-ade-dragging-source');
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
  if (layoutSnapshot) {
    const reconcile = () => {
      const panelId = layoutSnapshot.getSnapshot().activePanelId;
      const nowInConversation = isConversationPanel(panelId);
      if (lastInConversation && !nowInConversation && state.panes.length) {
        for (const id of [...retained.keys()]) releaseReference(id);
        state = { tree: null, panes: [] };
        emit();
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
      disposeAlias();
      if (typeof unsub === 'function') unsub();
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
    disposeAlias();
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
