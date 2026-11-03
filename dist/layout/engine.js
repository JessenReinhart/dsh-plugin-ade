const MIN_FLEX = 0.15;
const ZONE_LABELS = {
  left: "Left",
  right: "Right",
  top: "Top",
  bottom: "Bottom",
  center: "Center"
};
let nextSplitId = 0;
function makeSplitId() {
  return `split:${nextSplitId++}`;
}
function positive(value, fallback = 1) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function normalizeSizes(sizes) {
  const raw = sizes.map((value) => positive(value));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return raw.map(() => 1 / raw.length);
  return raw.map((value) => value / sum);
}
function containsPane(node, paneId) {
  if (node === null) return false;
  if (node.kind === "pane") return node.id === paneId;
  return node.children.some((child) => containsPane(child, paneId));
}
function removeNode(node, paneId) {
  if (node === null) return null;
  if (node.kind === "pane") {
    return node.id === paneId ? null : node;
  }
  const children = [];
  const sizes = [];
  for (let index = 0; index < node.children.length; index++) {
    const child = removeNode(node.children[index], paneId);
    if (child !== null) {
      children.push(child);
      sizes.push(positive(node.sizes[index]));
    }
  }
  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return {
    kind: "split",
    id: node.id,
    direction: node.direction,
    children,
    sizes: normalizeSizes(sizes)
  };
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
    const result = replaceInNode(child, targetId, source, zone, node.direction);
    if (result.replaced) {
      replaced = true;
      return result.node;
    }
    return child;
  });
  if (!replaced) return { node, replaced: false };
  return { node: { ...node, children }, replaced: true };
}
function insertOrSplit(tree, sourceId, targetId, zone) {
  if (sourceId === targetId) return tree;
  const source = { kind: "pane", id: sourceId };
  let workingTree = tree;
  if (containsPane(tree.root, sourceId)) {
    workingTree = { root: removeNode(tree.root, sourceId) };
  }
  if (workingTree.root === null) return workingTree;
  const result = replaceInNode(workingTree.root, targetId, source, zone, "row");
  if (!result.replaced) return workingTree;
  return { root: result.node };
}
function removePane(tree, paneId) {
  return { root: removeNode(tree.root, paneId) };
}
function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
function zoneRect(rect, zone) {
  switch (zone) {
    case "left":
      return { left: rect.left, top: rect.top, width: rect.width * 0.25, height: rect.height };
    case "right":
      return {
        left: rect.left + rect.width * 0.75,
        top: rect.top,
        width: rect.width * 0.25,
        height: rect.height
      };
    case "top":
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height * 0.25 };
    case "bottom":
      return {
        left: rect.left,
        top: rect.top + rect.height * 0.75,
        width: rect.width,
        height: rect.height * 0.25
      };
    case "center":
      return {
        left: rect.left + rect.width * 0.25,
        top: rect.top + rect.height * 0.25,
        width: rect.width * 0.5,
        height: rect.height * 0.5
      };
  }
}
function computeDropZone(rect, cx, cy) {
  const nx = clamp01((cx - rect.left) / rect.width);
  const ny = clamp01((cy - rect.top) / rect.height);
  let zone;
  if (nx >= 0.25 && nx <= 0.75 && ny >= 0.25 && ny <= 0.75) {
    zone = "center";
  } else if (ny < 0.25) {
    zone = "top";
  } else if (ny > 0.75) {
    zone = "bottom";
  } else if (nx < 0.25) {
    zone = "left";
  } else {
    zone = "right";
  }
  return { zone, label: ZONE_LABELS[zone], rect: zoneRect(rect, zone) };
}
function calculateResize(isRow, startCoord, currentCoord, totalPx, prevGrow, nextGrow) {
  void isRow;
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
export {
  MIN_FLEX,
  calculateResize,
  computeDropZone,
  insertOrSplit,
  removePane
};
