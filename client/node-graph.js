import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

/**
 * ADE Node View — Interactive Lineage DAG Canvas
 * Inspired by October.dev and modern node-based agent canvases.
 * Visualizes sessions, subagents, and forks as an infinite pan/zoom graph.
 */

const STORAGE_POSITIONS_KEY = 'dsh-ade-node-positions-v1';

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

/**
 * Extract nodes and edges from DSH sessions snapshot.
 */
export function extractLineageGraph(snapshot) {
  if (!snapshot || !snapshot.byId) {
    return { nodes: [], edges: [] };
  }

  const byId = snapshot.byId;
  const projections = snapshot.projectionsBySession || {};
  const nodesMap = new Map();
  const edges = [];

  // 1. Process all sessions in byId
  for (const [id, summary] of Object.entries(byId)) {
    if (!summary) continue;
    const isSubagent = summary.origin === 'subagent';
    const parentId = summary.parentId || null;
    const isFork = Boolean(parentId && !isSubagent);
    const isRoot = !parentId || parentId === id;

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
      workspaceId: summary.workspaceId || null,
    });
  }

  // 2. Also incorporate subagentCatalog projections (in case some children aren't yet full summaries in byId)
  for (const [parentId, proj] of Object.entries(projections)) {
    const catalog = proj?.values?.subagentCatalog;
    if (Array.isArray(catalog)) {
      for (const entry of catalog) {
        if (!entry || !entry.id) continue;
        if (!nodesMap.has(entry.id)) {
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
            workspaceId: null,
          });
        }
      }
    }
  }

  // 3. Construct edges
  for (const node of nodesMap.values()) {
    if (node.parentId && nodesMap.has(node.parentId) && node.parentId !== node.id) {
      edges.push({
        id: `${node.parentId}->${node.id}`,
        from: node.parentId,
        to: node.id,
        isSubagent: node.isSubagent,
        isFork: node.isFork,
        running: node.running,
      });
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
  };
}

/**
 * Compute hierarchical DAG layout (roots at depth 0, children at depth 1, etc.)
 */
export function computeGraphLayout(nodes, edges, savedPositions = {}) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childrenMap = new Map();
  const parentMap = new Map();

  for (const edge of edges) {
    if (!childrenMap.has(edge.from)) childrenMap.set(edge.from, []);
    childrenMap.get(edge.from).push(edge.to);
    parentMap.set(edge.to, edge.from);
  }

  // Identify roots (nodes with no valid in-graph parent)
  const rootIds = [];
  for (const node of nodes) {
    if (!parentMap.has(node.id)) {
      rootIds.push(node.id);
    }
  }
  // Sort roots by recency (newest top)
  rootIds.sort((a, b) => (nodeMap.get(b)?.updatedAt || 0) - (nodeMap.get(a)?.updatedAt || 0));

  const depths = new Map();
  function assignDepth(nodeId, depth, visited = new Set()) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    depths.set(nodeId, Math.max(depths.get(nodeId) || 0, depth));
    const kids = childrenMap.get(nodeId) || [];
    for (const kid of kids) {
      assignDepth(kid, depth + 1, visited);
    }
  }

  for (const rootId of rootIds) {
    assignDepth(rootId, 0);
  }

  // Assign Y coordinate per root tree
  let currentY = 80;
  const positions = {};

  for (const rootId of rootIds) {
    const visitedInTree = new Set();
    const treeNodes = [];

    function collectTree(id) {
      if (visitedInTree.has(id)) return;
      visitedInTree.add(id);
      treeNodes.push(id);
      const kids = childrenMap.get(id) || [];
      for (const kid of kids) collectTree(kid);
    }
    collectTree(rootId);

    // Group tree nodes by depth
    const byDepth = new Map();
    for (const id of treeNodes) {
      const d = depths.get(id) || 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d).push(id);
    }

    // Determine max rows in this tree
    let maxRows = 1;
    for (const row of byDepth.values()) {
      if (row.length > maxRows) maxRows = row.length;
    }

    const startY = currentY;
    for (const [d, rowIds] of byDepth.entries()) {
      rowIds.forEach((id, idx) => {
        const autoX = 80 + d * 340;
        const autoY = startY + idx * 140;
        if (savedPositions && savedPositions[id]) {
          positions[id] = savedPositions[id];
        } else {
          positions[id] = { x: autoX, y: autoY };
        }
      });
    }

    currentY += Math.max(maxRows * 140 + 60, 180);
  }

  // Handle any orphan nodes
  for (const node of nodes) {
    if (!positions[node.id]) {
      if (savedPositions && savedPositions[node.id]) {
        positions[node.id] = savedPositions[node.id];
      } else {
        positions[node.id] = { x: 80, y: currentY };
        currentY += 150;
      }
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
  } = props;

  const [savedPositions, setSavedPositions] = useState(() => getStoredPositions());
  const [transform, setTransform] = useState({ x: 40, y: 30, k: 0.9 });
  const [selectedNodeId, setSelectedNodeId] = useState(currentSessionId || null);
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'running' | 'subagents' | 'forks'
  const [searchQuery, setSearchQuery] = useState('');

  const containerRef = useRef(null);
  const worldRef = useRef(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const draggingNodeRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const graphData = useMemo(() => {
    return extractLineageGraph(sessionsSnapshot);
  }, [sessionsSnapshot]);

  const positions = useMemo(() => {
    return computeGraphLayout(graphData.nodes, graphData.edges, savedPositions);
  }, [graphData.nodes, graphData.edges, savedPositions]);

  // Filtered nodes
  const visibleNodes = useMemo(() => {
    return graphData.nodes.filter((node) => {
      if (filterMode === 'running' && !node.running) return false;
      if (filterMode === 'subagents' && !node.isSubagent) return false;
      if (filterMode === 'forks' && !node.isFork) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          node.title.toLowerCase().includes(q) ||
          node.id.toLowerCase().includes(q)
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

  // Recenter / fit view
  const handleRecenter = useCallback(() => {
    if (visibleNodes.length === 0) {
      setTransform({ x: 40, y: 40, k: 0.9 });
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of visibleNodes) {
      const pos = positions[node.id] || { x: 80, y: 80 };
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + 260 > maxX) maxX = pos.x + 260;
      if (pos.y + 120 > maxY) maxY = pos.y + 120;
    }
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth || 800;
    const ch = container.clientHeight || 600;
    const gw = Math.max(maxX - minX + 80, 400);
    const gh = Math.max(maxY - minY + 80, 300);

    const scale = Math.min(Math.max(Math.min((cw - 60) / gw, (ch - 60) / gh), 0.4), 1.2);
    const cx = (cw - gw * scale) / 2 - minX * scale + 40;
    const cy = (ch - gh * scale) / 2 - minY * scale + 40;

    setTransform({ x: Math.round(cx), y: Math.round(cy), k: scale });
  }, [visibleNodes, positions]);

  // Auto layout reset
  const handleResetLayout = useCallback(() => {
    storePositions({});
    setSavedPositions({});
    setTimeout(handleRecenter, 50);
  }, [handleRecenter]);

  // Canvas Pan (pointer events)
  const handleMouseDown = (e) => {
    if (e.target.closest('[data-node-card]') || e.target.closest('[data-graph-toolbar]') || e.target.closest('[data-graph-drawer]')) {
      return;
    }
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (isPanningRef.current) {
        setTransform((prev) => ({
          ...prev,
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y,
        }));
      } else if (draggingNodeRef.current) {
        const nodeId = draggingNodeRef.current;
        const newX = Math.round((e.clientX - transform.x) / transform.k - dragOffsetRef.current.x);
        const newY = Math.round((e.clientY - transform.y) / transform.k - dragOffsetRef.current.y);

        setSavedPositions((prev) => {
          const next = { ...prev, [nodeId]: { x: newX, y: newY } };
          storePositions(next);
          return next;
        });
      }
    };

    const onMouseUp = () => {
      isPanningRef.current = false;
      draggingNodeRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [transform]);

  // Zoom via wheel
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.09 : 0.91;
    const newK = Math.min(Math.max(transform.k * zoomFactor, 0.35), 2.2);

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const newX = mx - (mx - transform.x) * (newK / transform.k);
    const newY = my - (my - transform.y) * (newK / transform.k);

    setTransform({ x: newX, y: newY, k: newK });
  };

  const selectedNode = useMemo(() => {
    return graphData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graphData.nodes, selectedNodeId]);

  const activeCount = useMemo(() => {
    return graphData.nodes.filter((n) => n.running).length;
  }, [graphData.nodes]);

  return React.createElement(
    'div',
    {
      ref: containerRef,
      'data-ade-graph-canvas': '',
      style: {
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--dsw-alias-surface-canvas, oklch(0.12 0.012 260))',
        backgroundImage: 'radial-gradient(circle, oklch(0.28 0.02 260 / 0.45) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        userSelect: 'none',
      },
      onMouseDown: handleMouseDown,
      onWheel: handleWheel,
    },
    // Top Glassmorphic Toolbar
    React.createElement(
      'div',
      {
        'data-graph-toolbar': '',
        style: {
          position: 'absolute',
          top: 12,
          left: 14,
          right: 14,
          height: 40,
          background: 'oklch(0.16 0.018 260 / 0.85)',
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
      // Left tools: Title & Stats
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 8 } },
        React.createElement(
          'span',
          {
            style: {
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'oklch(0.96 0.005 260)',
            },
          },
          React.createElement(
            'svg',
            { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
            React.createElement('circle', { cx: 6, cy: 6, r: 3 }),
            React.createElement('circle', { cx: 6, cy: 18, r: 3 }),
            React.createElement('circle', { cx: 18, cy: 12, r: 3 }),
            React.createElement('path', { d: 'M9 7.5L15 10.5M9 16.5L15 13.5' })
          ),
          'Lineage Graph'
        ),
        React.createElement(
          'span',
          {
            style: {
              fontSize: 10.5,
              fontFamily: 'ui-monospace, monospace',
              padding: '2px 6px',
              borderRadius: 4,
              background: 'oklch(0.24 0.02 260)',
              color: 'oklch(0.72 0.02 260)',
              border: '1px solid oklch(0.28 0.02 260)',
            },
          },
          `${graphData.nodes.length} nodes`
        ),
        activeCount > 0
          ? React.createElement(
              'span',
              {
                style: {
                  fontSize: 10.5,
                  fontFamily: 'ui-monospace, monospace',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'oklch(0.24 0.04 145 / 0.3)',
                  color: 'oklch(0.75 0.18 145)',
                  border: '1px solid oklch(0.4 0.1 145)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                },
              },
              React.createElement('span', {
                style: {
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'oklch(0.75 0.18 145)',
                },
              }),
              `${activeCount} active`
            )
          : null
      ),
      // Filter & Search
      React.createElement(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 6 } },
        React.createElement(
          'div',
          { style: { display: 'flex', background: 'oklch(0.22 0.02 260)', borderRadius: 5, padding: 2, border: '1px solid oklch(0.28 0.02 260)' } },
          ['all', 'running', 'subagents', 'forks'].map((f) =>
            React.createElement(
              'button',
              {
                key: f,
                type: 'button',
                onClick: () => setFilterMode(f),
                style: {
                  background: filterMode === f ? 'oklch(0.32 0.03 260)' : 'transparent',
                  color: filterMode === f ? '#fff' : 'oklch(0.65 0.02 260)',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 7px',
                  fontSize: 10.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                },
              },
              f
            )
          )
        ),
        React.createElement('input', {
          type: 'text',
          placeholder: 'Search nodes...',
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value),
          style: {
            background: 'oklch(0.2 0.02 260)',
            border: '1px solid oklch(0.28 0.02 260)',
            borderRadius: 5,
            color: 'oklch(0.95 0.005 260)',
            fontSize: 11,
            padding: '3px 8px',
            width: 120,
            outline: 'none',
          },
        }),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: handleRecenter,
            title: 'Recenter canvas',
            style: {
              background: 'oklch(0.24 0.02 260)',
              border: '1px solid oklch(0.28 0.02 260)',
              color: 'oklch(0.85 0.01 260)',
              borderRadius: 5,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            },
          },
          'Recenter'
        ),
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: handleResetLayout,
            title: 'Reset auto layout',
            style: {
              background: 'oklch(0.24 0.02 260)',
              border: '1px solid oklch(0.28 0.02 260)',
              color: 'oklch(0.85 0.01 260)',
              borderRadius: 5,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            },
          },
          'Auto-Layout'
        )
      )
    ),
    // World Container (transforms pan/zoom)
    React.createElement(
      'div',
      {
        ref: worldRef,
        'data-graph-world': '',
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '0 0',
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          width: 0,
          height: 0,
        },
      },
      // SVG Wires Layer
      React.createElement(
        'svg',
        {
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: 6000,
            height: 6000,
            pointerEvents: 'none',
            overflow: 'visible',
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
            React.createElement('path', { d: 'M 0 1.5 L 8 5 L 0 8.5 z', fill: 'oklch(0.68 0.18 300)' })
          )
        ),
        visibleEdges.map((edge) => {
          const fromPos = positions[edge.from] || { x: 80, y: 80 };
          const toPos = positions[edge.to] || { x: 420, y: 80 };

          const startX = fromPos.x + 260; // right edge of card
          const startY = fromPos.y + 48; // center vertical
          const endX = toPos.x; // left edge of card
          const endY = toPos.y + 48;

          const dx = Math.abs(endX - startX) * 0.55;
          const d = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

          let strokeColor = 'oklch(0.38 0.03 260)';
          let marker = 'url(#ade-wire-arrow)';
          if (edge.isSubagent) {
            strokeColor = edge.running ? 'oklch(0.72 0.17 145)' : 'oklch(0.55 0.12 160)';
            marker = 'url(#ade-wire-arrow-subagent)';
          } else if (edge.isFork) {
            strokeColor = 'oklch(0.6 0.14 300)';
            marker = 'url(#ade-wire-arrow-fork)';
          }

          return React.createElement('path', {
            key: edge.id,
            d,
            fill: 'none',
            stroke: strokeColor,
            strokeWidth: edge.running ? 2.5 : 1.8,
            strokeDasharray: edge.running ? '6 6' : undefined,
            markerEnd: marker,
            style: edge.running ? { animation: 'adeFlowPulse 1.2s linear infinite' } : undefined,
          });
        })
      ),
      // Nodes Layer
      visibleNodes.map((node) => {
        const pos = positions[node.id] || { x: 80, y: 80 };
        const isSelected = selectedNodeId === node.id;
        const isCurrent = currentSessionId === node.id;

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

        return React.createElement(
          'div',
          {
            key: node.id,
            'data-node-card': node.id,
            style: {
              position: 'absolute',
              left: pos.x,
              top: pos.y,
              width: 260,
              background: isSelected ? 'oklch(0.22 0.03 250)' : 'oklch(0.18 0.018 260)',
              border: isSelected
                ? '1px solid oklch(0.65 0.16 240)'
                : node.running
                ? '1px solid oklch(0.68 0.18 145)'
                : isCurrent
                ? '1px solid oklch(0.48 0.12 240)'
                : '1px solid oklch(0.28 0.02 260)',
              boxShadow: isSelected
                ? '0 0 0 2px oklch(0.65 0.16 240 / 0.3), 0 8px 24px rgba(0,0,0,0.5)'
                : '0 4px 16px rgba(0,0,0,0.3)',
              borderRadius: 8,
              padding: '8px 10px',
              cursor: 'pointer',
              zIndex: isSelected ? 20 : 10,
              transition: 'border-color 140ms ease, box-shadow 140ms ease',
            },
            onMouseDown: (e) => {
              if (e.target.closest('button')) return;
              e.stopPropagation();
              setSelectedNodeId(node.id);
              draggingNodeRef.current = node.id;
              dragOffsetRef.current = {
                x: (e.clientX - transform.x) / transform.k - pos.x,
                y: (e.clientY - transform.y) / transform.k - pos.y,
              };
            },
            onDoubleClick: (e) => {
              e.stopPropagation();
              if (onOpenSession) onOpenSession(node.id);
            },
          },
          // Card Header
          React.createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 5,
              },
            },
            React.createElement(
              'span',
              {
                style: {
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '1px 5px',
                  borderRadius: 3,
                  background: badgeBg,
                  color: badgeFg,
                },
              },
              badgeText
            ),
            React.createElement(
              'div',
              {
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontFamily: 'ui-monospace, monospace',
                  color: 'oklch(0.6 0.02 260)',
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
              node.running ? 'running' : 'idle'
            )
          ),
          // Title
          React.createElement(
            'div',
            {
              title: node.title,
              style: {
                fontSize: 12,
                fontWeight: 600,
                color: 'oklch(0.96 0.005 260)',
                lineHeight: 1.35,
                maxHeight: 32,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                marginBottom: 6,
              },
            },
            node.title
          ),
          // Card Footer: Actions
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
              'div',
              { style: { display: 'flex', gap: 4 } },
              React.createElement(
                'button',
                {
                  type: 'button',
                  title: 'Open in split pane',
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
                  title: 'Open conversation',
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
                'Open'
              )
            )
          )
        );
      })
    ),
    // Selected Node Inspector Floating Drawer
    selectedNode
      ? React.createElement(
          'div',
          {
            'data-graph-drawer': '',
            style: {
              position: 'absolute',
              bottom: 14,
              right: 14,
              width: 300,
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
                },
              },
              '✕'
            )
          ),
          React.createElement('div', { style: { fontSize: 12, fontWeight: 600, color: 'oklch(0.92 0.01 260)', marginBottom: 8 } }, selectedNode.title),
          React.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10.5, fontFamily: 'ui-monospace, monospace', color: 'oklch(0.7 0.02 260)', marginBottom: 12 } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between' } }, React.createElement('span', null, 'Session ID:'), React.createElement('span', { style: { color: 'oklch(0.9 0.01 260)' } }, selectedNode.id)),
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between' } }, React.createElement('span', null, 'Origin:'), React.createElement('span', { style: { color: 'oklch(0.9 0.01 260)' } }, selectedNode.origin)),
            selectedNode.parentId
              ? React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between' } }, React.createElement('span', null, 'Parent:'), React.createElement('span', { style: { color: 'oklch(0.9 0.01 260)' } }, selectedNode.parentId.slice(0, 10)))
              : null,
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between' } }, React.createElement('span', null, 'Status:'), React.createElement('span', { style: { color: selectedNode.running ? 'oklch(0.75 0.18 145)' : 'oklch(0.6 0.02 260)' } }, selectedNode.running ? 'running' : 'idle'))
          ),
          React.createElement(
            'div',
            { style: { display: 'flex', gap: 6 } },
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => onOpenSession && onOpenSession(selectedNode.id),
                style: {
                  flex: 1,
                  background: 'oklch(0.24 0.02 260)',
                  border: '1px solid oklch(0.32 0.02 260)',
                  color: 'oklch(0.95 0.005 260)',
                  borderRadius: 5,
                  padding: '5px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                },
              },
              'Open Chat'
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => onSplitSession && onSplitSession(selectedNode.id),
                style: {
                  flex: 1,
                  background: 'oklch(0.55 0.16 240)',
                  border: '1px solid oklch(0.65 0.18 240)',
                  color: '#fff',
                  borderRadius: 5,
                  padding: '5px 0',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                },
              },
              'Split to Pane'
            )
          )
        )
      : null
  );
}