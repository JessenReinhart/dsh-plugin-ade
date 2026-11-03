import React, { useState, useRef, useMemo, useCallback } from 'react';

/**
 * ADE Node View — Interactive Lineage DAG Canvas
 * Inspired by October.dev and Unreal Engine Blueprint.
 * Visualizes sessions, subagents, and forks in an infinite pan/zoom canvas.
 * Features:
 *   1. Unreal Blueprint-style workspace comment group boxes with draggable headers.
 *   2. On-demand expandable native conversation embedded directly inside node cards.
 *   3. Bezier routing, status telemetry, search, filters, and minimap.
 */

const STORAGE_POSITIONS_KEY = 'dsh-ade-node-positions-v2';
const CARD_WIDTH_COMPACT = 260;
const CARD_WIDTH_EXPANDED = 500;
const CARD_HEIGHT_COMPACT = 110;
const CARD_HEIGHT_EXPANDED = 560;
const CARD_HEADER_HEIGHT = 34;

function getStoredPositions() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_POSITIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function storePositions(positions) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_POSITIONS_KEY, JSON.stringify(positions));
  } catch (_) {}
}

const BLUEPRINT_PALETTES = [
  {
    id: 'cobalt',
    headerBg: 'rgba(30, 58, 138, 0.85)',
    headerBorder: 'rgba(96, 165, 250, 0.5)',
    boxBg: 'rgba(30, 58, 138, 0.08)',
    boxBorder: 'rgba(96, 165, 250, 0.3)',
    text: '#bfdbfe',
    badgeBg: 'rgba(96, 165, 250, 0.2)',
  },
  {
    id: 'emerald',
    headerBg: 'rgba(6, 78, 59, 0.85)',
    headerBorder: 'rgba(52, 211, 153, 0.5)',
    boxBg: 'rgba(6, 78, 59, 0.08)',
    boxBorder: 'rgba(52, 211, 153, 0.3)',
    text: '#a7f3d0',
    badgeBg: 'rgba(52, 211, 153, 0.2)',
  },
  {
    id: 'purple',
    headerBg: 'rgba(88, 28, 135, 0.85)',
    headerBorder: 'rgba(192, 132, 252, 0.5)',
    boxBg: 'rgba(88, 28, 135, 0.08)',
    boxBorder: 'rgba(192, 132, 252, 0.3)',
    text: '#e9d5ff',
    badgeBg: 'rgba(192, 132, 252, 0.2)',
  },
  {
    id: 'amber',
    headerBg: 'rgba(120, 53, 15, 0.85)',
    headerBorder: 'rgba(251, 191, 36, 0.5)',
    boxBg: 'rgba(120, 53, 15, 0.08)',
    boxBorder: 'rgba(251, 191, 36, 0.3)',
    text: '#fde68a',
    badgeBg: 'rgba(251, 191, 36, 0.2)',
  },
  {
    id: 'rose',
    headerBg: 'rgba(136, 19, 55, 0.85)',
    headerBorder: 'rgba(251, 113, 133, 0.5)',
    boxBg: 'rgba(136, 19, 55, 0.08)',
    boxBorder: 'rgba(251, 113, 133, 0.3)',
    text: '#fecdd3',
    badgeBg: 'rgba(251, 113, 133, 0.2)',
  },
  {
    id: 'cyan',
    headerBg: 'rgba(22, 78, 99, 0.85)',
    headerBorder: 'rgba(34, 211, 238, 0.5)',
    boxBg: 'rgba(22, 78, 99, 0.08)',
    boxBorder: 'rgba(34, 211, 238, 0.3)',
    text: '#a5f3fc',
    badgeBg: 'rgba(34, 211, 238, 0.2)',
  },
];

function paletteForWorkspace(index) {
  return BLUEPRINT_PALETTES[Math.abs(index || 0) % BLUEPRINT_PALETTES.length];
}

/**
 * Extract nodes, edges, and workspace associations from DSH sessions snapshot.
 */
export function extractLineageGraph(snapshot, workspaceResolver) {
  if (!snapshot || !snapshot.byId) {
    return { nodes: [], edges: [], workspaces: [] };
  }

  const byId = snapshot.byId;
  const projections = snapshot.projectionsBySession || {};
  const nodesMap = new Map();
  const edges = [];
  const workspacesMap = new Map();

  for (const [id, summary] of Object.entries(byId)) {
    if (!summary) continue;
    const isSubagent = summary.origin === 'subagent';
    const parentId = summary.parentId || null;
    const isFork = Boolean(parentId && !isSubagent);
    const isRoot = !parentId || parentId === id;

    const wsInfo = typeof workspaceResolver === 'function' ? workspaceResolver(id) : null;
    const wsId = wsInfo ? (wsInfo.id || (summary.cwd || 'default')) : (summary.cwd || 'default');
    const wsTitle = wsInfo
      ? (wsInfo.title || (summary.cwd ? summary.cwd.split(/[\\/]/).pop() : 'Default Workspace'))
      : (summary.cwd ? summary.cwd.split(/[\\/]/).pop() : 'Default Workspace');
    const wsPath = wsInfo ? (wsInfo.path || '') : (summary.cwd || '');

    nodesMap.set(id, {
      id,
      title: summary.title || (isSubagent ? `Subagent (${id.slice(0, 8)})` : `Session (${id.slice(0, 8)})`),
      origin: summary.origin || (isFork ? 'fork' : 'user'),
      parentId,
      isSubagent,
      isFork,
      isRoot,
      running: Boolean(summary.running),
      updatedAt: summary.updatedAt || 0,
      workspaceId: wsId,
      workspaceTitle: wsTitle,
      workspacePath: wsPath,
    });
  }

  // 2. Incorporate subagentCatalog projections
  for (const [parentId, proj] of Object.entries(projections)) {
    const catalog = proj?.values?.subagentCatalog;
    if (Array.isArray(catalog)) {
      for (const entry of catalog) {
        if (!entry || !entry.id) continue;
        if (nodesMap.has(entry.id)) {
          const existingNode = nodesMap.get(entry.id);
          if (entry.running === true) existingNode.running = true;
          if (!existingNode.isSubagent) existingNode.isSubagent = true;
          if (!existingNode.parentId) existingNode.parentId = parentId;
        } else {
          const parentNode = nodesMap.get(parentId);
          const wsId = parentNode ? parentNode.workspaceId : 'default';
          const wsTitle = parentNode ? parentNode.workspaceTitle : 'Default Workspace';
          const wsPath = parentNode ? parentNode.workspacePath : '';

          nodesMap.set(entry.id, {
            id: entry.id,
            title: entry.label || `Subagent (${entry.id.slice(0, 8)})`,
            origin: 'subagent',
            parentId,
            isSubagent: true,
            isFork: false,
            isRoot: false,
            running: Boolean(entry.running),
            updatedAt: Date.now(),
            workspaceId: wsId,
            workspaceTitle: wsTitle,
            workspacePath: wsPath,
          });
        }
      }
    }
  }

  // 3. Inherit workspace from parent for generic children
  for (const node of nodesMap.values()) {
    if (node.parentId && nodesMap.has(node.parentId)) {
      const parent = nodesMap.get(node.parentId);
      if (parent && parent.workspaceId && (!node.workspaceId || node.workspaceId === 'default')) {
        node.workspaceId = parent.workspaceId;
        node.workspaceTitle = parent.workspaceTitle;
        node.workspacePath = parent.workspacePath;
      }
    }
  }

  // 4. Construct edges
  for (const node of nodesMap.values()) {
    if (node.parentId && nodesMap.has(node.parentId) && node.parentId !== node.id) {
      const parentNode = nodesMap.get(node.parentId);
      const communicatingWithSubagent = Boolean(
        node.isSubagent && (node.running || (parentNode && parentNode.running))
      );
      edges.push({
        id: `${node.parentId}->${node.id}`,
        from: node.parentId,
        to: node.id,
        isSubagent: node.isSubagent,
        isFork: node.isFork,
        running: node.running,
        communicatingWithSubagent,
      });
    }
  }

  // 5. Collect workspace groups
  let wsIndex = 0;
  for (const node of nodesMap.values()) {
    const wsId = node.workspaceId || 'default';
    if (!workspacesMap.has(wsId)) {
      workspacesMap.set(wsId, {
        id: wsId,
        title: node.workspaceTitle || 'Default Workspace',
        path: node.workspacePath || '',
        palette: paletteForWorkspace(wsIndex++),
        nodeIds: new Set(),
      });
    }
    workspacesMap.get(wsId).nodeIds.add(node.id);
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
    workspaces: Array.from(workspacesMap.values()),
  };
}

/**
 * Compute hierarchical layout separated into Unreal Blueprint workspace clusters.
 */
export function computeGraphLayout(nodes, edges, workspaces, savedPositions = {}) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childrenMap = new Map();
  const parentMap = new Map();

  for (const edge of edges) {
    if (!childrenMap.has(edge.from)) childrenMap.set(edge.from, []);
    childrenMap.get(edge.from).push(edge.to);
    parentMap.set(edge.to, edge.from);
  }

  const positions = {};
  let currentY = 100;

  for (const ws of workspaces) {
    const wsNodeIds = ws.nodeIds || new Set();
    const wsNodes = nodes.filter((n) => wsNodeIds.has(n.id));

    if (wsNodes.length === 0) continue;

    const wsRoots = wsNodes.filter((n) => !parentMap.has(n.id) || !wsNodeIds.has(parentMap.get(n.id)));
    wsRoots.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const depths = new Map();
    function assignDepth(nodeId, depth, visited = new Set()) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      depths.set(nodeId, Math.max(depths.get(nodeId) || 0, depth));
      const kids = (childrenMap.get(nodeId) || []).filter((k) => wsNodeIds.has(k));
      for (const kid of kids) assignDepth(kid, depth + 1, visited);
    }
    for (const root of wsRoots) {
      if (!depths.has(root.id)) assignDepth(root.id, 0);
    }

    for (const root of wsRoots) {
      const visitedTree = new Set();
      const treeNodeIds = [];

      function collectTree(id) {
        if (visitedTree.has(id)) return;
        visitedTree.add(id);
        treeNodeIds.push(id);
        const kids = (childrenMap.get(id) || []).filter((k) => wsNodeIds.has(k));
        for (const kid of kids) collectTree(kid);
      }
      collectTree(root.id);

      const byDepth = new Map();
      for (const id of treeNodeIds) {
        const d = depths.get(id) || 0;
        if (!byDepth.has(d)) byDepth.set(d, []);
        byDepth.get(d).push(id);
      }

      for (const [d, rowIds] of byDepth.entries()) {
        rowIds.forEach((id, idx) => {
          const autoX = 120 + d * 360;
          const autoY = currentY + idx * 170;
          positions[id] = savedPositions && savedPositions[id]
            ? savedPositions[id]
            : { x: autoX, y: autoY };
        });
      }

      let treeRows = 1;
      for (const row of byDepth.values()) {
        if (row.length > treeRows) treeRows = row.length;
      }
      currentY += Math.max(treeRows * 170 + 40, 200);
    }

    currentY += 120;
  }

  // Any remaining orphan nodes
  for (const node of nodes) {
    if (!positions[node.id]) {
      positions[node.id] = savedPositions && savedPositions[node.id]
        ? savedPositions[node.id]
        : { x: 120, y: currentY };
      currentY += 170;
    }
  }

  return positions;
}

/**
 * Interactive Lineage DAG Canvas Component
 */
export function ADENodeGraphCanvas(props) {
  const {
    sessionsSnapshot,
    currentSessionId,
    onOpenSession,
    onSplitSession,
    onForkSession,
    renderSlot,
    SessionProvider,
    ensureReference,
    workspaceOf,
  } = props;

  const [savedPositions, setSavedPositions] = useState(() => getStoredPositions());
  const [transform, setTransform] = useState({ x: 50, y: 50, k: 0.88 });
  const [selectedNodeId, setSelectedNodeId] = useState(currentSessionId || null);
  const [expandedChatNodeIds, setExpandedChatNodeIds] = useState(() => new Set());
  const [closingChatNodeIds, setClosingChatNodeIds] = useState(() => new Set());
  const [filterMode, setFilterMode] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const containerRef = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggingNodeRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const draggingGroupRef = useRef(null);

  const graphData = useMemo(() => {
    return extractLineageGraph(sessionsSnapshot, workspaceOf);
  }, [sessionsSnapshot, workspaceOf]);

  const positions = useMemo(() => {
    return computeGraphLayout(graphData.nodes, graphData.edges, graphData.workspaces, savedPositions);
  }, [graphData.nodes, graphData.edges, graphData.workspaces, savedPositions]);

  const visibleNodes = useMemo(() => {
    return graphData.nodes.filter((node) => {
      if (filterMode === 'running' && !node.running) return false;
      if (filterMode === 'subagents' && !node.isSubagent) return false;
      if (filterMode === 'forks' && !node.isFork) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          node.title.toLowerCase().includes(q) ||
          node.id.toLowerCase().includes(q) ||
          node.workspaceTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [graphData.nodes, filterMode, searchQuery]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const visibleEdges = useMemo(() => {
    return graphData.edges.filter(
      (e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
    );
  }, [graphData.edges, visibleNodeIds]);

  const workspaceBounds = useMemo(() => {
    const map = new Map();
    for (const ws of graphData.workspaces) {
      const memberNodes = visibleNodes.filter((n) => n.workspaceId === ws.id);
      if (memberNodes.length === 0) continue;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const node of memberNodes) {
        const pos = positions[node.id] || { x: 120, y: 120 };
        const isExp = expandedChatNodeIds.has(node.id);
        const w = isExp ? CARD_WIDTH_EXPANDED : CARD_WIDTH_COMPACT;
        const h = isExp ? CARD_HEIGHT_EXPANDED : CARD_HEIGHT_COMPACT;
        minX = Math.min(minX, pos.x);
        minY = Math.min(minY, pos.y);
        maxX = Math.max(maxX, pos.x + w);
        maxY = Math.max(maxY, pos.y + h);
      }

      const padX = 36;
      const padTop = 50;
      const padBottom = 32;

      map.set(ws.id, {
        ws,
        x: minX - padX,
        y: minY - padTop,
        width: Math.max((maxX - minX) + padX * 2, 340),
        height: Math.max((maxY - minY) + padTop + padBottom, 200),
        memberNodeIds: memberNodes.map((n) => n.id),
      });
    }
    return map;
  }, [graphData.workspaces, visibleNodes, positions, expandedChatNodeIds]);

  const handleToggleChatExpand = useCallback((nodeId) => {
    let isClosingNode = false;
    setExpandedChatNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
        isClosingNode = true;
      } else {
        next.add(nodeId);
      }
      return next;
    });

    if (isClosingNode) {
      setClosingChatNodeIds((prev) => new Set(prev).add(nodeId));
      window.setTimeout(() => {
        setClosingChatNodeIds((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      }, 300);
    } else {
      setClosingChatNodeIds((prev) => {
        if (!prev.has(nodeId)) return prev;
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    }
  }, []);

  const handleRecenter = useCallback(() => {
    if (visibleNodes.length === 0) {
      setTransform({ x: 50, y: 50, k: 0.88 });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of visibleNodes) {
      const pos = positions[node.id] || { x: 120, y: 120 };
      const isExp = expandedChatNodeIds.has(node.id);
      const w = isExp ? CARD_WIDTH_EXPANDED : CARD_WIDTH_COMPACT;
      const h = isExp ? CARD_HEIGHT_EXPANDED : CARD_HEIGHT_COMPACT;
      minX = Math.min(minX, pos.x);
      minY = Math.min(minY, pos.y);
      maxX = Math.max(maxX, pos.x + w);
      maxY = Math.max(maxY, pos.y + h);
    }
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const graphW = (maxX - minX) + 120;
    const graphH = (maxY - minY) + 120;
    const scale = Math.min(Math.max(Math.min((cw - 120) / graphW, (ch - 120) / graphH), 0.35), 1.25);
    const cx = (cw - graphW * scale) / 2 - minX * scale + 60 * scale;
    const cy = (ch - graphH * scale) / 2 - minY * scale + 60 * scale;
    setTransform({ x: Math.round(cx), y: Math.round(cy), k: scale });
  }, [visibleNodes, positions, expandedChatNodeIds]);

  const handleFocusWorkspace = useCallback((wsId) => {
    const bound = workspaceBounds.get(wsId);
    const container = containerRef.current;
    if (!bound || !container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const scale = Math.min(Math.max(Math.min((cw - 80) / bound.width, (ch - 80) / bound.height), 0.4), 1.15);
    const cx = (cw - bound.width * scale) / 2 - bound.x * scale;
    const cy = (ch - bound.height * scale) / 2 - bound.y * scale;
    setTransform({ x: Math.round(cx), y: Math.round(cy), k: scale });
  }, [workspaceBounds]);

  const handleResetLayout = useCallback(() => {
    storePositions({});
    setSavedPositions({});
    setTimeout(handleRecenter, 50);
  }, [handleRecenter]);

  const handleMouseDown = (e) => {
    if (
      e.target.closest('[data-node-card]') ||
      e.target.closest('[data-blueprint-header]') ||
      e.target.closest('[data-graph-toolbar]') ||
      e.target.closest('[data-graph-drawer]')
    ) {
      return;
    }
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  const handleMouseMove = (e) => {
    if (draggingGroupRef.current) {
      const { startMouse, memberNodeIds, initialPositions } = draggingGroupRef.current;
      const dx = (e.clientX - startMouse.x) / transform.k;
      const dy = (e.clientY - startMouse.y) / transform.k;
      setSavedPositions((prev) => {
        const next = { ...prev };
        for (const id of memberNodeIds) {
          const init = initialPositions[id] || { x: 120, y: 120 };
          next[id] = { x: Math.round(init.x + dx), y: Math.round(init.y + dy) };
        }
        return next;
      });
      return;
    }

    if (draggingNodeRef.current) {
      const nodeId = draggingNodeRef.current;
      const nx = (e.clientX - transform.x) / transform.k - dragOffsetRef.current.x;
      const ny = (e.clientY - transform.y) / transform.k - dragOffsetRef.current.y;
      setSavedPositions((prev) => ({
        ...prev,
        [nodeId]: { x: Math.round(nx), y: Math.round(ny) },
      }));
      return;
    }

    if (isPanningRef.current) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      }));
    }
  };

  const handleMouseUp = () => {
    if (draggingGroupRef.current) {
      draggingGroupRef.current = null;
      setSavedPositions((curr) => {
        storePositions(curr);
        return curr;
      });
    }
    if (draggingNodeRef.current) {
      draggingNodeRef.current = null;
      setSavedPositions((curr) => {
        storePositions(curr);
        return curr;
      });
    }
    isPanningRef.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.909;
    const newK = Math.min(Math.max(transform.k * zoomFactor, 0.25), 2.2);
    const newX = mouseX - (mouseX - transform.x) * (newK / transform.k);
    const newY = mouseY - (mouseY - transform.y) * (newK / transform.k);

    setTransform({ x: newX, y: newY, k: newK });
  };

  const handleNodeDragStart = (e, nodeId) => {
    e.stopPropagation();
    draggingNodeRef.current = nodeId;
    const pos = positions[nodeId] || { x: 120, y: 120 };
    const clickWorldX = (e.clientX - transform.x) / transform.k;
    const clickWorldY = (e.clientY - transform.y) / transform.k;
    dragOffsetRef.current = {
      x: clickWorldX - pos.x,
      y: clickWorldY - pos.y,
    };
    setSelectedNodeId(nodeId);
  };

  const handleGroupDragStart = (e, memberNodeIds) => {
    e.stopPropagation();
    const initialPositions = {};
    for (const id of memberNodeIds) {
      initialPositions[id] = positions[id] || { x: 120, y: 120 };
    }
    draggingGroupRef.current = {
      startMouse: { x: e.clientX, y: e.clientY },
      memberNodeIds,
      initialPositions,
    };
  };

  const selectedNode = useMemo(() => {
    return graphData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graphData.nodes, selectedNodeId]);

  return React.createElement(
    'div',
    {
      ref: containerRef,
      style: {
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        background: 'oklch(0.12 0.012 260)',
        userSelect: 'none',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onWheel: handleWheel,
    },
    React.createElement('div', {
      style: {
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(oklch(0.3 0.02 260) 1px, transparent 1px)',
        backgroundSize: `${24 * transform.k}px ${24 * transform.k}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        opacity: 0.65,
        pointerEvents: 'none',
      },
    }),
    React.createElement(
      'div',
      {
        'data-graph-toolbar': '',
        style: {
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          height: 40,
          background: 'oklch(0.16 0.018 260 / 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid oklch(0.28 0.02 260)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          zIndex: 40,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        },
      },
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        React.createElement(
          'span',
          {
            style: {
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: '0.02em',
              color: 'oklch(0.96 0.005 260)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            },
          },
          React.createElement('span', { style: { color: 'oklch(0.68 0.16 250)' } }, '◆'),
          'Session Lineage Canvas'
        ),
        React.createElement(
          'span',
          {
            style: {
              fontSize: 10.5,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'oklch(0.22 0.02 260)',
              color: 'oklch(0.75 0.02 260)',
              fontVariantNumeric: 'tabular-nums',
            },
          },
          `${visibleNodes.length} nodes • ${graphData.workspaces.length} workspace groups`
        )
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 6 } },
        ['all', 'running', 'subagents', 'forks'].map((f) => {
          const active = filterMode === f;
          return React.createElement(
            'button',
            {
              key: f,
              type: 'button',
              onClick: () => setFilterMode(f),
              style: {
                background: active ? 'oklch(0.28 0.04 250)' : 'transparent',
                border: active ? '1px solid oklch(0.45 0.1 250)' : '1px solid transparent',
                color: active ? 'oklch(0.98 0.01 250)' : 'oklch(0.65 0.02 260)',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
              },
            },
            f
          );
        }),
        React.createElement('input', {
          type: 'text',
          placeholder: 'Filter sessions or workspaces...',
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value),
          style: {
            background: 'oklch(0.12 0.01 260)',
            border: '1px solid oklch(0.26 0.02 260)',
            color: 'oklch(0.92 0.01 260)',
            borderRadius: 5,
            padding: '3px 8px',
            fontSize: 11,
            width: 170,
            outline: 'none',
          },
        })
      ),
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 6 } },
        React.createElement(
          'button',
          {
            type: 'button',
            title: 'Recenter canvas to fit all nodes',
            onClick: handleRecenter,
            style: {
              background: 'oklch(0.22 0.02 260)',
              border: '1px solid oklch(0.3 0.02 260)',
              color: 'oklch(0.85 0.01 260)',
              borderRadius: 5,
              padding: '3px 8px',
              fontSize: 11,
              cursor: 'pointer',
            },
          },
          'Fit View'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            title: 'Reset layout to default workspace clustering',
            onClick: handleResetLayout,
            style: {
              background: 'oklch(0.22 0.02 260)',
              border: '1px solid oklch(0.3 0.02 260)',
              color: 'oklch(0.85 0.01 260)',
              borderRadius: 5,
              padding: '3px 8px',
              fontSize: 11,
              cursor: 'pointer',
            },
          },
          'Reset Layout'
        ),
        React.createElement(
          'span',
          {
            style: {
              fontSize: 10.5,
              color: 'oklch(0.55 0.02 260)',
              minWidth: 42,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            },
          },
          `${Math.round(transform.k * 100)}%`
        )
      )
    ),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          willChange: 'transform',
        },
      },
      Array.from(workspaceBounds.entries()).map(([wsId, b]) => {
        const { ws, x, y, width, height, memberNodeIds } = b;
        const pal = ws.palette;
        return React.createElement(
          'div',
          {
            key: `blueprint-${wsId}`,
            'data-blueprint-group': wsId,
            style: {
              position: 'absolute',
              left: x,
              top: y,
              width,
              height,
              background: pal.boxBg,
              border: `1.5px solid ${pal.boxBorder}`,
              borderRadius: 8,
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              zIndex: 1,
              pointerEvents: 'auto',
            },
          },
          React.createElement(
            'div',
            {
              'data-blueprint-header': wsId,
              title: 'Drag header to move entire workspace group. Double click to fit.',
              onMouseDown: (e) => handleGroupDragStart(e, memberNodeIds),
              onDoubleClick: (e) => {
                e.stopPropagation();
                handleFocusWorkspace(wsId);
              },
              style: {
                height: 38,
                background: pal.headerBg,
                borderBottom: `1.5px solid ${pal.headerBorder}`,
                borderTopLeftRadius: 6,
                borderTopRightRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                cursor: 'grab',
                userSelect: 'none',
              },
            },
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' } },
              React.createElement(
                'span',
                {
                  style: {
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    color: pal.text,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                },
                `// Workspace: ${ws.title}`
              ),
              ws.path
                ? React.createElement(
                    'span',
                    {
                      style: {
                        fontSize: 10,
                        opacity: 0.72,
                        fontFamily: 'ui-monospace, monospace',
                        color: pal.text,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 260,
                      },
                    },
                    `(${ws.path})`
                  )
                : null
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 } },
              React.createElement(
                'span',
                {
                  style: {
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: pal.badgeBg,
                    color: pal.text,
                    fontVariantNumeric: 'tabular-nums',
                  },
                },
                `${memberNodeIds.length} sessions`
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  title: 'Fit this workspace in viewport',
                  onClick: (e) => {
                    e.stopPropagation();
                    handleFocusWorkspace(wsId);
                  },
                  style: {
                    background: 'transparent',
                    border: `1px solid ${pal.headerBorder}`,
                    color: pal.text,
                    borderRadius: 4,
                    padding: '1px 5px',
                    fontSize: 10,
                    cursor: 'pointer',
                  },
                },
                'Focus'
              )
            )
          )
        );
      }),
      React.createElement(
        'svg',
        {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: 8000,
            height: 8000,
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 10,
          },
        },
        React.createElement(
          'defs',
          null,
          React.createElement(
            'marker',
            { id: 'ade-wire-arrow', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
            React.createElement('path', { d: 'M 0 1.5 L 8 5 L 0 8.5 z', fill: 'oklch(0.42 0.04 260)' })
          ),
          React.createElement(
            'marker',
            { id: 'ade-wire-arrow-subagent', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
            React.createElement('path', { d: 'M 0 1.5 L 8 5 L 0 8.5 z', fill: 'oklch(0.68 0.16 160)' })
          ),
          React.createElement(
            'marker',
            { id: 'ade-wire-arrow-fork', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
            React.createElement('path', { d: 'M 0 1.5 L 8 5 L 0 8.5 z', fill: 'oklch(0.68 0.16 300)' })
          )
        ),
        visibleEdges.map((edge) => {
          const fromPos = positions[edge.from];
          const toPos = positions[edge.to];
          if (!fromPos || !toPos) return null;

          const fromExp = expandedChatNodeIds.has(edge.from);
          const fromW = fromExp ? CARD_WIDTH_EXPANDED : CARD_WIDTH_COMPACT;

          const x1 = fromPos.x + fromW;
          const y1 = fromPos.y + CARD_HEADER_HEIGHT / 2 + 8;
          const x2 = toPos.x;
          const y2 = toPos.y + CARD_HEADER_HEIGHT / 2 + 8;

          const dx = Math.max(Math.abs(x2 - x1) * 0.5, 40);
          const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

          let strokeColor = 'oklch(0.42 0.04 260)';
          let marker = 'url(#ade-wire-arrow)';
          if (edge.isSubagent) {
            strokeColor = edge.communicating
              ? 'oklch(0.72 0.17 145)'
              : edge.running
              ? 'oklch(0.72 0.17 145)'
              : 'oklch(0.55 0.12 160)';
            marker = 'url(#ade-wire-arrow-subagent)';
          } else if (edge.isFork) {
            strokeColor = 'oklch(0.6 0.14 300)';
            marker = 'url(#ade-wire-arrow-fork)';
          }

          const communicate = Boolean(edge.communicating);

          const wirePath = React.createElement('path', {
            d,
            fill: 'none',
            stroke: strokeColor,
            strokeWidth: communicate ? 2.5 : edge.running ? 2.5 : 1.8,
            strokeDasharray: communicate ? '7 7' : edge.running ? '6 6' : undefined,
            markerEnd: marker,
            'data-ade-wire': '',
            style: {
              transition: 'd 280ms cubic-bezier(0.2, 0.9, 0.3, 1)',
              animation: communicate
                ? 'adeWireStream 0.55s linear infinite'
                : edge.running
                ? 'adeFlowPulse 1.2s linear infinite'
                : undefined,
            },
          });

          if (!communicate) {
            return React.createElement('g', { key: edge.id }, wirePath);
          }

          const glowPath = React.createElement('path', {
            d,
            fill: 'none',
            stroke: 'oklch(0.52 0.2 145)',
            strokeWidth: 9,
            strokeLinecap: 'round',
            opacity: 0.14,
            style: {
              transition: 'd 280ms cubic-bezier(0.2, 0.9, 0.3, 1)',
              filter: 'blur(4px)',
            },
          });

          const packet1 = React.createElement('circle', { r: 5, fill: 'oklch(0.85 0.18 160)', style: { filter: 'drop-shadow(0 0 6px rgba(52, 211, 153, 0.9))' } },
            React.createElement(
              'animateMotion',
              {
                dur: '1.6s',
                repeatCount: 'indefinite',
                path: d,
                calcMode: 'linear',
                keyPoints: '0;1',
                keyTimes: '0;1',
              },
            )
          );

          const packet2 = React.createElement('circle', { r: 3.2, fill: 'oklch(0.97 0.03 160)', opacity: 0.85 },
            React.createElement(
              'animateMotion',
              {
                dur: '1.6s',
                begin: '0.8s',
                repeatCount: 'indefinite',
                path: d,
                calcMode: 'linear',
                keyPoints: '0;1',
                keyTimes: '0;1',
              },
            )
          );

          return React.createElement(
            'g',
            { key: edge.id },
            glowPath,
            wirePath,
            packet1,
            packet2
          );
        })
      ),
      visibleNodes.map((node) => {
        const pos = positions[node.id] || { x: 120, y: 120 };
        const isSelected = selectedNodeId === node.id;
        const isCurrent = currentSessionId === node.id;
        const isExpanded = expandedChatNodeIds.has(node.id);
        const isClosing = closingChatNodeIds.has(node.id);
        const showChat = isExpanded || isClosing;

        let badgeBg = 'oklch(0.24 0.02 260)';
        let badgeFg = 'oklch(0.7 0.02 260)';
        let badgeText = 'ROOT';
        if (node.isSubagent) {
          badgeBg = 'oklch(0.24 0.06 160 / 0.4)';
          badgeFg = 'oklch(0.75 0.15 160)';
          badgeText = 'SUBAGENT';
        } else if (node.isFork) {
          badgeBg = 'oklch(0.24 0.08 300 / 0.4)';
          badgeFg = 'oklch(0.75 0.18 300)';
          badgeText = 'FORK';
        }

        const sessionRef = isExpanded && ensureReference ? ensureReference(node.id) : null;

        return React.createElement(
          'div',
          {
            key: node.id,
            'data-node-card': node.id,
            style: {
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: isExpanded ? CARD_WIDTH_EXPANDED : CARD_WIDTH_COMPACT,
              height: isExpanded ? CARD_HEIGHT_EXPANDED : CARD_HEIGHT_COMPACT,
              background: isSelected ? 'oklch(0.2 0.025 250)' : 'oklch(0.16 0.018 260)',
              border: isSelected
                ? '1.5px solid oklch(0.65 0.16 240)'
                : node.running
                ? '1.5px solid oklch(0.68 0.18 145)'
                : isCurrent
                ? '1.5px solid oklch(0.48 0.12 240)'
                : '1px solid oklch(0.28 0.02 260)',
              boxShadow: isSelected
                ? '0 8px 24px rgba(79, 120, 255, 0.25)'
                : node.running
                ? '0 0 16px rgba(34, 197, 94, 0.2)'
                : '0 4px 14px rgba(0,0,0,0.3)',
              borderRadius: 8,
              padding: isExpanded ? 0 : '8px 10px',
              display: 'flex',
              flexDirection: 'column',
              userSelect: 'none',
              zIndex: isSelected ? 30 : isExpanded ? 25 : 20,
              cursor: 'default',
              overflow: 'hidden',
              transition: 'width 280ms cubic-bezier(0.2, 0.9, 0.3, 1), height 280ms cubic-bezier(0.2, 0.9, 0.3, 1), padding 280ms cubic-bezier(0.2, 0.9, 0.3, 1), box-shadow 160ms ease, border-color 160ms ease',
            },
            onClick: () => setSelectedNodeId(node.id),
          },
          React.createElement(
            'div',
            {
              onMouseDown: (e) => handleNodeDragStart(e, node.id),
              style: {
                height: CARD_HEADER_HEIGHT,
                padding: isExpanded ? '0 10px' : '0 2px',
                background: isExpanded ? 'oklch(0.19 0.02 260)' : 'transparent',
                borderBottom: isExpanded ? '1px solid oklch(0.26 0.02 260)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'grab',
                flexShrink: 0,
              },
            },
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
              React.createElement(
                'span',
                {
                  style: {
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    padding: '2px 5px',
                    borderRadius: 3,
                    background: badgeBg,
                    color: badgeFg,
                    flexShrink: 0,
                  },
                },
                badgeText
              ),
              React.createElement(
                'span',
                {
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10,
                    fontFamily: 'ui-monospace, monospace',
                    color: node.running ? 'oklch(0.72 0.17 145)' : 'oklch(0.6 0.02 260)',
                    flexShrink: 0,
                  },
                },
                React.createElement('span', {
                  style: {
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: node.running ? 'oklch(0.72 0.17 145)' : 'oklch(0.45 0.02 260)',
                    boxShadow: node.running ? '0 0 6px oklch(0.72 0.17 145)' : undefined,
                  },
                }),
                node.running ? 'RUN' : 'IDLE'
              ),
              React.createElement(
                'span',
                {
                  title: node.title,
                  style: {
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: 'oklch(0.96 0.005 260)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: isExpanded ? 240 : 120,
                  },
                },
                node.title
              )
            ),
            React.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 } },
              React.createElement(
                'button',
                {
                  type: 'button',
                  title: isExpanded ? 'Collapse native chat' : 'Expand native chat inside node',
                  onClick: (e) => {
                    e.stopPropagation();
                    handleToggleChatExpand(node.id);
                  },
                  style: {
                    background: isExpanded ? 'oklch(0.35 0.12 250)' : 'oklch(0.24 0.02 260)',
                    border: '1px solid oklch(0.35 0.05 250)',
                    color: isExpanded ? '#ffffff' : 'oklch(0.9 0.01 260)',
                    borderRadius: 3,
                    padding: '2px 6px',
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  },
                },
                isExpanded ? '⤡ Fold' : '💬 Chat'
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  title: 'Split into multi-pane layout',
                  onClick: (e) => {
                    e.stopPropagation();
                    if (onSplitSession) onSplitSession(node.id);
                  },
                  style: {
                    background: 'oklch(0.24 0.02 260)',
                    border: '1px solid oklch(0.3 0.02 260)',
                    color: 'oklch(0.85 0.01 260)',
                    borderRadius: 3,
                    padding: '2px 5px',
                    fontSize: 10,
                    cursor: 'pointer',
                  },
                },
                'Split'
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  title: 'Open conversation view',
                  onClick: (e) => {
                    e.stopPropagation();
                    if (onOpenSession) onOpenSession(node.id);
                  },
                  style: {
                    background: 'oklch(0.24 0.02 260)',
                    border: '1px solid oklch(0.3 0.02 260)',
                    color: 'oklch(0.85 0.01 260)',
                    borderRadius: 3,
                    padding: '2px 5px',
                    fontSize: 10,
                    cursor: 'pointer',
                  },
                },
                'Open ↗'
              )
            )
          ),
          showChat
            ? React.createElement(
                'div',
                {
                  'data-ade-node-chat': '',
                  style: {
                    flex: 1,
                    minHeight: 0,
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'oklch(0.14 0.015 260)',
                    position: 'relative',
                    overflow: 'hidden',
                    opacity: isClosing ? 1 : 1,
                    transform: isClosing ? 'translateY(0) scale(1)' : 'translateY(0) scale(1)',
                    animation: isClosing
                      ? 'adeChatFoldOut 240ms cubic-bezier(0.2, 0.9, 0.3, 1) both'
                      : 'adeChatFoldIn 260ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
                    pointerEvents: isClosing ? 'none' : 'auto',
                  },
                  onMouseDown: (e) => e.stopPropagation(),
                  onWheel: (e) => e.stopPropagation(),
                },
                SessionProvider && renderSlot && sessionRef
                  ? React.createElement(
                      SessionProvider,
                      { session: sessionRef },
                      renderSlot('main.conversation', {})
                    )
                  : React.createElement(
                      'div',
                      {
                        style: {
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'oklch(0.6 0.02 260)',
                          fontSize: 11,
                          padding: 20,
                        },
                      },
                      'Initializing native chat viewport...'
                    )
              )
            : React.createElement(
                'div',
                { style: { marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 } },
                React.createElement(
                  'div',
                  {
                    title: node.title,
                    style: {
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'oklch(0.96 0.005 260)',
                      lineHeight: 1.35,
                      maxHeight: 32,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    },
                  },
                  node.title
                ),
                React.createElement(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid oklch(0.24 0.018 260)',
                      paddingTop: 5,
                      fontSize: 10,
                      color: 'oklch(0.55 0.02 260)',
                      fontFamily: 'ui-monospace, monospace',
                    },
                  },
                  React.createElement('span', null, node.id.slice(0, 8)),
                  React.createElement(
                    'span',
                    {
                      style: {
                        color: 'oklch(0.68 0.1 250)',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      },
                      onClick: (e) => {
                        e.stopPropagation();
                        handleToggleChatExpand(node.id);
                      },
                    },
                    'Expand Live Chat ›'
                  )
                )
              )
        );
      })
    ),
    selectedNode
      ? React.createElement(
          'div',
          {
            'data-graph-drawer': '',
            style: {
              position: 'absolute',
              bottom: 14,
              right: 14,
              width: 320,
              background: 'oklch(0.16 0.018 260 / 0.95)',
              backdropFilter: 'blur(14px)',
              border: '1px solid oklch(0.3 0.02 260)',
              borderRadius: 8,
              padding: 12,
              zIndex: 50,
              boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
            },
          },
          React.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
            React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: 'oklch(0.96 0.005 260)' } }, 'Session Node Details'),
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => setSelectedNodeId(null),
                style: {
                  background: 'transparent',
                  border: 'none',
                  color: 'oklch(0.6 0.02 260)',
                  cursor: 'pointer',
                  fontSize: 14,
                  padding: 2,
                },
              },
              '×'
            )
          ),
          React.createElement('div', { style: { fontSize: 11.5, fontWeight: 600, color: 'oklch(0.9 0.01 260)', marginBottom: 4 } }, selectedNode.title),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontFamily: 'ui-monospace, monospace', color: 'oklch(0.65 0.02 260)', marginBottom: 8 } },
            React.createElement('div', null, `ID: ${selectedNode.id}`),
            React.createElement('div', null, `Workspace: ${selectedNode.workspaceTitle}`),
            React.createElement('div', null, `Origin: ${selectedNode.origin}`),
            selectedNode.parentId ? React.createElement('div', null, `Parent: ${selectedNode.parentId}`) : null,
            React.createElement('div', null, `Status: ${selectedNode.running ? 'RUNNING' : 'IDLE'}`)
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: 6 } },
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => handleToggleChatExpand(selectedNode.id),
                style: {
                  flex: 1,
                  background: expandedChatNodeIds.has(selectedNode.id) ? 'oklch(0.35 0.12 250)' : 'oklch(0.24 0.02 260)',
                  border: '1px solid oklch(0.35 0.05 250)',
                  color: '#ffffff',
                  borderRadius: 4,
                  padding: '4px 0',
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                },
              },
              expandedChatNodeIds.has(selectedNode.id) ? 'Collapse Chat' : 'Expand Chat'
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => onSplitSession && onSplitSession(selectedNode.id),
                style: {
                  flex: 1,
                  background: 'oklch(0.22 0.02 260)',
                  border: '1px solid oklch(0.32 0.02 260)',
                  color: 'oklch(0.9 0.01 260)',
                  borderRadius: 4,
                  padding: '4px 0',
                  fontSize: 10.5,
                  cursor: 'pointer',
                },
              },
              'Split View'
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => onOpenSession && onOpenSession(selectedNode.id),
                style: {
                  flex: 1,
                  background: 'oklch(0.22 0.02 260)',
                  border: '1px solid oklch(0.32 0.02 260)',
                  color: 'oklch(0.9 0.01 260)',
                  borderRadius: 4,
                  padding: '4px 0',
                  fontSize: 10.5,
                  cursor: 'pointer',
                },
              },
              'Open'
            )
          )
        )
      : null
  );
}