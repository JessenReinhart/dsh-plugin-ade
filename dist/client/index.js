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
var import_react2 = __toESM(require("react"), 1);
var import_react_dom = require("react-dom");

// client/node-graph.js
var import_react = __toESM(require("react"), 1);
var STORAGE_POSITIONS_KEY = "dsh-ade-node-positions-v2";
var CARD_WIDTH_COMPACT = 260;
var CARD_WIDTH_EXPANDED = 500;
var CARD_HEIGHT_COMPACT = 110;
var CARD_HEIGHT_EXPANDED = 560;
var CARD_HEADER_HEIGHT = 34;
function getStoredPositions() {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(STORAGE_POSITIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}
function storePositions(positions) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_POSITIONS_KEY, JSON.stringify(positions));
  } catch (_) {
  }
}
var BLUEPRINT_PALETTES = [
  {
    id: "cobalt",
    headerBg: "rgba(30, 58, 138, 0.85)",
    headerBorder: "rgba(96, 165, 250, 0.5)",
    boxBg: "rgba(30, 58, 138, 0.08)",
    boxBorder: "rgba(96, 165, 250, 0.3)",
    text: "#bfdbfe",
    badgeBg: "rgba(96, 165, 250, 0.2)"
  },
  {
    id: "emerald",
    headerBg: "rgba(6, 78, 59, 0.85)",
    headerBorder: "rgba(52, 211, 153, 0.5)",
    boxBg: "rgba(6, 78, 59, 0.08)",
    boxBorder: "rgba(52, 211, 153, 0.3)",
    text: "#a7f3d0",
    badgeBg: "rgba(52, 211, 153, 0.2)"
  },
  {
    id: "purple",
    headerBg: "rgba(88, 28, 135, 0.85)",
    headerBorder: "rgba(192, 132, 252, 0.5)",
    boxBg: "rgba(88, 28, 135, 0.08)",
    boxBorder: "rgba(192, 132, 252, 0.3)",
    text: "#e9d5ff",
    badgeBg: "rgba(192, 132, 252, 0.2)"
  },
  {
    id: "amber",
    headerBg: "rgba(120, 53, 15, 0.85)",
    headerBorder: "rgba(251, 191, 36, 0.5)",
    boxBg: "rgba(120, 53, 15, 0.08)",
    boxBorder: "rgba(251, 191, 36, 0.3)",
    text: "#fde68a",
    badgeBg: "rgba(251, 191, 36, 0.2)"
  },
  {
    id: "rose",
    headerBg: "rgba(136, 19, 55, 0.85)",
    headerBorder: "rgba(251, 113, 133, 0.5)",
    boxBg: "rgba(136, 19, 55, 0.08)",
    boxBorder: "rgba(251, 113, 133, 0.3)",
    text: "#fecdd3",
    badgeBg: "rgba(251, 113, 133, 0.2)"
  },
  {
    id: "cyan",
    headerBg: "rgba(22, 78, 99, 0.85)",
    headerBorder: "rgba(34, 211, 238, 0.5)",
    boxBg: "rgba(22, 78, 99, 0.08)",
    boxBorder: "rgba(34, 211, 238, 0.3)",
    text: "#a5f3fc",
    badgeBg: "rgba(34, 211, 238, 0.2)"
  }
];
function paletteForWorkspace(index) {
  return BLUEPRINT_PALETTES[Math.abs(index || 0) % BLUEPRINT_PALETTES.length];
}
function extractLineageGraph(snapshot, workspaceResolver) {
  if (!snapshot || !snapshot.byId) {
    return { nodes: [], edges: [], workspaces: [] };
  }
  const byId = snapshot.byId;
  const projections = snapshot.projectionsBySession || {};
  const nodesMap = /* @__PURE__ */ new Map();
  const edges = [];
  const workspacesMap = /* @__PURE__ */ new Map();
  for (const [id, summary] of Object.entries(byId)) {
    if (!summary) continue;
    const isSubagent = summary.origin === "subagent";
    const parentId = summary.parentId || null;
    const isFork = Boolean(parentId && !isSubagent);
    const isRoot = !parentId || parentId === id;
    const wsInfo = typeof workspaceResolver === "function" ? workspaceResolver(id) : null;
    const wsId = wsInfo ? wsInfo.id || (summary.cwd || "default") : summary.cwd || "default";
    const wsTitle = wsInfo ? wsInfo.title || (summary.cwd ? summary.cwd.split(/[\\/]/).pop() : "Default Workspace") : summary.cwd ? summary.cwd.split(/[\\/]/).pop() : "Default Workspace";
    const wsPath = wsInfo ? wsInfo.path || "" : summary.cwd || "";
    nodesMap.set(id, {
      id,
      title: summary.title || (isSubagent ? `Subagent (${id.slice(0, 8)})` : `Session (${id.slice(0, 8)})`),
      origin: summary.origin || (isFork ? "fork" : "user"),
      parentId,
      isSubagent,
      isFork,
      isRoot,
      running: Boolean(summary.running),
      updatedAt: summary.updatedAt || 0,
      workspaceId: wsId,
      workspaceTitle: wsTitle,
      workspacePath: wsPath
    });
  }
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
          const wsId = parentNode ? parentNode.workspaceId : "default";
          const wsTitle = parentNode ? parentNode.workspaceTitle : "Default Workspace";
          const wsPath = parentNode ? parentNode.workspacePath : "";
          nodesMap.set(entry.id, {
            id: entry.id,
            title: entry.label || `Subagent (${entry.id.slice(0, 8)})`,
            origin: "subagent",
            parentId,
            isSubagent: true,
            isFork: false,
            isRoot: false,
            running: Boolean(entry.running),
            updatedAt: Date.now(),
            workspaceId: wsId,
            workspaceTitle: wsTitle,
            workspacePath: wsPath
          });
        }
      }
    }
  }
  for (const node of nodesMap.values()) {
    if (node.parentId && nodesMap.has(node.parentId)) {
      const parent = nodesMap.get(node.parentId);
      if (parent && parent.workspaceId && (!node.workspaceId || node.workspaceId === "default")) {
        node.workspaceId = parent.workspaceId;
        node.workspaceTitle = parent.workspaceTitle;
        node.workspacePath = parent.workspacePath;
      }
    }
  }
  for (const node of nodesMap.values()) {
    if (node.parentId && nodesMap.has(node.parentId) && node.parentId !== node.id) {
      const parentNode = nodesMap.get(node.parentId);
      const communicatingWithSubagent = Boolean(
        node.isSubagent && (node.running || parentNode && parentNode.running)
      );
      edges.push({
        id: `${node.parentId}->${node.id}`,
        from: node.parentId,
        to: node.id,
        isSubagent: node.isSubagent,
        isFork: node.isFork,
        running: node.running,
        communicatingWithSubagent
      });
    }
  }
  let wsIndex = 0;
  for (const node of nodesMap.values()) {
    const wsId = node.workspaceId || "default";
    if (!workspacesMap.has(wsId)) {
      workspacesMap.set(wsId, {
        id: wsId,
        title: node.workspaceTitle || "Default Workspace",
        path: node.workspacePath || "",
        palette: paletteForWorkspace(wsIndex++),
        nodeIds: /* @__PURE__ */ new Set()
      });
    }
    workspacesMap.get(wsId).nodeIds.add(node.id);
  }
  return {
    nodes: Array.from(nodesMap.values()),
    edges,
    workspaces: Array.from(workspacesMap.values())
  };
}
function computeGraphLayout(nodes, edges, workspaces, savedPositions = {}) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childrenMap = /* @__PURE__ */ new Map();
  const parentMap = /* @__PURE__ */ new Map();
  for (const edge of edges) {
    if (!childrenMap.has(edge.from)) childrenMap.set(edge.from, []);
    childrenMap.get(edge.from).push(edge.to);
    parentMap.set(edge.to, edge.from);
  }
  const positions = {};
  let currentY = 100;
  for (const ws of workspaces) {
    let assignDepth2 = function(nodeId, depth, visited = /* @__PURE__ */ new Set()) {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      depths.set(nodeId, Math.max(depths.get(nodeId) || 0, depth));
      const kids = (childrenMap.get(nodeId) || []).filter((k) => wsNodeIds.has(k));
      for (const kid of kids) assignDepth2(kid, depth + 1, visited);
    };
    var assignDepth = assignDepth2;
    const wsNodeIds = ws.nodeIds || /* @__PURE__ */ new Set();
    const wsNodes = nodes.filter((n) => wsNodeIds.has(n.id));
    if (wsNodes.length === 0) continue;
    const wsRoots = wsNodes.filter((n) => !parentMap.has(n.id) || !wsNodeIds.has(parentMap.get(n.id)));
    wsRoots.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const depths = /* @__PURE__ */ new Map();
    for (const root of wsRoots) {
      if (!depths.has(root.id)) assignDepth2(root.id, 0);
    }
    for (const root of wsRoots) {
      let collectTree2 = function(id) {
        if (visitedTree.has(id)) return;
        visitedTree.add(id);
        treeNodeIds.push(id);
        const kids = (childrenMap.get(id) || []).filter((k) => wsNodeIds.has(k));
        for (const kid of kids) collectTree2(kid);
      };
      var collectTree = collectTree2;
      const visitedTree = /* @__PURE__ */ new Set();
      const treeNodeIds = [];
      collectTree2(root.id);
      const byDepth = /* @__PURE__ */ new Map();
      for (const id of treeNodeIds) {
        const d = depths.get(id) || 0;
        if (!byDepth.has(d)) byDepth.set(d, []);
        byDepth.get(d).push(id);
      }
      for (const [d, rowIds] of byDepth.entries()) {
        rowIds.forEach((id, idx) => {
          const autoX = 120 + d * 360;
          const autoY = currentY + idx * 170;
          positions[id] = savedPositions && savedPositions[id] ? savedPositions[id] : { x: autoX, y: autoY };
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
  for (const node of nodes) {
    if (!positions[node.id]) {
      positions[node.id] = savedPositions && savedPositions[node.id] ? savedPositions[node.id] : { x: 120, y: currentY };
      currentY += 170;
    }
  }
  return positions;
}
function ADENodeGraphCanvas(props) {
  const {
    sessionsSnapshot,
    currentSessionId,
    layoutSessionIds,
    onOpenSession,
    onSplitSession,
    onForkSession,
    renderSlot,
    SessionProvider,
    ensureReference: ensureReference2,
    workspaceOf: workspaceOf2
  } = props;
  const layoutIds = Array.isArray(layoutSessionIds) ? layoutSessionIds.filter((id) => id && typeof id === "string") : [];
  const layoutIdSet = (0, import_react.useMemo)(() => new Set(layoutIds), [layoutIds.join("\0")]);
  const [savedPositions, setSavedPositions] = (0, import_react.useState)(() => getStoredPositions());
  const [transform, setTransform] = (0, import_react.useState)({ x: 50, y: 50, k: 0.88 });
  const [selectedNodeId, setSelectedNodeId] = (0, import_react.useState)(currentSessionId || null);
  const [expandedChatNodeIds, setExpandedChatNodeIds] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [closingChatNodeIds, setClosingChatNodeIds] = (0, import_react.useState)(() => /* @__PURE__ */ new Set());
  const [filterMode, setFilterMode] = (0, import_react.useState)(() => layoutIds.length >= 2 ? "layout" : "all");
  const [searchQuery, setSearchQuery] = (0, import_react.useState)("");
  const containerRef = (0, import_react.useRef)(null);
  const isPanningRef = (0, import_react.useRef)(false);
  const panStartRef = (0, import_react.useRef)({ x: 0, y: 0 });
  const draggingNodeRef = (0, import_react.useRef)(null);
  const dragOffsetRef = (0, import_react.useRef)({ x: 0, y: 0 });
  const draggingGroupRef = (0, import_react.useRef)(null);
  const graphData = (0, import_react.useMemo)(() => {
    return extractLineageGraph(sessionsSnapshot, workspaceOf2);
  }, [sessionsSnapshot, workspaceOf2]);
  const positions = (0, import_react.useMemo)(() => {
    return computeGraphLayout(graphData.nodes, graphData.edges, graphData.workspaces, savedPositions);
  }, [graphData.nodes, graphData.edges, graphData.workspaces, savedPositions]);
  const layoutNodeIds = (0, import_react.useMemo)(() => {
    if (layoutIdSet.size === 0) return layoutIdSet;
    const childrenOf = /* @__PURE__ */ new Map();
    for (const edge of graphData.edges) {
      if (!childrenOf.has(edge.from)) childrenOf.set(edge.from, []);
      childrenOf.get(edge.from).push(edge.to);
    }
    const out = new Set(layoutIdSet);
    const stack = [...layoutIdSet];
    while (stack.length > 0) {
      const parentId = stack.pop();
      for (const childId of childrenOf.get(parentId) || []) {
        if (out.has(childId)) continue;
        out.add(childId);
        stack.push(childId);
      }
    }
    return out;
  }, [layoutIdSet, graphData.edges]);
  const visibleNodes = (0, import_react.useMemo)(() => {
    const effectiveFilter = filterMode === "layout" && layoutIds.length === 0 ? "all" : filterMode;
    return graphData.nodes.filter((node) => {
      if (effectiveFilter === "running" && !node.running) return false;
      if (effectiveFilter === "subagents" && !node.isSubagent) return false;
      if (effectiveFilter === "forks" && !node.isFork) return false;
      if (effectiveFilter === "layout" && !layoutNodeIds.has(node.id)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return node.title.toLowerCase().includes(q) || node.id.toLowerCase().includes(q) || node.workspaceTitle.toLowerCase().includes(q);
      }
      return true;
    });
  }, [graphData.nodes, filterMode, searchQuery, layoutNodeIds, layoutIds.length]);
  const visibleNodeIds = (0, import_react.useMemo)(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);
  const visibleEdges = (0, import_react.useMemo)(() => {
    return graphData.edges.filter(
      (e) => visibleNodeIds.has(e.from) && visibleNodeIds.has(e.to)
    );
  }, [graphData.edges, visibleNodeIds]);
  const workspaceBounds = (0, import_react.useMemo)(() => {
    const map = /* @__PURE__ */ new Map();
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
        width: Math.max(maxX - minX + padX * 2, 340),
        height: Math.max(maxY - minY + padTop + padBottom, 200),
        memberNodeIds: memberNodes.map((n) => n.id)
      });
    }
    return map;
  }, [graphData.workspaces, visibleNodes, positions, expandedChatNodeIds]);
  const handleToggleChatExpand = (0, import_react.useCallback)((nodeId) => {
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
  const handleRecenter = (0, import_react.useCallback)(() => {
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
    const graphW = maxX - minX + 120;
    const graphH = maxY - minY + 120;
    const scale = Math.min(Math.max(Math.min((cw - 120) / graphW, (ch - 120) / graphH), 0.35), 1.25);
    const cx = (cw - graphW * scale) / 2 - minX * scale + 60 * scale;
    const cy = (ch - graphH * scale) / 2 - minY * scale + 60 * scale;
    setTransform({ x: Math.round(cx), y: Math.round(cy), k: scale });
  }, [visibleNodes, positions, expandedChatNodeIds]);
  const handleFocusWorkspace = (0, import_react.useCallback)((wsId) => {
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
  const handleResetLayout = (0, import_react.useCallback)(() => {
    storePositions({});
    setSavedPositions({});
    setTimeout(handleRecenter, 50);
  }, [handleRecenter]);
  const handleMouseDown = (e) => {
    if (e.target.closest("[data-node-card]") || e.target.closest("[data-blueprint-header]") || e.target.closest("[data-graph-toolbar]") || e.target.closest("[data-graph-drawer]")) {
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
        [nodeId]: { x: Math.round(nx), y: Math.round(ny) }
      }));
      return;
    }
    if (isPanningRef.current) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y
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
      y: clickWorldY - pos.y
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
      initialPositions
    };
  };
  const selectedNode = (0, import_react.useMemo)(() => {
    return graphData.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graphData.nodes, selectedNodeId]);
  return import_react.default.createElement(
    "div",
    {
      ref: containerRef,
      style: {
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "oklch(0.12 0.012 260)",
        userSelect: "none",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      },
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp,
      onWheel: handleWheel
    },
    import_react.default.createElement("div", {
      style: {
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(oklch(0.3 0.02 260) 1px, transparent 1px)",
        backgroundSize: `${24 * transform.k}px ${24 * transform.k}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        opacity: 0.65,
        pointerEvents: "none"
      }
    }),
    import_react.default.createElement(
      "div",
      {
        "data-graph-toolbar": "",
        style: {
          position: "absolute",
          top: 12,
          left: 12,
          right: 12,
          height: 40,
          background: "oklch(0.16 0.018 260 / 0.92)",
          backdropFilter: "blur(12px)",
          border: "1px solid oklch(0.28 0.02 260)",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          zIndex: 40,
          boxShadow: "0 4px 16px rgba(0,0,0,0.3)"
        }
      },
      import_react.default.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 10 } },
        import_react.default.createElement(
          "span",
          {
            style: {
              fontSize: 12.5,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: "oklch(0.96 0.005 260)",
              display: "flex",
              alignItems: "center",
              gap: 6
            }
          },
          import_react.default.createElement("span", { style: { color: "oklch(0.68 0.16 250)" } }, "\u25C6"),
          "Session Lineage Canvas"
        ),
        import_react.default.createElement(
          "span",
          {
            style: {
              fontSize: 10.5,
              padding: "2px 8px",
              borderRadius: 999,
              background: "oklch(0.22 0.02 260)",
              color: "oklch(0.75 0.02 260)",
              fontVariantNumeric: "tabular-nums"
            }
          },
          filterMode === "layout" ? `${visibleNodes.length} nodes in layout \u2022 ${layoutIds.length} panes + ${Math.max(layoutNodeIds.size - layoutIds.length, 0)} linked branches` : `${visibleNodes.length} nodes \u2022 ${graphData.workspaces.length} workspace groups`
        )
      ),
      import_react.default.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 6 } },
        [
          ...layoutIds.length > 0 ? [{ id: "layout", label: `Layout ${layoutIds.length}`, title: "Only sessions mounted in the active multi-pane layout plus their linked subagents and forks" }] : [],
          { id: "all", label: "All" },
          { id: "running", label: "Running" },
          { id: "subagents", label: "Subagents" },
          { id: "forks", label: "Forks" }
        ].map((filter) => {
          const active = filterMode === filter.id;
          return import_react.default.createElement(
            "button",
            {
              key: filter.id,
              type: "button",
              title: filter.title,
              "data-ade-graph-filter": filter.id,
              onClick: () => setFilterMode(filter.id),
              style: {
                background: active ? "oklch(0.28 0.04 250)" : "transparent",
                border: active ? "1px solid oklch(0.45 0.1 250)" : "1px solid transparent",
                color: active ? "oklch(0.98 0.01 250)" : "oklch(0.65 0.02 260)",
                borderRadius: 5,
                padding: "3px 8px",
                fontSize: 11,
                fontWeight: active ? 600 : 500,
                cursor: "pointer"
              }
            },
            filter.label
          );
        }),
        import_react.default.createElement("input", {
          type: "text",
          placeholder: "Filter sessions or workspaces...",
          value: searchQuery,
          onChange: (e) => setSearchQuery(e.target.value),
          style: {
            background: "oklch(0.12 0.01 260)",
            border: "1px solid oklch(0.26 0.02 260)",
            color: "oklch(0.92 0.01 260)",
            borderRadius: 5,
            padding: "3px 8px",
            fontSize: 11,
            width: 170,
            outline: "none"
          }
        })
      ),
      import_react.default.createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 6 } },
        import_react.default.createElement(
          "button",
          {
            type: "button",
            title: "Recenter canvas to fit all nodes",
            onClick: handleRecenter,
            style: {
              background: "oklch(0.22 0.02 260)",
              border: "1px solid oklch(0.3 0.02 260)",
              color: "oklch(0.85 0.01 260)",
              borderRadius: 5,
              padding: "3px 8px",
              fontSize: 11,
              cursor: "pointer"
            }
          },
          "Fit View"
        ),
        import_react.default.createElement(
          "button",
          {
            type: "button",
            title: "Reset layout to default workspace clustering",
            onClick: handleResetLayout,
            style: {
              background: "oklch(0.22 0.02 260)",
              border: "1px solid oklch(0.3 0.02 260)",
              color: "oklch(0.85 0.01 260)",
              borderRadius: 5,
              padding: "3px 8px",
              fontSize: 11,
              cursor: "pointer"
            }
          },
          "Reset Layout"
        ),
        import_react.default.createElement(
          "span",
          {
            style: {
              fontSize: 10.5,
              color: "oklch(0.55 0.02 260)",
              minWidth: 42,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums"
            }
          },
          `${Math.round(transform.k * 100)}%`
        )
      )
    ),
    import_react.default.createElement(
      "div",
      {
        style: {
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: "100%",
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: "0 0",
          willChange: "transform"
        }
      },
      Array.from(workspaceBounds.entries()).map(([wsId, b]) => {
        const { ws, x, y, width, height, memberNodeIds } = b;
        const pal = ws.palette;
        return import_react.default.createElement(
          "div",
          {
            key: `blueprint-${wsId}`,
            "data-blueprint-group": wsId,
            style: {
              position: "absolute",
              left: x,
              top: y,
              width,
              height,
              background: pal.boxBg,
              border: `1.5px solid ${pal.boxBorder}`,
              borderRadius: 8,
              boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              zIndex: 1,
              pointerEvents: "auto"
            }
          },
          import_react.default.createElement(
            "div",
            {
              "data-blueprint-header": wsId,
              title: "Drag header to move entire workspace group. Double click to fit.",
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
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 12px",
                cursor: "grab",
                userSelect: "none"
              }
            },
            import_react.default.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 8, overflow: "hidden" } },
              import_react.default.createElement(
                "span",
                {
                  style: {
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    color: pal.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }
                },
                `// Workspace: ${ws.title}`
              ),
              ws.path ? import_react.default.createElement(
                "span",
                {
                  style: {
                    fontSize: 10,
                    opacity: 0.72,
                    fontFamily: "ui-monospace, monospace",
                    color: pal.text,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 260
                  }
                },
                `(${ws.path})`
              ) : null
            ),
            import_react.default.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 6, flexShrink: 0 } },
              import_react.default.createElement(
                "span",
                {
                  style: {
                    fontSize: 10,
                    fontWeight: 600,
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: pal.badgeBg,
                    color: pal.text,
                    fontVariantNumeric: "tabular-nums"
                  }
                },
                `${memberNodeIds.length} sessions`
              ),
              import_react.default.createElement(
                "button",
                {
                  type: "button",
                  title: "Fit this workspace in viewport",
                  onClick: (e) => {
                    e.stopPropagation();
                    handleFocusWorkspace(wsId);
                  },
                  style: {
                    background: "transparent",
                    border: `1px solid ${pal.headerBorder}`,
                    color: pal.text,
                    borderRadius: 4,
                    padding: "1px 5px",
                    fontSize: 10,
                    cursor: "pointer"
                  }
                },
                "Focus"
              )
            )
          )
        );
      }),
      import_react.default.createElement(
        "svg",
        {
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            width: 8e3,
            height: 8e3,
            pointerEvents: "none",
            overflow: "visible",
            zIndex: 10
          }
        },
        import_react.default.createElement(
          "defs",
          null,
          import_react.default.createElement(
            "marker",
            { id: "ade-wire-arrow", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" },
            import_react.default.createElement("path", { d: "M 0 1.5 L 8 5 L 0 8.5 z", fill: "oklch(0.42 0.04 260)" })
          ),
          import_react.default.createElement(
            "marker",
            { id: "ade-wire-arrow-subagent", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" },
            import_react.default.createElement("path", { d: "M 0 1.5 L 8 5 L 0 8.5 z", fill: "oklch(0.68 0.16 160)" })
          ),
          import_react.default.createElement(
            "marker",
            { id: "ade-wire-arrow-fork", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" },
            import_react.default.createElement("path", { d: "M 0 1.5 L 8 5 L 0 8.5 z", fill: "oklch(0.68 0.16 300)" })
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
          let strokeColor = "oklch(0.42 0.04 260)";
          let marker = "url(#ade-wire-arrow)";
          if (edge.isSubagent) {
            strokeColor = edge.communicating ? "oklch(0.72 0.17 145)" : edge.running ? "oklch(0.72 0.17 145)" : "oklch(0.55 0.12 160)";
            marker = "url(#ade-wire-arrow-subagent)";
          } else if (edge.isFork) {
            strokeColor = "oklch(0.6 0.14 300)";
            marker = "url(#ade-wire-arrow-fork)";
          }
          const communicate = Boolean(edge.communicating);
          const wirePath = import_react.default.createElement("path", {
            d,
            fill: "none",
            stroke: strokeColor,
            strokeWidth: communicate ? 2.5 : edge.running ? 2.5 : 1.8,
            strokeDasharray: communicate ? "7 7" : edge.running ? "6 6" : void 0,
            markerEnd: marker,
            "data-ade-wire": "",
            style: {
              transition: "d 280ms cubic-bezier(0.2, 0.9, 0.3, 1)",
              animation: communicate ? "adeWireStream 0.55s linear infinite" : edge.running ? "adeFlowPulse 1.2s linear infinite" : void 0
            }
          });
          if (!communicate) {
            return import_react.default.createElement("g", { key: edge.id }, wirePath);
          }
          const glowPath = import_react.default.createElement("path", {
            d,
            fill: "none",
            stroke: "oklch(0.52 0.2 145)",
            strokeWidth: 9,
            strokeLinecap: "round",
            opacity: 0.14,
            style: {
              transition: "d 280ms cubic-bezier(0.2, 0.9, 0.3, 1)",
              filter: "blur(4px)"
            }
          });
          const packet1 = import_react.default.createElement(
            "circle",
            { r: 5, fill: "oklch(0.85 0.18 160)", style: { filter: "drop-shadow(0 0 6px rgba(52, 211, 153, 0.9))" } },
            import_react.default.createElement(
              "animateMotion",
              {
                dur: "1.6s",
                repeatCount: "indefinite",
                path: d,
                calcMode: "linear",
                keyPoints: "0;1",
                keyTimes: "0;1"
              }
            )
          );
          const packet2 = import_react.default.createElement(
            "circle",
            { r: 3.2, fill: "oklch(0.97 0.03 160)", opacity: 0.85 },
            import_react.default.createElement(
              "animateMotion",
              {
                dur: "1.6s",
                begin: "0.8s",
                repeatCount: "indefinite",
                path: d,
                calcMode: "linear",
                keyPoints: "0;1",
                keyTimes: "0;1"
              }
            )
          );
          return import_react.default.createElement(
            "g",
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
        let badgeBg = "oklch(0.24 0.02 260)";
        let badgeFg = "oklch(0.7 0.02 260)";
        let badgeText = "ROOT";
        if (node.isSubagent) {
          badgeBg = "oklch(0.24 0.06 160 / 0.4)";
          badgeFg = "oklch(0.75 0.15 160)";
          badgeText = "SUBAGENT";
        } else if (node.isFork) {
          badgeBg = "oklch(0.24 0.08 300 / 0.4)";
          badgeFg = "oklch(0.75 0.18 300)";
          badgeText = "FORK";
        }
        if (layoutIdSet.has(node.id)) {
          badgeBg = "oklch(0.26 0.07 85 / 0.5)";
          badgeFg = "oklch(0.82 0.13 85)";
          badgeText = node.isSubagent ? "PANE \xB7 SUBAGENT" : node.isFork ? "PANE \xB7 FORK" : "PANE";
        }
        const sessionRef = isExpanded && ensureReference2 ? ensureReference2(node.id) : null;
        return import_react.default.createElement(
          "div",
          {
            key: node.id,
            "data-node-card": node.id,
            style: {
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: isExpanded ? CARD_WIDTH_EXPANDED : CARD_WIDTH_COMPACT,
              height: isExpanded ? CARD_HEIGHT_EXPANDED : CARD_HEIGHT_COMPACT,
              background: isSelected ? "oklch(0.2 0.025 250)" : "oklch(0.16 0.018 260)",
              border: isSelected ? "1.5px solid oklch(0.65 0.16 240)" : node.running ? "1.5px solid oklch(0.68 0.18 145)" : isCurrent ? "1.5px solid oklch(0.48 0.12 240)" : "1px solid oklch(0.28 0.02 260)",
              boxShadow: isSelected ? "0 8px 24px rgba(79, 120, 255, 0.25)" : node.running ? "0 0 16px rgba(34, 197, 94, 0.2)" : "0 4px 14px rgba(0,0,0,0.3)",
              borderRadius: 8,
              padding: isExpanded ? 0 : "8px 10px",
              display: "flex",
              flexDirection: "column",
              userSelect: "none",
              zIndex: isSelected ? 30 : isExpanded ? 25 : 20,
              cursor: "default",
              overflow: "hidden",
              transition: "width 280ms cubic-bezier(0.2, 0.9, 0.3, 1), height 280ms cubic-bezier(0.2, 0.9, 0.3, 1), padding 280ms cubic-bezier(0.2, 0.9, 0.3, 1), box-shadow 160ms ease, border-color 160ms ease"
            },
            onClick: () => setSelectedNodeId(node.id)
          },
          import_react.default.createElement(
            "div",
            {
              onMouseDown: (e) => handleNodeDragStart(e, node.id),
              style: {
                height: CARD_HEADER_HEIGHT,
                padding: isExpanded ? "0 10px" : "0 2px",
                background: isExpanded ? "oklch(0.19 0.02 260)" : "transparent",
                borderBottom: isExpanded ? "1px solid oklch(0.26 0.02 260)" : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "grab",
                flexShrink: 0
              }
            },
            import_react.default.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 } },
              import_react.default.createElement(
                "span",
                {
                  style: {
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                    padding: "2px 5px",
                    borderRadius: 3,
                    background: badgeBg,
                    color: badgeFg,
                    flexShrink: 0
                  }
                },
                badgeText
              ),
              import_react.default.createElement(
                "span",
                {
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    fontFamily: "ui-monospace, monospace",
                    color: node.running ? "oklch(0.72 0.17 145)" : "oklch(0.6 0.02 260)",
                    flexShrink: 0
                  }
                },
                import_react.default.createElement("span", {
                  style: {
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: node.running ? "oklch(0.72 0.17 145)" : "oklch(0.45 0.02 260)",
                    boxShadow: node.running ? "0 0 6px oklch(0.72 0.17 145)" : void 0
                  }
                }),
                node.running ? "RUN" : "IDLE"
              ),
              import_react.default.createElement(
                "span",
                {
                  title: node.title,
                  style: {
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "oklch(0.96 0.005 260)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: isExpanded ? 240 : 120
                  }
                },
                node.title
              )
            ),
            import_react.default.createElement(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 4, flexShrink: 0 } },
              import_react.default.createElement(
                "button",
                {
                  type: "button",
                  title: isExpanded ? "Collapse native chat" : "Expand native chat inside node",
                  onClick: (e) => {
                    e.stopPropagation();
                    handleToggleChatExpand(node.id);
                  },
                  style: {
                    background: isExpanded ? "oklch(0.35 0.12 250)" : "oklch(0.24 0.02 260)",
                    border: "1px solid oklch(0.35 0.05 250)",
                    color: isExpanded ? "#ffffff" : "oklch(0.9 0.01 260)",
                    borderRadius: 3,
                    padding: "2px 6px",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 3
                  }
                },
                isExpanded ? "\u2921 Fold" : "\u{1F4AC} Chat"
              ),
              import_react.default.createElement(
                "button",
                {
                  type: "button",
                  title: "Split into multi-pane layout",
                  onClick: (e) => {
                    e.stopPropagation();
                    if (onSplitSession) onSplitSession(node.id);
                  },
                  style: {
                    background: "oklch(0.24 0.02 260)",
                    border: "1px solid oklch(0.3 0.02 260)",
                    color: "oklch(0.85 0.01 260)",
                    borderRadius: 3,
                    padding: "2px 5px",
                    fontSize: 10,
                    cursor: "pointer"
                  }
                },
                "Split"
              ),
              import_react.default.createElement(
                "button",
                {
                  type: "button",
                  title: "Open conversation view",
                  onClick: (e) => {
                    e.stopPropagation();
                    if (onOpenSession) onOpenSession(node.id);
                  },
                  style: {
                    background: "oklch(0.24 0.02 260)",
                    border: "1px solid oklch(0.3 0.02 260)",
                    color: "oklch(0.85 0.01 260)",
                    borderRadius: 3,
                    padding: "2px 5px",
                    fontSize: 10,
                    cursor: "pointer"
                  }
                },
                "Open \u2197"
              )
            )
          ),
          showChat ? import_react.default.createElement(
            "div",
            {
              "data-ade-node-chat": "",
              style: {
                flex: 1,
                minHeight: 0,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                background: "oklch(0.14 0.015 260)",
                position: "relative",
                overflow: "hidden",
                opacity: isClosing ? 1 : 1,
                transform: isClosing ? "translateY(0) scale(1)" : "translateY(0) scale(1)",
                animation: isClosing ? "adeChatFoldOut 240ms cubic-bezier(0.2, 0.9, 0.3, 1) both" : "adeChatFoldIn 260ms cubic-bezier(0.2, 0.9, 0.3, 1) both",
                pointerEvents: isClosing ? "none" : "auto"
              },
              onMouseDown: (e) => e.stopPropagation(),
              onWheel: (e) => e.stopPropagation()
            },
            SessionProvider && renderSlot && sessionRef ? import_react.default.createElement(
              SessionProvider,
              { session: sessionRef },
              renderSlot("main.conversation", {})
            ) : import_react.default.createElement(
              "div",
              {
                style: {
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "oklch(0.6 0.02 260)",
                  fontSize: 11,
                  padding: 20
                }
              },
              "Initializing native chat viewport..."
            )
          ) : import_react.default.createElement(
            "div",
            { style: { marginTop: 4, display: "flex", flexDirection: "column", gap: 4 } },
            import_react.default.createElement(
              "div",
              {
                title: node.title,
                style: {
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "oklch(0.96 0.005 260)",
                  lineHeight: 1.35,
                  maxHeight: 32,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical"
                }
              },
              node.title
            ),
            import_react.default.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderTop: "1px solid oklch(0.24 0.018 260)",
                  paddingTop: 5,
                  fontSize: 10,
                  color: "oklch(0.55 0.02 260)",
                  fontFamily: "ui-monospace, monospace"
                }
              },
              import_react.default.createElement("span", null, node.id.slice(0, 8)),
              import_react.default.createElement(
                "span",
                {
                  style: {
                    color: "oklch(0.68 0.1 250)",
                    cursor: "pointer",
                    textDecoration: "underline"
                  },
                  onClick: (e) => {
                    e.stopPropagation();
                    handleToggleChatExpand(node.id);
                  }
                },
                "Expand Live Chat \u203A"
              )
            )
          )
        );
      })
    ),
    selectedNode ? import_react.default.createElement(
      "div",
      {
        "data-graph-drawer": "",
        style: {
          position: "absolute",
          bottom: 14,
          right: 14,
          width: 320,
          background: "oklch(0.16 0.018 260 / 0.95)",
          backdropFilter: "blur(14px)",
          border: "1px solid oklch(0.3 0.02 260)",
          borderRadius: 8,
          padding: 12,
          zIndex: 50,
          boxShadow: "0 8px 28px rgba(0,0,0,0.4)"
        }
      },
      import_react.default.createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
        import_react.default.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: "oklch(0.96 0.005 260)" } }, "Session Node Details"),
        import_react.default.createElement(
          "button",
          {
            type: "button",
            onClick: () => setSelectedNodeId(null),
            style: {
              background: "transparent",
              border: "none",
              color: "oklch(0.6 0.02 260)",
              cursor: "pointer",
              fontSize: 14,
              padding: 2
            }
          },
          "\xD7"
        )
      ),
      import_react.default.createElement("div", { style: { fontSize: 11.5, fontWeight: 600, color: "oklch(0.9 0.01 260)", marginBottom: 4 } }, selectedNode.title),
      import_react.default.createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 3, fontSize: 10, fontFamily: "ui-monospace, monospace", color: "oklch(0.65 0.02 260)", marginBottom: 8 } },
        import_react.default.createElement("div", null, `ID: ${selectedNode.id}`),
        import_react.default.createElement("div", null, `Workspace: ${selectedNode.workspaceTitle}`),
        import_react.default.createElement("div", null, `Origin: ${selectedNode.origin}`),
        selectedNode.parentId ? import_react.default.createElement("div", null, `Parent: ${selectedNode.parentId}`) : null,
        import_react.default.createElement("div", null, `Status: ${selectedNode.running ? "RUNNING" : "IDLE"}`)
      ),
      import_react.default.createElement(
        "div",
        { style: { display: "flex", gap: 6 } },
        import_react.default.createElement(
          "button",
          {
            type: "button",
            onClick: () => handleToggleChatExpand(selectedNode.id),
            style: {
              flex: 1,
              background: expandedChatNodeIds.has(selectedNode.id) ? "oklch(0.35 0.12 250)" : "oklch(0.24 0.02 260)",
              border: "1px solid oklch(0.35 0.05 250)",
              color: "#ffffff",
              borderRadius: 4,
              padding: "4px 0",
              fontSize: 10.5,
              fontWeight: 600,
              cursor: "pointer"
            }
          },
          expandedChatNodeIds.has(selectedNode.id) ? "Collapse Chat" : "Expand Chat"
        ),
        import_react.default.createElement(
          "button",
          {
            type: "button",
            onClick: () => onSplitSession && onSplitSession(selectedNode.id),
            style: {
              flex: 1,
              background: "oklch(0.22 0.02 260)",
              border: "1px solid oklch(0.32 0.02 260)",
              color: "oklch(0.9 0.01 260)",
              borderRadius: 4,
              padding: "4px 0",
              fontSize: 10.5,
              cursor: "pointer"
            }
          },
          "Split View"
        ),
        import_react.default.createElement(
          "button",
          {
            type: "button",
            onClick: () => onOpenSession && onOpenSession(selectedNode.id),
            style: {
              flex: 1,
              background: "oklch(0.22 0.02 260)",
              border: "1px solid oklch(0.32 0.02 260)",
              color: "oklch(0.9 0.01 260)",
              borderRadius: 4,
              padding: "4px 0",
              fontSize: 10.5,
              cursor: "pointer"
            }
          },
          "Open"
        )
      )
    ) : null
  );
}

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
function replaceNodePaneId(node, oldId, newId) {
  if (!node) return null;
  if (node.kind === "pane") return node.id === oldId ? { kind: "pane", id: newId } : node;
  return { ...node, children: node.children.map((c) => replaceNodePaneId(c, oldId, newId)) };
}
function replaceTreePaneId(tree, oldId, newId) {
  if (!tree || !tree.root || oldId === newId) return tree;
  return { root: replaceNodePaneId(tree.root, oldId, newId) };
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
var SUBAGENT_AUTOSPLIT_KEY = "dsh-ade-subagent-autosplit";
var swarmListeners = /* @__PURE__ */ new Set();
var swarmSnapshot = { stacks: {}, knownIds: /* @__PURE__ */ new Set() };
var swarmSnapshotCache = null;
var knownSubagentIds = /* @__PURE__ */ new Set();
var PINNED_STACK_BY_PARENT = /* @__PURE__ */ new Map();
function getSubagentAutosplitSetting() {
  try {
    if (typeof localStorage === "undefined") return true;
    return localStorage.getItem(SUBAGENT_AUTOSPLIT_KEY) !== "off";
  } catch (_) {
    return true;
  }
}
function setSubagentAutosplitSetting(enabled) {
  try {
    if (typeof localStorage !== "undefined") {
      if (enabled) localStorage.removeItem(SUBAGENT_AUTOSPLIT_KEY);
      else localStorage.setItem(SUBAGENT_AUTOSPLIT_KEY, "off");
    }
  } catch (_) {
  }
  emitSubagentSnapshot();
}
function emitSubagentSnapshot(patch) {
  swarmSnapshotCache = null;
  if (patch) swarmSnapshot = patch;
  for (const fn of swarmListeners) {
    try {
      fn();
    } catch (_) {
    }
  }
}
function getSubagentSnapshot() {
  if (swarmSnapshotCache === null) {
    swarmSnapshotCache = {
      stacks: swarmSnapshot.stacks,
      known: swarmSnapshot.knownIds,
      pinned: PINNED_STACK_BY_PARENT,
      autosplit: getSubagentAutosplitSetting()
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
  try {
    return app.sessions.list.getSnapshot();
  } catch (_) {
    return null;
  }
}
function childEntriesForParent(snapshot, parentId) {
  if (!snapshot || !parentId) return [];
  const byId = snapshot.byId || {};
  const projections = snapshot.projectionsBySession || {};
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const [id, summary] of Object.entries(byId)) {
    if (summary.origin === "subagent" && summary.parentId === parentId) {
      seen.add(id);
      out.push({ id, label: summary.title || summary.label || summary.name || "Subagent", mode: summary.mode || "subagent", running: summary.running === true });
    }
  }
  const projection = projections[parentId];
  const catalog = projection && projection.values ? projection.values.subagentCatalog : null;
  for (const entry of catalog || []) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      out.push({ id: entry.id, label: entry.label || entry.title || "Subagent", mode: entry.mode || "subagent", running: false });
    }
  }
  return out;
}
function subagentParentOf(snapshot, childId) {
  if (!snapshot || !childId) return null;
  const byId = snapshot.byId || {};
  const summary = byId[childId];
  if (summary && summary.origin === "subagent" && summary.parentId) return summary.parentId;
  const projections = snapshot.projectionsBySession || {};
  for (const [parentId, projection] of Object.entries(projections)) {
    const catalog = projection && projection.values ? projection.values.subagentCatalog : null;
    if (Array.isArray(catalog) && catalog.some((entry) => entry.id === childId)) return parentId;
  }
  return null;
}
function refreshSubagentStacks() {
  const snapshot = readSessionsSnapshot();
  const byParent = /* @__PURE__ */ new Map();
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
var ADE_DEBUG = true;
var debugBuffer = [];
var debugVersion = 0;
var debugSubs = /* @__PURE__ */ new Set();
function debugLog(tag, detail) {
  if (!ADE_DEBUG) return;
  let text;
  try {
    text = detail == null ? "" : typeof detail === "string" ? detail : JSON.stringify(detail);
  } catch (_) {
    text = String(detail);
  }
  const entry = { t: Date.now() % 1e6, tag, detail: text };
  debugBuffer.push(entry);
  if (debugBuffer.length > 160) debugBuffer.shift();
  debugVersion += 1;
  try {
    console.log(
      "%c[ADE]%c " + tag + " %c" + text,
      "color:#38bdf8;font-weight:bold",
      "color:inherit",
      "color:#94a3b8"
    );
  } catch (_) {
    console.log("[ADE] " + tag + " " + text);
  }
  for (const cb of debugSubs) {
    try {
      cb(debugVersion);
    } catch (_) {
    }
  }
}
function getDebugSnapshot() {
  return { version: debugVersion, entries: debugBuffer.slice() };
}
if (typeof window !== "undefined") {
  window.__adeDump = () => {
    try {
      console.table(debugBuffer.slice(-40).map((e) => ({ tag: e.tag, detail: e.detail })));
    } catch (_) {
    }
    return getDebugSnapshot();
  };
  window.__adeState = () => state;
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
  const nextPanes = activeIds.map((id) => existingMap.get(id) || { sessionId: id });
  state = {
    tree,
    panes: nextPanes
  };
  emit();
  persistActiveState();
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
    panes: nextPanes
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
    const swappedTree = replaceTreePaneId(state.tree, paneSessionId, otherSibling.id);
    const splitTree = insertOrSplit(swappedTree, childIdToPopOut, otherSibling.id, "right");
    setTree(splitTree);
  } else {
    const splitTree = insertOrSplit(state.tree, childIdToPopOut, paneSessionId, "right");
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
  setTree(insertOrSplit(state.tree, firstChild.id, targetId, "right"));
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
    visibleParents = currentPanes.map((p) => subagentParentOf(snapshot, p.sessionId) || p.sessionId).filter((id) => id);
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
      const pinnedValue = PINNED_STACK_BY_PARENT.get(parentId);
      if (wantsAutoSwitch && pinnedValue !== currentlyShownChild.sessionId) {
        swapSubagentInPane(currentlyShownChild.sessionId, target.id);
      }
    } else if (target && !panesSet.has(target.id)) {
      if (currentPanes.length === 0 && firstId) {
        ensureTree({ root: { kind: "pane", id: firstId } }, [{ sessionId: firstId }]);
      }
      const anchor = panesSet.has(parentId) ? parentId : firstId || parentId;
      if (anchor && panesSet.has(anchor)) {
        ensureReference(target.id);
        setTree(insertOrSplit(state.tree || ensureTree(null, currentPanes), target.id, anchor, "right"));
      }
    }
  }
  refreshSubagentStacks();
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
var subagentRowActionDispose = null;
var graphViewDispose = null;
var graphMainDispose = null;
var expandedSessionIds = /* @__PURE__ */ new Set();
var expandedListeners = /* @__PURE__ */ new Set();
function emitExpandedChange() {
  for (const fn of expandedListeners) {
    try {
      fn();
    } catch (_) {
    }
  }
}
function subscribeExpanded(fn) {
  expandedListeners.add(fn);
  return () => expandedListeners.delete(fn);
}
function toggleExpandedSession(sessionId) {
  if (!sessionId) return;
  if (expandedSessionIds.has(sessionId)) expandedSessionIds.delete(sessionId);
  else expandedSessionIds.add(sessionId);
  emitExpandedChange();
}
function getPortalFn() {
  if (typeof import_react_dom.createPortal === "function") return import_react_dom.createPortal;
  return null;
}
function ensureSubagentRowActionRegistered() {
  refreshHandles();
  if (!app || !app.slots || !app.slots.register) return false;
  try {
    const entries = app.slots.entries("sidebar.workspaces.session.row.action") || [];
    if (entries.some((entry) => entry && entry.options && entry.options.id === "ade-subagent-expander")) return true;
    subagentRowActionDispose = app.slots.register(
      {
        name: "sidebar.workspaces.session.row.action",
        id: "ade-subagent-expander",
        order: 350
      },
      ADESubagentRowExpander
    );
    return true;
  } catch (_) {
    return false;
  }
}
function disposeSubagentRowAction() {
  try {
    subagentRowActionDispose?.();
  } catch (_) {
  }
  subagentRowActionDispose = null;
}
function ADENodeGraphViewWrapper(props) {
  const sessionId = props && props.sessionId ? props.sessionId : currentMainSessionId();
  const sessionsSnapshot = (0, import_react2.useSyncExternalStore)(subscribeSubagent, () => readSessionsSnapshot());
  const layoutPanesSnapshot = (0, import_react2.useSyncExternalStore)(subscribe, getState);
  const layoutSessionIds = import_react2.default.useMemo(() => {
    const tree = layoutPanesSnapshot && layoutPanesSnapshot.tree;
    const panes = layoutPanesSnapshot && layoutPanesSnapshot.panes;
    if (tree) return getTreePaneIds(tree.root);
    if (panes && panes.length > 0) return panes.map((pane) => pane.sessionId).filter(Boolean);
    return [];
  }, [layoutPanesSnapshot]);
  const onOpenSession = (id) => {
    if (!id) return;
    try {
      if (app && app.uiWorkspace && typeof app.uiWorkspace.openSession === "function") {
        app.uiWorkspace.openSession(id);
        return;
      }
    } catch (_) {
    }
    try {
      if (app && app.layout && typeof app.layout.selectPanel === "function") {
        app.layout.selectPanel(null);
      }
    } catch (_) {
    }
  };
  const onSplitSession = (id) => {
    if (!id) return;
    try {
      ensureReference(id);
    } catch (_) {
    }
    const firstId = state.panes && state.panes.length > 0 ? state.panes[0].sessionId : currentMainSessionId();
    const anchor = firstId && firstId !== id ? firstId : null;
    let tree = state.tree && state.tree.root ? state.tree : anchor ? { root: { kind: "pane", id: anchor } } : { root: { kind: "pane", id } };
    if (!anchor) {
      tree = { root: { kind: "pane", id } };
    } else {
      tree = insertOrSplit(tree, id, anchor, "right");
    }
    setTree(tree);
    try {
      if (app && app.layout && typeof app.layout.selectPanel === "function") {
        app.layout.selectPanel(null);
      }
    } catch (_) {
    }
  };
  const onForkSession = (id) => {
    if (!id) return;
    try {
      if (app && app.sessions && typeof app.sessions.fork === "function") {
        app.sessions.fork({ sessionId: id });
      }
    } catch (_) {
    }
  };
  const renderSlot = typeof props.renderSlot === "function" ? props.renderSlot : cachedRenderSlot;
  const SessionProvider = typeof props.SessionProvider === "function" ? props.SessionProvider : cachedSessionProvider;
  return import_react2.default.createElement(ADENodeGraphCanvas, {
    sessionsSnapshot,
    currentSessionId: sessionId,
    layoutSessionIds,
    onOpenSession,
    onSplitSession,
    onForkSession,
    renderSlot,
    SessionProvider,
    ensureReference,
    workspaceOf
  });
}
function ensureGraphViewRegistered() {
  refreshHandles();
  if (!app || !app.slots || !app.slots.register) return false;
  try {
    const entries = app.slots.entries("conversation.view") || [];
    if (entries.some((entry) => entry && entry.options && entry.options.id === "ade-node-graph")) return true;
    graphViewDispose = app.slots.register(
      {
        name: "conversation.view",
        id: "ade-node-graph",
        order: 20,
        label: "Graph"
      },
      ADENodeGraphViewWrapper
    );
    return true;
  } catch (_) {
    return false;
  }
}
function ensureGraphMainRegistered() {
  refreshHandles();
  if (!app || !app.slots || !app.slots.register) return false;
  try {
    const entries = app.slots.entries("main") || [];
    if (entries.some((entry) => entry && entry.options && entry.options.key === "ade-node-graph")) return true;
    graphMainDispose = app.slots.register(
      {
        name: "main",
        key: "ade-node-graph",
        label: "Graph"
      },
      ADENodeGraphViewWrapper
    );
    return true;
  } catch (_) {
    return false;
  }
}
function disposeGraphRegistrations() {
  try {
    graphViewDispose?.();
  } catch (_) {
  }
  try {
    graphMainDispose?.();
  } catch (_) {
  }
  graphViewDispose = null;
  graphMainDispose = null;
}
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
    if (treeIds.length === paneIds.length) {
      const set = new Set(paneIds);
      if (treeIds.every((id) => set.has(id))) {
        debugLog("ensureTree", { action: "keep-rawTree", treeIds, paneIds });
        return rawTree;
      }
    }
  }
  debugLog("ensureTree", { action: "rebuild-fallback", paneIds });
  let tree = { root: { kind: "pane", id: paneIds[0] } };
  for (let i = 1; i < paneIds.length; i++) {
    tree = insertOrSplit(tree, paneIds[i], paneIds[i - 1], "right");
  }
  return tree;
}
var PaneErrorBoundary = class extends import_react2.default.Component {
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
      return import_react2.default.createElement(
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
        import_react2.default.createElement("div", { style: { fontWeight: 600, marginBottom: 8 } }, "Session view crashed"),
        import_react2.default.createElement(
          "div",
          { style: { opacity: 0.8, maxWidth: 360, wordBreak: "break-word", fontSize: 11, marginBottom: 12 } },
          String(this.state.error?.message || this.state.error)
        ),
        import_react2.default.createElement(
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
      @keyframes adeFlowPulse {
        from { stroke-dashoffset: 24; }
        to { stroke-dashoffset: 0; }
      }
      @keyframes adeWireStream {
        from { stroke-dashoffset: 14; }
        to { stroke-dashoffset: 0; }
      }
      @keyframes adeChatFoldIn {
        0% { opacity: 0; transform: translateY(10px) scale(0.97); }
        100% { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes adeChatFoldOut {
        0% { opacity: 1; transform: translateY(0) scale(1); }
        100% { opacity: 0; transform: translateY(8px) scale(0.98); }
      }
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
      /* Subagent expander button on parent session row */
      [data-ade-subagent-expander] {
        display: inline-flex !important;
        align-items: center !important;
        gap: 3px !important;
        height: 18px !important;
        padding: 0 5px !important;
        border-radius: 4px !important;
        background: rgba(255, 255, 255, 0.08) !important;
        border: 1px solid rgba(255, 255, 255, 0.06) !important;
        color: var(--dsw-alias-label-secondary, rgba(255, 255, 255, 0.65)) !important;
        cursor: pointer !important;
        font-size: 11px !important;
        line-height: 1 !important;
        user-select: none !important;
        opacity: 0.85 !important;
        visibility: visible !important;
        margin-left: 2px !important;
        transition: all 140ms ease !important;
        vertical-align: middle !important;
      }
      [data-ade-subagent-expander]:hover {
        opacity: 1 !important;
        background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.16)) !important;
        color: var(--dsw-alias-label-primary, #ffffff) !important;
        border-color: rgba(255, 255, 255, 0.14) !important;
      }
      [data-ade-subagent-expander][data-expanded="true"] {
        background: rgba(79, 120, 255, 0.18) !important;
        border-color: rgba(79, 120, 255, 0.35) !important;
        color: var(--dsw-alias-brand, #7ba0ff) !important;
      }
      [data-ade-subagent-running-dot] {
        display: inline-block !important;
        width: 5px !important;
        height: 5px !important;
        border-radius: 50% !important;
        background: #00d26a !important;
        box-shadow: 0 0 5px rgba(0, 210, 106, 0.8) !important;
        animation: ade-pulse 1.8s infinite !important;
      }
      /* Ensure rowActions container is visible when it contains the subagent expander badge */
      [class*="sessionRow"]:has([data-ade-subagent-expander]) [class*="rowActions"] {
        opacity: 1 !important;
        visibility: visible !important;
      }
      /* Other sibling actions inside rowActions remain hover-only */
[class*="sessionRow"]:has([data-ade-subagent-expander]):not(:hover) [class*="rowActions"] > button:not([data-ade-subagent-expander]) {
        opacity: 0 !important;
        pointer-events: none !important;
      }
      /* Subagent child tree styling in sidebar */
      [data-ade-subagent-children] {
        display: flex !important;
        flex-direction: column !important;
        padding-left: 22px !important;
        margin: 2px 0 4px 0 !important;
        position: relative !important;
      }
      [data-ade-subagent-row] {
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        height: 26px !important;
        padding: 0 8px !important;
        border-radius: var(--dsw-radius-sm, 6px) !important;
        cursor: pointer !important;
        user-select: none !important;
        font-size: 12px !important;
        color: var(--dsw-alias-label-secondary, rgba(255, 255, 255, 0.65)) !important;
        transition: background 100ms ease, color 100ms ease !important;
        position: relative !important;
      }
      [data-ade-subagent-row]:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08)) !important;
        color: var(--dsw-alias-label-primary, #ffffff) !important;
      }
      [data-ade-subagent-row][data-selected="true"] {
        background: rgba(56, 189, 248, 0.12) !important;
        color: #38bdf8 !important;
        font-weight: 600 !important;
      }
      [data-ade-tree-branch] {
        font-family: monospace !important;
        font-size: 11px !important;
        color: var(--dsw-alias-border-l3, rgba(255, 255, 255, 0.22)) !important;
        flex: 0 0 auto !important;
      }
      [data-ade-subagent-dot] {
        width: 6px !important;
        height: 6px !important;
        border-radius: 50% !important;
        flex: 0 0 auto !important;
      }
      [data-ade-subagent-dot="running"] {
        background: #00d26a !important;
        box-shadow: 0 0 6px rgba(0, 210, 106, 0.7) !important;
        animation: ade-pulse 1.8s infinite !important;
      }
      [data-ade-subagent-dot="done"] {
        background: rgba(255, 255, 255, 0.25) !important;
      }
      [data-ade-subagent-title] {
        flex: 1 1 auto !important;
        min-width: 0 !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
      }
      [data-ade-subagent-badge="running"] {
        flex: 0 0 auto !important;
        font-size: 10px !important;
        padding: 1px 4px !important;
        border-radius: 3px !important;
        background: rgba(0, 210, 106, 0.15) !important;
        color: #00d26a !important;
        line-height: 1.2 !important;
      }
      [data-ade-child-split-btn] {
        display: none !important;
        align-items: center !important;
        justify-content: center !important;
        width: 18px !important;
        height: 18px !important;
        padding: 0 !important;
        border-radius: 3px !important;
        background: transparent !important;
        border: none !important;
        color: var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.45)) !important;
        cursor: pointer !important;
      }
      [data-ade-child-split-btn]:hover {
        background: rgba(255, 255, 255, 0.12) !important;
        color: var(--dsw-alias-label-primary, #ffffff) !important;
      }
      [data-ade-subagent-row]:hover [data-ade-child-split-btn] {
        display: inline-flex !important;
      }
      /* Strip native chrome inside expanded node-graph live chat cards.
         The node card itself provides the header/badges, so the native
         conversation header, conversation tabs and breadcrumbs are redundant
         and only consume vertical space inside the small embedded card. */
      [data-ade-node-chat] header,
      [data-ade-node-chat] [data-conversation-tabs],
      [data-ade-node-chat] [data-conversation-header-leading],
      [data-ade-node-chat] header [role="tablist"],
      [data-ade-node-chat] header [class*="breadcrumbs"],
      [data-ade-node-chat] header [class*="crumbs"],
      [data-ade-node-chat] header [class*="crumbSeg"] {
        display: none !important;
      }
      [data-ade-node-chat] {
        border-bottom-left-radius: 8px !important;
        border-bottom-right-radius: 8px !important;
        overflow: hidden !important;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-ade-split] [data-ade-pane],
        [data-ade-split] > [data-ade-divider]::before,
        #dsh-ade-drag-preview,
        [data-ade-wire],
        [data-ade-node-chat],
        [data-node-card] {
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
function adeIcon(type, size) {
  const px = size || 12;
  const style = { flex: "0 0 auto", width: px, height: px };
  const stroke = { stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (type) {
    case "chevron-left":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("path", { d: "M9 2.5 4.5 7l4.5 4.5", ...stroke })
      );
    case "chevron-right":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("path", { d: "M5 2.5 9.5 7 5 11.5", ...stroke })
      );
    case "chevron-down":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("path", { d: "M2.5 5 7 9.5 11.5 5", ...stroke })
      );
    case "close":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("path", { d: "M3 3l8 8M11 3l-8 8", ...stroke })
      );
    case "plus":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("path", { d: "M7 3v8M3 7h8", ...stroke })
      );
    case "zap":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "currentColor", style },
        import_react2.default.createElement("path", { d: "M8 1.5 3 8h3.2l-.8 4.5L11 6H7.8L8 1.5Z" })
      );
    case "diamond":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("path", { d: "M7 2.5l4.5 5L7 11.5 2.5 7.5 7 2.5Z", ...stroke })
      );
    case "check":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("path", { d: "M3 7.5l2.5 2.5L11 4.5", ...stroke })
      );
    case "popout":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("path", { d: "M5.5 3.5h-2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2", ...stroke }),
        import_react2.default.createElement("path", { d: "M9 3.5h1.5v1.5", ...stroke }),
        import_react2.default.createElement("path", { d: "M10.5 3.5 6.5 7.5", ...stroke })
      );
    case "stack":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("path", { d: "M2.5 4.5h9M2.5 7h9M2.5 9.5h9", ...stroke }),
        import_react2.default.createElement("rect", { x: 2.5, y: 2.5, width: 9, height: 9, rx: 1.5, stroke: "currentColor", strokeWidth: 1.3, fill: "none" })
      );
    case "split-rows":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("rect", { x: 1.5, y: 1, width: 11, height: 5.2, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react2.default.createElement("rect", { x: 1.5, y: 7.8, width: 11, height: 5.2, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    case "split-cols":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("rect", { x: 1, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react2.default.createElement("rect", { x: 7.8, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    case "trajectory":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 14 14", fill: "none", style },
        import_react2.default.createElement("circle", { cx: 3, cy: 11, r: 1.5, fill: "currentColor" }),
        import_react2.default.createElement("circle", { cx: 7, cy: 6.5, r: 1.2, fill: "currentColor" }),
        import_react2.default.createElement("circle", { cx: 11, cy: 3, r: 1.5, fill: "currentColor" }),
        import_react2.default.createElement("path", { d: "M3 11 C 3 6.5, 5 6.5, 7 6.5 S 11 6.5, 11 3", ...stroke })
      );
    case "graph":
      return import_react2.default.createElement(
        "svg",
        { width: px, height: px, viewBox: "0 0 24 24", fill: "none", style },
        import_react2.default.createElement("circle", { cx: 5, cy: 6, r: 2, stroke: "currentColor", strokeWidth: 1.3 }),
        import_react2.default.createElement("circle", { cx: 19, cy: 6, r: 2, stroke: "currentColor", strokeWidth: 1.3 }),
        import_react2.default.createElement("circle", { cx: 12, cy: 18, r: 2, stroke: "currentColor", strokeWidth: 1.3 }),
        import_react2.default.createElement("path", { d: "M7 7.5 10.5 16M17 7.5 13.5 16", ...stroke })
      );
    default:
      return null;
  }
}
function renderLayoutIcon(type) {
  switch (type) {
    case "col-2":
      return import_react2.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react2.default.createElement("rect", { x: 1, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react2.default.createElement("rect", { x: 7.8, y: 1.5, width: 5.2, height: 11, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    case "row-2":
      return import_react2.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react2.default.createElement("rect", { x: 1.5, y: 1, width: 11, height: 5.2, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react2.default.createElement("rect", { x: 1.5, y: 7.8, width: 11, height: 5.2, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    case "master-stack-3":
      return import_react2.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react2.default.createElement("rect", { x: 1, y: 1.5, width: 6.2, height: 11, rx: 1.5, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react2.default.createElement("rect", { x: 8.5, y: 1.5, width: 4.5, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react2.default.createElement("rect", { x: 8.5, y: 7.5, width: 4.5, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    case "quad-4":
      return import_react2.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react2.default.createElement("rect", { x: 1, y: 1.5, width: 5.2, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react2.default.createElement("rect", { x: 7.8, y: 1.5, width: 5.2, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react2.default.createElement("rect", { x: 1, y: 7.5, width: 5.2, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 }),
        import_react2.default.createElement("rect", { x: 7.8, y: 7.5, width: 5.2, height: 5, rx: 1.2, stroke: "currentColor", strokeWidth: 1.2, fill: "currentColor", fillOpacity: 0.18 })
      );
    default:
      return import_react2.default.createElement(
        "svg",
        { width: 13, height: 13, viewBox: "0 0 14 14", fill: "none", style: { flex: "0 0 auto" } },
        import_react2.default.createElement("rect", { x: 1, y: 1, width: 12, height: 12, rx: 2, stroke: "currentColor", strokeWidth: 1.2, strokeDasharray: "2 1.5" }),
        import_react2.default.createElement("path", { d: "M7 3v8M3 7h8", stroke: "currentColor", strokeWidth: 1, opacity: 0.6 })
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
  const [collapsed, setCollapsed] = import_react2.default.useState(false);
  const [isNaming, setIsNaming] = import_react2.default.useState(false);
  const [nameInput, setNameInput] = import_react2.default.useState("");
  const inputRef = import_react2.default.useRef(null);
  const snap = (0, import_react2.useSyncExternalStore)(subscribe, getState);
  const layoutSnap = (0, import_react2.useSyncExternalStore)(subscribeLayouts, getLayoutsSnapshot);
  const subagentSnap = (0, import_react2.useSyncExternalStore)(subscribeSubagent, getSubagentSnapshot);
  const { customLayouts } = layoutSnap;
  const presets = getPresetLayouts();
  const panes = snap.panes || [];
  const canSave = panes.length >= 1;
  const autosplit = subagentSnap ? !!subagentSnap.autosplit : true;
  import_react2.default.useEffect(() => {
    if (isNaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isNaming]);
  const handleStartSave = (e) => {
    e.stopPropagation();
    if (!canSave) return;
    const defaultName = panes.length >= 2 ? `Split (${panes.length} panes)` : "Layout";
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
    const trimmed = (nameInput || "").trim() || (panes.length >= 2 ? `Split (${panes.length} panes)` : "Layout");
    saveCustomLayout(trimmed, treeToSave, panes);
    setIsNaming(false);
    setNameInput("");
  };
  const handleCancelSave = (e) => {
    if (e) e.stopPropagation();
    setIsNaming(false);
    setNameInput("");
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
  return import_react2.default.createElement(
    "div",
    { "data-ade-sidebar-layouts": "" },
    import_react2.default.createElement(
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
      import_react2.default.createElement(
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
        import_react2.default.createElement(
          "span",
          { style: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 12, height: 12 } },
          adeIcon(collapsed ? "chevron-right" : "chevron-down", 10)
        ),
        import_react2.default.createElement("span", null, "LAYOUTS"),
        import_react2.default.createElement(
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
          String(customLayouts.length)
        )
      ),
      import_react2.default.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: 2
          }
        },
        import_react2.default.createElement(
          "button",
          {
            type: "button",
            title: "Open lineage graph canvas",
            onClick: (e) => {
              e.stopPropagation();
              try {
                if (app && app.layout && typeof app.layout.selectPanel === "function") {
                  app.layout.selectPanel("ade-node-graph");
                }
              } catch (_) {
              }
            },
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
          import_react2.default.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center" } },
            adeIcon("graph", 11)
          ),
          import_react2.default.createElement("span", null, "Graph")
        ),
        canSave ? import_react2.default.createElement(
          "button",
          {
            type: "button",
            title: isNaming ? "Cancel naming" : "Save current split as a named layout",
            onClick: isNaming ? handleCancelSave : handleStartSave,
            style: {
              background: isNaming ? "rgba(255, 255, 255, 0.1)" : "transparent",
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
          import_react2.default.createElement(
            "span",
            { style: { display: "inline-flex", alignItems: "center" } },
            adeIcon(isNaming ? "close" : "plus", 11)
          ),
          import_react2.default.createElement("span", null, isNaming ? "Cancel" : "Save")
        ) : null
      )
    ),
    !collapsed ? import_react2.default.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 3, marginTop: 4 } },
      isNaming ? import_react2.default.createElement(
        "form",
        {
          "data-ade-save-form": "",
          onSubmit: handleConfirmSave,
          onClick: (e) => e.stopPropagation()
        },
        import_react2.default.createElement("input", {
          ref: inputRef,
          "data-ade-save-input": "",
          type: "text",
          value: nameInput,
          placeholder: "Layout name...",
          onChange: (e) => setNameInput(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Escape") handleCancelSave(e);
          }
        }),
        import_react2.default.createElement(
          "button",
          {
            type: "submit",
            "data-ade-save-confirm": "",
            title: "Save layout"
          },
          "Save"
        ),
        import_react2.default.createElement(
          "button",
          {
            type: "button",
            "data-ade-save-cancel": "",
            title: "Cancel",
            onClick: handleCancelSave
          },
          adeIcon("close", 11)
        )
      ) : null,
      import_react2.default.createElement(
        "div",
        { "data-ade-preset-strip": "", title: "Quick split presets" },
        presets.map((preset) => {
          const isActive = isPresetActive(preset, snap);
          return import_react2.default.createElement(
            "button",
            {
              key: preset.id,
              type: "button",
              "data-ade-preset-btn": "",
              "data-active": isActive ? "true" : void 0,
              onClick: () => handleApplyPreset(preset),
              title: `${preset.name} (${preset.subtitle})`
            },
            renderLayoutIcon(preset.icon)
          );
        })
      ),
      import_react2.default.createElement(
        "div",
        {
          "data-ade-autosplit-row": "",
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 6px",
            margin: "2px 0 4px 0",
            borderRadius: "var(--dsw-radius-sm, 4px)",
            fontSize: 11,
            color: "var(--dsw-alias-label-secondary, rgba(255, 255, 255, 0.65))",
            cursor: "default",
            userSelect: "none"
          }
        },
        import_react2.default.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 6 } },
          import_react2.default.createElement("span", { style: { display: "inline-flex", alignItems: "center", color: autosplit ? "#38bdf8" : "var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.4))" } }, adeIcon("zap", 11)),
          import_react2.default.createElement("span", { style: { fontWeight: 500 } }, "Auto-split Subagents")
        ),
        import_react2.default.createElement(
          "button",
          {
            type: "button",
            title: autosplit ? "Subagents automatically open in a stacked right pane" : "Subagents do not auto-split",
            onClick: (e) => {
              e.stopPropagation();
              setSubagentAutosplitSetting(!autosplit);
            },
            style: {
              background: autosplit ? "rgba(56, 189, 248, 0.16)" : "rgba(255, 255, 255, 0.06)",
              border: `1px solid ${autosplit ? "rgba(56, 189, 248, 0.38)" : "rgba(255, 255, 255, 0.12)"}`,
              color: autosplit ? "#38bdf8" : "var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.45))",
              fontSize: 9.5,
              fontWeight: 700,
              padding: "1px 6px",
              borderRadius: 999,
              cursor: "pointer",
              letterSpacing: "0.04em"
            }
          },
          autosplit ? "ON" : "OFF"
        )
      ),
      customLayouts.length > 0 ? customLayouts.map((layout) => {
        const isActive = isCustomActive(layout, snap);
        const paneCount = layout.panes && layout.panes.length || 0;
        return import_react2.default.createElement(
          "div",
          {
            key: layout.id,
            "data-ade-layout-row": "",
            "data-active": isActive ? "true" : void 0,
            onClick: () => handleApplyCustom(layout),
            title: `${layout.name} (Saved layout with ${paneCount} panes)`
          },
          import_react2.default.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden" } },
            renderLayoutIcon("custom"),
            import_react2.default.createElement(
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
          import_react2.default.createElement(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" } },
            import_react2.default.createElement(
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
            import_react2.default.createElement(
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
              adeIcon("close", 11)
            )
          )
        );
      }) : import_react2.default.createElement(
        "div",
        {
          style: {
            padding: "6px 8px",
            fontSize: 11,
            color: "var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.4))",
            fontStyle: "italic"
          }
        },
        "No saved layouts yet. Click + Save to save current split."
      )
    ) : null
  );
}
function ADESidebarWrapper(props) {
  const orig = originalSidebarWorkspaces;
  return import_react2.default.createElement(
    "div",
    { "data-ade-sidebar-root": "" },
    props.wide !== false ? import_react2.default.createElement(ADELayoutsSection, { wide: props.wide }) : null,
    orig ? import_react2.default.createElement(orig, props) : null
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
  const [elapsed, setElapsed] = import_react2.default.useState(0);
  const startRef = import_react2.default.useRef(0);
  import_react2.default.useEffect(() => {
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
    return import_react2.default.createElement(
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
      import_react2.default.createElement("span", {
        style: {
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#fbbf24",
          boxShadow: "0 0 6px #f59e0b",
          animation: "ade-pulse 1.2s ease-in-out infinite"
        }
      }),
      import_react2.default.createElement("span", { style: { letterSpacing: "0.03em" } }, "RUNNING"),
      import_react2.default.createElement(
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
    return import_react2.default.createElement(
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
      import_react2.default.createElement("span", { style: { display: "inline-flex", alignItems: "center" } }, adeIcon("diamond", 10)),
      import_react2.default.createElement("span", { style: { letterSpacing: "0.03em" } }, "ATTENTION")
    );
  }
  if (isUnread) {
    return import_react2.default.createElement(
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
      import_react2.default.createElement("span", { style: { display: "inline-flex", alignItems: "center" } }, adeIcon("check", 11)),
      import_react2.default.createElement("span", { style: { letterSpacing: "0.03em" } }, "READY")
    );
  }
  return null;
}
function ADEPaneTelemetry(props) {
  if (typeof props.useSessionStatus !== "function") return null;
  return import_react2.default.createElement(ADEPaneTelemetryReader, props);
}
function useSubagentChildStatus(sessionId, useSessionStatus) {
  if (typeof useSessionStatus !== "function") return { running: false, pending: false };
  return useSessionStatus(
    (snapshot) => snapshot && typeof snapshot.get === "function" ? snapshot.get(sessionId) : void 0
  );
}
function ADESubagentChip(props) {
  const { child, active, onSelect, onPopOut, useSessionStatus } = props;
  const status = useSubagentChildStatus(child.id, useSessionStatus);
  const running = !!(status && status.running);
  const pending = !!(status && status.pendingInteraction);
  const dotColor = running ? "#34d399" : pending ? "#f59e0b" : "rgba(255, 255, 255, 0.38)";
  const glowColor = running ? "rgba(52, 211, 153, 0.5)" : pending ? "rgba(245, 158, 11, 0.5)" : "transparent";
  const chipRef = import_react2.default.useRef(null);
  import_react2.default.useEffect(() => {
    if (active && chipRef.current) {
      chipRef.current.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, [active]);
  return import_react2.default.createElement(
    "button",
    {
      key: child.id,
      ref: chipRef,
      type: "button",
      "data-ade-subagent-tab": active ? "active" : "",
      "data-status": running ? "running" : pending ? "pending" : "idle",
      title: child.label || child.id,
      draggable: false,
      onClick: () => onSelect(child.id),
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 24,
        padding: "0 6px",
        borderRadius: 6,
        background: active ? "rgba(56, 189, 248, 0.16)" : "rgba(255, 255, 255, 0.04)",
        border: `1px solid ${active ? "rgba(56, 189, 248, 0.5)" : "rgba(255, 255, 255, 0.08)"}`,
        color: active ? "#e0f2fe" : "var(--dsw-alias-label-tertiary, rgba(255, 255, 255, 0.7))",
        fontSize: 11.5,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        flex: "0 0 auto",
        transition: "background 150ms ease, border-color 150ms ease, color 150ms ease",
        whiteSpace: "nowrap",
        maxWidth: 160,
        boxShadow: active ? "none" : void 0
      }
    },
    import_react2.default.createElement("span", {
      className: "ade-swarm-dot",
      style: {
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: dotColor,
        boxShadow: `0 0 6px ${glowColor}`,
        flex: "0 0 auto"
      }
    }),
    import_react2.default.createElement("span", {
      style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }
    }, child.label || child.id),
    import_react2.default.createElement(ADESubagentKidActions, {
      childId: child.id,
      active,
      onPopOut
    })
  );
}
function ADESubagentKidActions(props) {
  const { childId, active, onPopOut } = props;
  return import_react2.default.createElement(
    "span",
    { style: { display: "inline-flex", gap: 4, marginLeft: 2 } },
    active ? import_react2.default.createElement("button", {
      type: "button",
      title: "Pop this subagent into its own pane",
      style: {
        background: "transparent",
        border: "none",
        color: "rgba(255, 255, 255, 0.6)",
        cursor: "pointer",
        fontSize: 12,
        lineHeight: 1,
        padding: "0 2px",
        borderRadius: 3
      },
      "data-ade-popout": "",
      onClick: (e) => {
        e.stopPropagation();
        onPopOut(childId);
      }
    }, adeIcon("popout", 10)) : null
  );
}
function ADESubagentChildRow(props) {
  const { parentSessionId, child, isLast } = props;
  const isSelected = child.id === currentMainSessionId() || state.panes && state.panes.some((p) => p.sessionId === child.id);
  const handleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (app && app.uiWorkspace && typeof app.uiWorkspace.openSession === "function") {
      try {
        app.uiWorkspace.openSession({
          parentSessionId,
          childSessionId: child.id,
          mode: child.mode
        });
        return;
      } catch (_) {
      }
      try {
        app.uiWorkspace.openSession(child.id);
      } catch (_) {
      }
    }
  };
  const handleSplitAside = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const currentPanes = state.panes && state.panes.length > 0 ? state.panes : [];
    const firstId = currentPanes[0]?.sessionId || parentSessionId;
    ensureReference(child.id);
    const newTree = insertOrSplit(
      state.tree || ensureTree(null, [{ sessionId: firstId }]),
      child.id,
      firstId,
      "right"
    );
    setTree(newTree);
  };
  return import_react2.default.createElement(
    "div",
    {
      "data-ade-subagent-row": "",
      "data-row-key": `session:${child.id}`,
      "data-selected": isSelected ? "true" : "false",
      draggable: true,
      role: "treeitem",
      title: `${child.label} (${child.running ? "running" : "completed"}) \u2014 click to open`,
      onClick: handleOpen,
      onDragStart: (e) => {
        e.stopPropagation();
        if (e.dataTransfer) {
          try {
            e.dataTransfer.effectAllowed = "move";
          } catch (_) {
          }
          try {
            e.dataTransfer.setData("text/plain", child.id);
          } catch (_) {
          }
        }
      }
    },
    import_react2.default.createElement("span", { "data-ade-tree-branch": "" }, isLast ? "\u2514\u2500" : "\u251C\u2500"),
    import_react2.default.createElement("span", {
      "data-ade-subagent-dot": child.running ? "running" : "done"
    }),
    import_react2.default.createElement("span", { "data-ade-subagent-title": "" }, child.label),
    child.running ? import_react2.default.createElement("span", { "data-ade-subagent-badge": "running" }, "running") : null,
    import_react2.default.createElement(
      "button",
      {
        type: "button",
        "data-ade-child-split-btn": "",
        title: "Open in split pane",
        "aria-label": "Open in split pane",
        onClick: handleSplitAside
      },
      adeIcon("split-cols", 11)
    )
  );
}
function ADESubagentChildList(props) {
  const { parentSessionId, children } = props;
  return import_react2.default.createElement(
    "div",
    {
      "data-ade-subagent-children": "",
      "data-parent-id": parentSessionId
    },
    children.map(
      (child, index) => import_react2.default.createElement(ADESubagentChildRow, {
        key: child.id,
        parentSessionId,
        child,
        isLast: index === children.length - 1
      })
    )
  );
}
function ADESubagentRowExpander(props) {
  const sessionId = props.sessionId || props.node && props.node.id;
  if (!sessionId) return null;
  const sessionSnap = (0, import_react2.useSyncExternalStore)(subscribeSubagent, () => readSessionsSnapshot());
  const isExpanded = (0, import_react2.useSyncExternalStore)(subscribeExpanded, () => expandedSessionIds.has(sessionId));
  const children = import_react2.default.useMemo(() => {
    return childEntriesForParent(sessionSnap, sessionId);
  }, [sessionSnap, sessionId]);
  const [hostEl, setHostEl] = import_react2.default.useState(null);
  import_react2.default.useEffect(() => {
    if (!isExpanded || children.length === 0) {
      if (hostEl && hostEl.parentNode) {
        try {
          hostEl.parentNode.removeChild(hostEl);
        } catch (_) {
        }
      }
      setHostEl(null);
      return;
    }
    const syncHost = () => {
      const parentRow = document.querySelector(`[data-row-key="session:${sessionId}"]`);
      if (!parentRow || !parentRow.parentNode) return;
      let host = hostEl;
      if (!host || !host.parentNode || host.previousElementSibling !== parentRow) {
        if (!host) {
          host = document.createElement("div");
          host.setAttribute("data-ade-subagent-host", sessionId);
          host.style.width = "100%";
        }
        parentRow.parentNode.insertBefore(host, parentRow.nextSibling);
        setHostEl(host);
      }
    };
    syncHost();
    const interval = setInterval(syncHost, 1e3);
    return () => {
      clearInterval(interval);
      if (hostEl && hostEl.parentNode) {
        try {
          hostEl.parentNode.removeChild(hostEl);
        } catch (_) {
        }
      }
    };
  }, [isExpanded, sessionId, children.length, hostEl]);
  if (children.length === 0) return null;
  const hasRunning = children.some((c) => c.running);
  const portalFn = getPortalFn();
  const chevronSvg = import_react2.default.createElement(
    "svg",
    {
      width: 10,
      height: 10,
      viewBox: "0 0 10 10",
      fill: "none",
      style: {
        transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 160ms cubic-bezier(0.2, 0.9, 0.3, 1)"
      }
    },
    import_react2.default.createElement("path", {
      d: "M3.5 2L6.5 5L3.5 8",
      stroke: "currentColor",
      strokeWidth: 1.4,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })
  );
  return import_react2.default.createElement(
    import_react2.default.Fragment,
    null,
    import_react2.default.createElement(
      "button",
      {
        type: "button",
        "data-ade-subagent-expander": "",
        "data-expanded": isExpanded ? "true" : "false",
        title: `${children.length} subagent${children.length > 1 ? "s" : ""} (${isExpanded ? "click to collapse" : "click to expand"})`,
        "aria-label": `${children.length} subagents`,
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleExpandedSession(sessionId);
        }
      },
      chevronSvg,
      hasRunning ? import_react2.default.createElement("span", { "data-ade-subagent-running-dot": "" }) : null,
      import_react2.default.createElement("span", { "data-ade-subagent-count": "" }, String(children.length))
    ),
    isExpanded && hostEl && portalFn ? portalFn(
      import_react2.default.createElement(ADESubagentChildList, {
        parentSessionId: sessionId,
        children
      }),
      hostEl
    ) : null
  );
}
function ADESubagentDeck(props) {
  const { parentId, paneSessionId, useSessionStatus } = props;
  const snap = (0, import_react2.useSyncExternalStore)(subscribeSubagent, getSubagentSnapshot);
  const sessionSnapshot = readSessionsSnapshot();
  const children = childEntriesForParent(sessionSnapshot, parentId);
  const pinned = snap.pinned && snap.pinned instanceof Map ? snap.pinned : PINNED_STACK_BY_PARENT;
  const statusSnap = useSessionStatus ? useSessionStatus((s) => s) : null;
  const runningCount = children.reduce((acc, child) => {
    const st = statusSnap && typeof statusSnap.get === "function" ? statusSnap.get(child.id) : void 0;
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
  const trackRef = import_react2.default.useRef(null);
  const [deckScroll, setDeckScroll] = import_react2.default.useState({ left: false, right: false });
  const updateDeckScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setDeckScroll({
      left: el.scrollLeft > 1,
      right: max > 0 && el.scrollLeft < max - 1
    });
  };
  import_react2.default.useEffect(() => {
    const el = trackRef.current;
    if (!el) return void 0;
    const onWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (!delta) return;
      const max = el.scrollWidth - el.clientWidth;
      if (delta < 0 && el.scrollLeft <= 0 || delta > 0 && el.scrollLeft >= max) return;
      e.preventDefault();
      el.scrollLeft += delta;
      updateDeckScroll();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", updateDeckScroll, { passive: true });
    updateDeckScroll();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateDeckScroll) : null;
    if (ro) ro.observe(el);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", updateDeckScroll);
      if (ro) ro.disconnect();
    };
  }, [children.length]);
  const nudgeDeck = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 140, behavior: "smooth" });
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
  return import_react2.default.createElement(
    "div",
    {
      "data-ade-subagent-deck": "",
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 8px 8px",
        background: "rgba(10, 10, 14, 0.35)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        flex: "0 0 auto",
        minHeight: 41,
        boxSizing: "border-box"
      }
    },
    import_react2.default.createElement(
      "div",
      {
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          height: 22,
          padding: "0 7px",
          borderRadius: 999,
          background: runningCount > 0 ? "rgba(52, 211, 153, 0.14)" : "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          flex: "0 0 auto"
        }
      },
      children.length > 0 ? import_react2.default.createElement("span", {
        style: {
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: runningCount > 0 ? "#a7f3d0" : "var(--dsw-alias-label-tertiary, rgba(255,255,255,0.55))"
        }
      }, "SWARM") : null,
      import_react2.default.createElement("span", {
        style: {
          fontSize: 10.5,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: "var(--dsw-alias-label-secondary, rgba(255,255,255,0.8))"
        }
      }, String(children.length))
    ),
    import_react2.default.createElement(
      "div",
      {
        "data-ade-subagent-deck-track": "",
        ref: trackRef,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          overflowX: "auto",
          overflowY: "hidden",
          flex: "1 1 auto",
          minWidth: 0,
          paddingBottom: 4,
          scrollSnapType: "x proximity"
        }
      },
      children.map(
        (child) => import_react2.default.createElement(ADESubagentChip, {
          key: child.id,
          child,
          active: child.id === paneSessionId,
          useSessionStatus,
          onSelect,
          onPopOut
        })
      )
    ),
    deckScroll.left ? import_react2.default.createElement(
      "button",
      {
        type: "button",
        title: "Scroll subagent tabs left",
        draggable: false,
        onClick: () => nudgeDeck(-1),
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          padding: 0,
          borderRadius: 999,
          background: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "rgba(255, 255, 255, 0.75)",
          cursor: "pointer",
          flex: "0 0 auto",
          order: 0
        }
      },
      adeIcon("chevron-left", 11)
    ) : null,
    deckScroll.right ? import_react2.default.createElement(
      "button",
      {
        type: "button",
        title: "Scroll subagent tabs right",
        draggable: false,
        onClick: () => nudgeDeck(1),
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 20,
          height: 20,
          padding: 0,
          borderRadius: 999,
          background: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "rgba(255, 255, 255, 0.75)",
          cursor: "pointer",
          flex: "0 0 auto",
          order: 2
        }
      },
      adeIcon("chevron-right", 11)
    ) : null,
    import_react2.default.createElement(
      "span",
      { style: { display: "inline-flex", alignItems: "center", gap: 4, flex: "0 0 auto", order: 3 } },
      import_react2.default.createElement("button", {
        type: "button",
        title: "Dismiss this subagent stack",
        style: {
          background: "transparent",
          border: "none",
          color: "rgba(255, 255, 255, 0.55)",
          cursor: "pointer",
          fontSize: 15,
          lineHeight: 1,
          padding: "2px 4px",
          borderRadius: 4
        },
        "data-ade-dismiss-deck": "",
        onClick: onDismiss
      }, adeIcon("close", 11))
    )
  );
}
function ADESubagentParentBadge(props) {
  const { parentId, onClick } = props;
  const sessionSnapshot = readSessionsSnapshot();
  const children = childEntriesForParent(sessionSnapshot, parentId);
  if (!children.length) return null;
  return import_react2.default.createElement(
    "button",
    {
      type: "button",
      "data-ade-subagent-badge": "",
      title: `${children.length} subagent${children.length === 1 ? "" : "s"}. Click to open the swarm stack.`,
      draggable: false,
      onClick,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        height: 20,
        padding: "0 7px",
        marginLeft: 2,
        borderRadius: 999,
        background: "rgba(56, 189, 248, 0.14)",
        border: "1px solid rgba(56, 189, 248, 0.35)",
        color: "#bae6fd",
        fontSize: 10.5,
        fontWeight: 700,
        cursor: "pointer",
        flex: "0 0 auto",
        fontVariantNumeric: "tabular-nums"
      }
    },
    adeIcon("stack", 12),
    String(children.length)
  );
}
function ADESplitRoot(props) {
  const renderSlot = typeof props.renderSlot === "function" ? props.renderSlot : cachedRenderSlot;
  const SessionProvider = typeof props.SessionProvider === "function" ? props.SessionProvider : cachedSessionProvider;
  if (props.useSessionStatus) cachedUseSessionStatus = props.useSessionStatus;
  const useSessionStatus = props.useSessionStatus || cachedUseSessionStatus;
  const snap = (0, import_react2.useSyncExternalStore)(subscribe, getState);
  const panes = snap.panes;
  const rawTree = snap.tree;
  const tree = import_react2.default.useMemo(() => ensureTree(rawTree, panes), [rawTree, panes]);
  const geometry = import_react2.default.useMemo(() => computeTreeGeometry(tree ? tree.root : null), [tree]);
  const [draggingDividerId, setDraggingDividerId] = import_react2.default.useState(null);
  const containerRef = import_react2.default.useRef(null);
  const totalPanes = panes.length;
  const [mountedCount, setMountedCount] = import_react2.default.useState(() => totalPanes > 0 ? 1 : 0);
  const mountedRef = import_react2.default.useRef(mountedCount);
  mountedRef.current = mountedCount;
  import_react2.default.useEffect(() => {
    if (totalPanes <= 0) return void 0;
    if (mountedRef.current >= totalPanes) return void 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      mountedRef.current = Math.min(mountedRef.current + 1, totalPanes);
      if (typeof import_react2.default.startTransition === "function") {
        import_react2.default.startTransition(() => setMountedCount(mountedRef.current));
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
  const [metaTick, setMetaTick] = import_react2.default.useState(0);
  import_react2.default.useEffect(() => {
    const unsubSessions = app?.sessions?.list?.subscribe?.(() => setMetaTick((t) => t + 1));
    const unsubWs = (app?.workspaces || app?.uiWorkspace?.workspaces)?.list?.subscribe?.(() => setMetaTick((t) => t + 1));
    return () => {
      unsubSessions?.();
      unsubWs?.();
    };
  }, []);
  import_react2.default.useEffect(() => {
    if (typeof props.renderSlot === "function") cachedRenderSlot = props.renderSlot;
    if (typeof props.SessionProvider === "function") cachedSessionProvider = props.SessionProvider;
    if (typeof props.useSessionStatus === "function") cachedUseSessionStatus = props.useSessionStatus;
  }, [props.renderSlot, props.SessionProvider, props.useSessionStatus]);
  if (panes.length === 0) {
    if (originalConversationPanel) {
      return import_react2.default.createElement(originalConversationPanel, props);
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
  return import_react2.default.createElement(
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
      return import_react2.default.createElement(ADESplitPaneItem, {
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
      return import_react2.default.createElement("div", {
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
  const swarmSnapshot2 = (0, import_react2.useSyncExternalStore)(subscribeSubagent, getSubagentSnapshot);
  void swarmSnapshot2;
  const sessionsSnapshot = readSessionsSnapshot();
  const paneParentId = subagentParentOf(sessionsSnapshot, pane.sessionId);
  const stackChildren = paneParentId ? childEntriesForParent(sessionsSnapshot, paneParentId) : [];
  const parentChildren = !paneParentId ? childEntriesForParent(sessionsSnapshot, pane.sessionId) : [];
  const isImmediatelyOpen = (() => {
    if (idx === 0) return true;
    try {
      return !!(ref && ref.binding && ref.binding.session && ref.binding.session.openState === "open");
    } catch (_) {
      return false;
    }
  })();
  const [isOpen, setIsOpen] = import_react2.default.useState(isImmediatelyOpen);
  const paneElRef = import_react2.default.useRef(null);
  const [viewState, setViewState] = import_react2.default.useState({ hasMultiple: false, isTrajectory: false, isGraph: false });
  const inspectTabs = import_react2.default.useCallback(() => {
    const paneEl = paneElRef.current;
    if (!paneEl) return;
    const tabButtons = Array.from(paneEl.querySelectorAll('[data-conversation-tabs] button[role="tab"], [role="tablist"] button[role="tab"]'));
    const hasMore = !!paneEl.querySelector('[aria-haspopup="menu"]');
    const trajectoryBtn = tabButtons.find((b) => ((b.textContent || "") + " " + (b.getAttribute("aria-label") || "")).toLowerCase().includes("trajectory")) || null;
    const graphBtn = tabButtons.find((b) => ((b.textContent || "") + " " + (b.getAttribute("aria-label") || "")).toLowerCase().includes("graph")) || null;
    const chatBtn = tabButtons.find((b) => /^\s*chat\b/i.test((b.textContent || "").trim())) || tabButtons[0] || null;
    const activeBtn = tabButtons.find((b) => b.getAttribute("aria-selected") === "true") || null;
    const hasMultiple = tabButtons.length > 1 || tabButtons.length >= 1 && hasMore;
    const isTrajectory = trajectoryBtn ? trajectoryBtn.getAttribute("aria-selected") === "true" : activeBtn && activeBtn !== chatBtn;
    const isGraph = graphBtn ? graphBtn.getAttribute("aria-selected") === "true" : false;
    const next = { hasMultiple, isTrajectory: !!isTrajectory, isGraph: !!isGraph };
    setViewState((prev) => prev.hasMultiple === next.hasMultiple && prev.isTrajectory === next.isTrajectory && prev.isGraph === next.isGraph ? prev : next);
  }, [pane.sessionId]);
  import_react2.default.useEffect(() => {
    inspectTabs();
    const paneEl = paneElRef.current;
    if (!paneEl || typeof MutationObserver === "undefined") return void 0;
    const observer = new MutationObserver(() => inspectTabs());
    observer.observe(paneEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-selected", "class"]
    });
    return () => observer.disconnect();
  }, [inspectTabs]);
  const handleToggleTrajectory = () => {
    const paneEl = paneElRef.current;
    if (!paneEl) return;
    const tabButtons = Array.from(paneEl.querySelectorAll('[data-conversation-tabs] button[role="tab"], [role="tablist"] button[role="tab"]'));
    const trajectoryBtn = tabButtons.find((b) => ((b.textContent || "") + " " + (b.getAttribute("aria-label") || "")).toLowerCase().includes("trajectory")) || null;
    const chatBtn = tabButtons.find((b) => /^\s*chat\b/i.test((b.textContent || "").trim())) || tabButtons[0] || null;
    if (trajectoryBtn) {
      if (trajectoryBtn.getAttribute("aria-selected") === "true") {
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
        const target = items.find((el) => (el.textContent || "").toLowerCase().includes("trajectory")) || items[0];
        if (target) target.click();
      }, 80);
    }
  };
  const handleToggleGraph = () => {
    const paneEl = paneElRef.current;
    if (!paneEl) return;
    const tabButtons = Array.from(paneEl.querySelectorAll('[data-conversation-tabs] button[role="tab"], [role="tablist"] button[role="tab"]'));
    const graphBtn = tabButtons.find((b) => ((b.textContent || "") + " " + (b.getAttribute("aria-label") || "")).toLowerCase().includes("graph")) || null;
    const chatBtn = tabButtons.find((b) => /^\s*chat\b/i.test((b.textContent || "").trim())) || tabButtons[0] || null;
    if (graphBtn) {
      if (graphBtn.getAttribute("aria-selected") === "true") {
        if (chatBtn) chatBtn.click();
      } else {
        graphBtn.click();
      }
      inspectTabs();
      return;
    }
    const moreBtn = paneEl.querySelector('button[aria-haspopup="menu"]');
    if (moreBtn && tabButtons.length >= 1) {
      moreBtn.click();
      setTimeout(() => {
        const items = Array.from(document.querySelectorAll('[role="menu"] a, [role="menu"] button, [role="menuitem"], [role="listbox"] button'));
        const target = items.find((el) => (el.textContent || "").toLowerCase().includes("graph")) || items[0];
        if (target) target.click();
      }, 80);
    }
  };
  import_react2.default.useEffect(() => {
    if (isOpen || !mounted) return void 0;
    let active = true;
    if (ref && ref.ready && typeof ref.ready.then === "function") {
      ref.ready.then(() => {
        if (!active) return;
        requestAnimationFrame(() => {
          if (!active) return;
          if (typeof import_react2.default.startTransition === "function") {
            import_react2.default.startTransition(() => setIsOpen(true));
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
  const pendingPlaceholder = import_react2.default.createElement(
    "div",
    { style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--dsw-alias-fg-l2, rgba(255,255,255,0.45))", font: "13px/1.4 system-ui, sans-serif", background: "var(--dsw-alias-bg-base, #1e1e24)" } },
    import_react2.default.createElement("div", { style: { width: 22, height: 22, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.12)", borderTopColor: "var(--dsw-alias-brand, #4f78ff)", animation: "ade-spin 700ms linear infinite" } }),
    import_react2.default.createElement("span", null, "Loading " + title + "...")
  );
  const onHeaderDragStart = (e) => {
    reorderDragFromSessionId = pane.sessionId;
    debugLog("header.dragstart", { source: pane.sessionId, x: e.clientX, y: e.clientY });
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
  return import_react2.default.createElement(
    "div",
    {
      ref: paneElRef,
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
    import_react2.default.createElement(
      "div",
      {
        style: paneHeaderStyle,
        "data-ade-header": "",
        draggable: true,
        onDragStart: onHeaderDragStart,
        onDragEnd: onHeaderDragEnd,
        onDragOver: (e) => e.preventDefault()
      },
      import_react2.default.createElement("span", {
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
      ws?.title ? import_react2.default.createElement(
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
      import_react2.default.createElement("span", { style: paneTitleStyle, draggable: false }, title),
      import_react2.default.createElement(ADEPaneTelemetry, {
        sessionId: pane.sessionId,
        useSessionStatus
      }),
      parentChildren.length > 0 ? import_react2.default.createElement(ADESubagentParentBadge, {
        parentId: pane.sessionId,
        onClick: () => openSubagentStack(pane.sessionId)
      }) : null,
      viewState.hasMultiple ? import_react2.default.createElement("button", {
        type: "button",
        style: {
          ...closeButtonStyle,
          color: viewState.isTrajectory ? "var(--dsw-alias-brand, #4f78ff)" : "var(--dsw-alias-fg-l3, rgba(255,255,255,0.45))"
        },
        "aria-label": viewState.isTrajectory ? "Switch to chat view" : "Switch to trajectory view",
        title: viewState.isTrajectory ? "Show chat" : "Show trajectory",
        "aria-pressed": viewState.isTrajectory,
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: handleToggleTrajectory
      }, adeIcon("trajectory", 12)) : null,
      viewState.hasMultiple ? import_react2.default.createElement("button", {
        type: "button",
        style: {
          ...closeButtonStyle,
          color: viewState.isGraph ? "var(--dsw-alias-brand, #4f78ff)" : "var(--dsw-alias-fg-l3, rgba(255,255,255,0.45))"
        },
        "aria-label": viewState.isGraph ? "Switch to chat view" : "Switch to graph view",
        title: viewState.isGraph ? "Show chat" : "Show graph",
        "aria-pressed": viewState.isGraph,
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: handleToggleGraph
      }, adeIcon("graph", 12)) : null,
      import_react2.default.createElement("button", {
        type: "button",
        style: { ...closeButtonStyle, fontWeight: 700 },
        "aria-label": splitDirection === "col" ? "Split side by side (horizontal)" : "Split stacked (vertical)",
        title: splitDirection === "col" ? "Switch this split to side-by-side" : "Switch this split to stacked",
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: () => togglePaneSplit2(pane.sessionId)
      }, adeIcon(splitDirection === "col" ? "split-cols" : "split-rows", 12)),
      import_react2.default.createElement("button", {
        type: "button",
        style: closeButtonStyle,
        "aria-label": "Close pane",
        draggable: false,
        onDragStart: (e) => e.preventDefault(),
        onClick: () => closePane(pane.sessionId)
      }, adeIcon("close", 12))
    ),
    stackChildren.length > 0 ? import_react2.default.createElement(ADESubagentDeck, {
      parentId: paneParentId,
      paneSessionId: pane.sessionId,
      useSessionStatus
    }) : null,
    import_react2.default.createElement(
      "div",
      { style: { flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" } },
      import_react2.default.createElement(
        import_react2.default.Suspense,
        { fallback: pendingPlaceholder },
        shouldRenderContent ? import_react2.default.createElement(
          PaneErrorBoundary,
          null,
          import_react2.default.createElement(SessionProvider, { session: ref }, renderSlot("main.conversation", {}))
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
  ensureSubagentRowActionRegistered();
  ensureGraphViewRegistered();
  ensureGraphMainRegistered();
  if (pluginCtx && pluginCtx.slots && pluginCtx.slots.subscribe) {
    pluginCtx.slots.subscribe("sidebar.workspaces", ensureSidebarWrapped);
    pluginCtx.slots.subscribe("main", ensureConversationWrapped);
    pluginCtx.slots.subscribe("sidebar.workspaces.session.row.action", ensureSubagentRowActionRegistered);
    pluginCtx.slots.subscribe("conversation.view", ensureGraphViewRegistered);
    pluginCtx.slots.subscribe("main", ensureGraphMainRegistered);
  }
  restorePersistedSplit();
  const seedKnownSubagentIds = () => {
    const snapshot = readSessionsSnapshot();
    if (!snapshot || !snapshot.byId) return;
    for (const [id, summary] of Object.entries(snapshot.byId)) {
      if (summary && summary.origin === "subagent") knownSubagentIds.add(id);
    }
    refreshSubagentStacks();
  };
  seedKnownSubagentIds();
  let subagentUnsub = null;
  if (app && app.sessions && app.sessions.list && app.sessions.list.subscribe) {
    subagentUnsub = app.sessions.list.subscribe(() => {
      try {
        emitSubagentSnapshot();
        reconcileSubagentAutoSplit();
      } catch (err) {
        if (typeof console !== "undefined") console.error("[ADE] subagent reconcile failed", err);
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
      const row = e.target && typeof e.target.closest === "function" ? e.target.closest("[data-row-key]") : null;
      const key = row && row.getAttribute ? row.getAttribute("data-row-key") || "" : "";
      if (!key.startsWith("session:")) return;
      const id = key.slice("session:".length);
      if (!id) return;
      pendingSessionId = id;
      dropHandled = false;
      debugLog("sidebar.dragstart", { id, x: e.clientX, y: e.clientY });
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
    let probeRect = null;
    if (probe) {
      const r = probe.getBoundingClientRect();
      probeRect = r;
      newOverCenter = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }
    overCenter = newOverCenter;
    if (!overCenter) {
      if (currentTargetSessionId !== null) debugLog("dragover.exit", { x: e.clientX, y: e.clientY, probe: probeRect && { left: probeRect.left, top: probeRect.top, right: probeRect.right, bottom: probeRect.bottom } });
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
    debugLog("drop", {
      overCenter,
      target: currentTargetSessionId,
      zone: currentTargetZone,
      reorderSource: reorderDragFromSessionId,
      pending: pendingSessionId,
      x: e.clientX,
      y: e.clientY,
      types: e.dataTransfer && e.dataTransfer.types ? Array.from(e.dataTransfer.types) : []
    });
    hideOverlay();
    if (!overCenter) {
      debugLog("drop.bail", "overCenter=false");
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
        debugLog("drop.bail", { reason: "bad-reorder-target", targetSessionId, sourceId, zone });
        return;
      }
      const currentTree = ensureTree(state.tree, state.panes);
      if (zone === "center") {
        const nextTree = swapTreePanes(currentTree, sourceId, targetSessionId);
        debugLog("drop.swap", { sourceId, targetSessionId });
        setTree(nextTree);
      } else {
        const nextTree = insertOrSplit(currentTree, sourceId, targetSessionId, zone);
        debugLog("drop.move", { sourceId, targetSessionId, zone });
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
    debugLog("dragend", { dropHandled, reorderSource: reorderDragFromSessionId, pending: pendingSessionId });
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
      disposeSubagentRowAction();
      disposeGraphRegistrations();
      if (typeof unsub === "function") unsub();
      if (typeof subagentUnsub === "function") subagentUnsub();
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
    disposeSubagentRowAction();
    disposeGraphRegistrations();
    if (typeof subagentUnsub === "function") subagentUnsub();
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
