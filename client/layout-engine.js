/**
 * Pure-math layout tree engine for ADE Multi-Pane in the browser.
 */

export const MIN_FLEX = 0.15;

const ZONE_LABELS = {
  left: 'Left',
  right: 'Right',
  top: 'Top',
  bottom: 'Bottom',
  center: 'Center',
};

let nextSplitId = 0;
export function makeSplitId() {
  return 'split:' + (nextSplitId++);
}

function positive(val, fallback = 1) {
  return typeof val === 'number' && Number.isFinite(val) && val > 0 ? val : fallback;
}

export function normalizeSizes(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return [];
  const raw = sizes.map((v) => positive(v));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return raw.map(() => 1 / raw.length);
  return raw.map((v) => v / sum);
}

export function getTreePaneIds(node) {
  if (!node) return [];
  if (node.kind === 'pane') return [node.id];
  if (node.kind === 'split' && Array.isArray(node.children)) {
    return node.children.flatMap(getTreePaneIds);
  }
  return [];
}

export function containsPane(node, paneId) {
  if (!node) return false;
  if (node.kind === 'pane') return node.id === paneId;
  return node.children ? node.children.some((child) => containsPane(child, paneId)) : false;
}

export function removeNode(node, paneId) {
  if (!node) return null;
  if (node.kind === 'pane') {
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
    kind: 'split',
    id: node.id || makeSplitId(),
    direction: node.direction || 'row',
    children,
    sizes: normalizeSizes(sizes),
  };
}

export function removePane(tree, paneId) {
  if (!tree || !tree.root) return { root: null };
  return { root: removeNode(tree.root, paneId) };
}

function splitForZone(target, source, zone, inheritedDirection) {
  let direction = inheritedDirection;
  let children;
  switch (zone) {
    case 'left':
      direction = 'row';
      children = [source, target];
      break;
    case 'right':
      direction = 'row';
      children = [target, source];
      break;
    case 'top':
      direction = 'col';
      children = [source, target];
      break;
    case 'bottom':
      direction = 'col';
      children = [target, source];
      break;
    case 'center':
    default:
      children = [target, source];
      break;
  }
  return {
    kind: 'split',
    id: makeSplitId(),
    direction,
    children,
    sizes: [0.5, 0.5],
  };
}

function replaceInNode(node, targetId, source, zone, inheritedDirection = 'row') {
  if (node.kind === 'pane') {
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

export function insertOrSplit(tree, sourceId, targetId, zone) {
  if (!tree || !tree.root) {
    return { root: { kind: 'pane', id: sourceId } };
  }
  if (sourceId === targetId) return tree;

  const source = { kind: 'pane', id: sourceId };
  let workingTree = tree;
  if (containsPane(tree.root, sourceId)) {
    workingTree = { root: removeNode(tree.root, sourceId) };
  }
  if (!workingTree.root) {
    return { root: source };
  }
  const result = replaceInNode(workingTree.root, targetId, source, zone, 'row');
  if (!result.replaced) return workingTree;
  return { root: result.node };
}

export function toggleImmediateSplit(node, paneId) {
  if (!node) return null;
  if (node.kind === 'pane') return node;
  if (node.children.some((c) => c.kind === 'pane' && c.id === paneId)) {
    return {
      ...node,
      direction: node.direction === 'col' ? 'row' : 'col',
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
    direction: node.direction === 'col' ? 'row' : 'col',
  };
}

export function togglePaneSplit(tree, paneId) {
  if (!tree || !tree.root) return tree;
  return { root: toggleImmediateSplit(tree.root, paneId) };
}

export function getImmediateSplitDirection(node, paneId) {
  if (!node || node.kind === 'pane') return null;
  if (node.children.some((c) => c.kind === 'pane' && c.id === paneId)) return node.direction;
  for (const c of node.children) {
    if (c.kind === 'split' && containsPane(c, paneId)) {
      return getImmediateSplitDirection(c, paneId);
    }
  }
  return null;
}

export function getImmediateSplitInfo(node, paneId) {
  if (!node || node.kind === 'pane') return null;
  const idx = node.children.findIndex((c) => c.kind === 'pane' && c.id === paneId);
  if (idx !== -1) {
    const siblingNode = node.children.find((_, i) => i !== idx) || null;
    const siblingPaneId =
      siblingNode && siblingNode.kind === 'pane' ? siblingNode.id : null;
    const currentSide =
      node.direction === 'row'
        ? idx === 0
          ? 'left'
          : 'right'
        : idx === 0
          ? 'top'
          : 'bottom';
    return {
      splitId: node.id,
      direction: node.direction,
      index: idx,
      currentSide,
      siblingPaneId,
    };
  }
  for (const c of node.children) {
    if (c.kind === 'split' && containsPane(c, paneId)) {
      return getImmediateSplitInfo(c, paneId);
    }
  }
  return null;
}

export function swapPanes(node, aId, bId) {
  if (!node) return null;
  if (node.kind === 'pane') {
    if (node.id === aId) return { kind: 'pane', id: bId };
    if (node.id === bId) return { kind: 'pane', id: aId };
    return node;
  }
  return { ...node, children: node.children.map((c) => swapPanes(c, aId, bId)) };
}

export function swapTreePanes(tree, aId, bId) {
  if (!tree || !tree.root || aId === bId) return tree;
  return { root: swapPanes(tree.root, aId, bId) };
}

export function replaceNodePaneId(node, oldId, newId) {
  if (!node) return null;
  if (node.kind === 'pane') return node.id === oldId ? { kind: 'pane', id: newId } : node;
  return { ...node, children: node.children.map((c) => replaceNodePaneId(c, oldId, newId)) };
}

export function replaceTreePaneId(tree, oldId, newId) {
  if (!tree || !tree.root || oldId === newId) return tree;
  return { root: replaceNodePaneId(tree.root, oldId, newId) };
}

export function updateSplitSizes(node, splitId, newSizes) {
  if (!node) return null;
  if (node.kind === 'pane') return node;
  if (node.id === splitId) {
    return { ...node, sizes: normalizeSizes(newSizes) };
  }
  const nextChildren = node.children.map((c) => updateSplitSizes(c, splitId, newSizes));
  return { ...node, children: nextChildren };
}

export function updateTreeSizes(tree, splitId, newSizes) {
  if (!tree || !tree.root) return tree;
  return { root: updateSplitSizes(tree.root, splitId, newSizes) };
}

function clamp01(v) {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function zoneRect(rect, zone) {
  switch (zone) {
    case 'left':
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width * 0.5,
        height: rect.height,
      };
    case 'right':
      return {
        left: rect.left + rect.width * 0.5,
        top: rect.top,
        width: rect.width * 0.5,
        height: rect.height,
      };
    case 'top':
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height * 0.5,
      };
    case 'bottom':
      return {
        left: rect.left,
        top: rect.top + rect.height * 0.5,
        width: rect.width,
        height: rect.height * 0.5,
      };
    case 'center':
    default:
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
  }
}

export function computeDropZone(rect, cx, cy, allowCenter = false) {
  const nx = clamp01((cx - rect.left) / Math.max(1, rect.width));
  const ny = clamp01((cy - rect.top) / Math.max(1, rect.height));

  let zone;
  if (allowCenter && nx >= 0.25 && nx <= 0.75 && ny >= 0.25 && ny <= 0.75) {
    zone = 'center';
  } else if (ny < 0.25) {
    zone = 'top';
  } else if (ny > 0.75) {
    zone = 'bottom';
  } else if (nx < 0.25) {
    zone = 'left';
  } else if (nx > 0.75) {
    zone = 'right';
  } else {
    // In center 50% box when center is not allowed: snap to nearest edge
    const dTop = ny;
    const dBottom = 1 - ny;
    const dLeft = nx;
    const dRight = 1 - nx;
    const minD = Math.min(dTop, dBottom, dLeft, dRight);
    if (minD === dTop) zone = 'top';
    else if (minD === dBottom) zone = 'bottom';
    else if (minD === dLeft) zone = 'left';
    else zone = 'right';
  }
  return { zone, label: ZONE_LABELS[zone], rect: zoneRect(rect, zone) };
}

export function calculateResize(isRow, startCoord, currentCoord, totalPx, prevGrow, nextGrow) {
  const safeTotal = totalPx > 0 ? totalPx : 1;
  const prev = positive(prevGrow);
  const next = positive(nextGrow);
  const sum = prev + next;
  if (sum < MIN_FLEX * 2) {
    return { newPrevGrow: MIN_FLEX, newNextGrow: MIN_FLEX };
  }
  const delta = currentCoord - startCoord;
  const rawPrev = prev + (delta / safeTotal) * sum;
  const newPrev = Math.max(MIN_FLEX, Math.min(sum - MIN_FLEX, rawPrev));
  const newNext = sum - newPrev;
  return { newPrevGrow: newPrev, newNextGrow: newNext };
}

export function computeTreeGeometry(
  node,
  box = { left: 0, top: 0, width: 100, height: 100 },
  result = { panes: {}, dividers: [] }
) {
  if (!node) return result;
  if (node.kind === 'pane') {
    result.panes[node.id] = box;
    return result;
  }
  if (node.kind === 'split' && Array.isArray(node.children)) {
    const isRow = node.direction === 'row';
    const count = node.children.length;
    if (count === 0) return result;
    const sizes = normalizeSizes(
      node.sizes && node.sizes.length === count
        ? node.sizes
        : node.children.map(() => 1 / count)
    );
    let offset = isRow ? box.left : box.top;
    for (let i = 0; i < count; i++) {
      const child = node.children[i];
      const sizePct = (isRow ? box.width : box.height) * sizes[i];
      const childBox = isRow
        ? { left: offset, top: box.top, width: sizePct, height: box.height }
        : { left: box.left, top: offset, width: box.width, height: sizePct };
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
          sizes,
        });
      }
    }
  }
  return result;
}

