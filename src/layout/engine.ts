/**
 * Pure-math multi-pane layout engine.
 *
 * All tree-mutating functions are immutable: they return a new `LayoutTree` and
 * never mutate the input. Pane nodes are shared; split nodes are rebuilt only
 * along the affected path.
 *
 * A `SplitNode` keeps `sizes` parallel to `children`. Sizes are normalized so
 * their sum equals 1; the element occupying a split slot is replaced, not its
 * flex, which is what "preserves flex ratios" means when collapsing parents.
 */

export type SplitZone = 'left' | 'right' | 'top' | 'bottom' | 'center';
export type SplitDirection = 'row' | 'col';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PaneNode {
  kind: 'pane';
  id: string;
}

export interface SplitNode {
  kind: 'split';
  id: string;
  direction: SplitDirection;
  children: LayoutNode[];
  sizes: number[];
}

export type LayoutNode = PaneNode | SplitNode;

export interface LayoutTree {
  root: LayoutNode | null;
}

export interface DropZoneResult {
  zone: SplitZone;
  label: string;
  rect: Rect;
}

export interface ResizeResult {
  newPrevGrow: number;
  newNextGrow: number;
}

/** Minimum flex share for either side of a divider. */
export const MIN_FLEX = 0.15;

const ZONE_LABELS: Record<SplitZone, string> = {
  left: 'Left',
  right: 'Right',
  top: 'Top',
  bottom: 'Bottom',
  center: 'Center',
};

let nextSplitId = 0;

function makeSplitId(): string {
  return `split:${nextSplitId++}`;
}

function positive(value: number, fallback = 1): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeSizes(sizes: number[]): number[] {
  const raw = sizes.map((value) => positive(value));
  const sum = raw.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) return raw.map(() => 1 / raw.length);
  return raw.map((value) => value / sum);
}

function containsPane(node: LayoutNode | null, paneId: string): boolean {
  if (node === null) return false;
  if (node.kind === 'pane') return node.id === paneId;
  return node.children.some((child) => containsPane(child, paneId));
}

function removeNode(node: LayoutNode | null, paneId: string): LayoutNode | null {
  if (node === null) return null;

  if (node.kind === 'pane') {
    return node.id === paneId ? null : node;
  }

  const children: LayoutNode[] = [];
  const sizes: number[] = [];

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
    kind: 'split',
    id: node.id,
    direction: node.direction,
    children,
    sizes: normalizeSizes(sizes),
  };
}

function splitForZone(
  target: PaneNode,
  source: PaneNode,
  zone: SplitZone,
  inheritedDirection: SplitDirection,
): SplitNode {
  let direction: SplitDirection = inheritedDirection;
  let children: LayoutNode[];

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
      // Stack at the target's location, reusing the same axis as its parent.
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

interface ReplaceResult {
  node: LayoutNode;
  replaced: boolean;
}

function replaceInNode(
  node: LayoutNode,
  targetId: string,
  source: PaneNode,
  zone: SplitZone,
  inheritedDirection: SplitDirection = 'row',
): ReplaceResult {
  if (node.kind === 'pane') {
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

/**
 * Move (or newly insert) `sourceId` relative to `targetId`.
 *
 * - `sourceId === targetId` is a no-op.
 * - If `sourceId` already exists, it is removed first and empty parents collapse.
 * - `targetId` must currently be a pane; its slot is replaced by a two-child
 *   split. The replaced pane keeps its slot's flex, so sibling ratios hold.
 * - For `center`, the new split inherits the target parent's direction and
 *   stacks `[target, source]`.
 */
export function insertOrSplit(
  tree: LayoutTree,
  sourceId: string,
  targetId: string,
  zone: SplitZone,
): LayoutTree {
  if (sourceId === targetId) return tree;

  const source: PaneNode = { kind: 'pane', id: sourceId };

  let workingTree = tree;
  if (containsPane(tree.root, sourceId)) {
    workingTree = { root: removeNode(tree.root, sourceId) };
  }

  if (workingTree.root === null) return workingTree;

  const result = replaceInNode(workingTree.root, targetId, source, zone, 'row');
  if (!result.replaced) return workingTree;

  return { root: result.node };
}

/**
 * Remove a pane and collapse every single-child split upward. Removing the
 * last pane yields a null root.
 */
export function removePane(tree: LayoutTree, paneId: string): LayoutTree {
  return { root: removeNode(tree.root, paneId) };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function zoneRect(rect: Rect, zone: SplitZone): Rect {
  switch (zone) {
    case 'left':
      return { left: rect.left, top: rect.top, width: rect.width * 0.25, height: rect.height };
    case 'right':
      return {
        left: rect.left + rect.width * 0.75,
        top: rect.top,
        width: rect.width * 0.25,
        height: rect.height,
      };
    case 'top':
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height * 0.25 };
    case 'bottom':
      return {
        left: rect.left,
        top: rect.top + rect.height * 0.75,
        width: rect.width,
        height: rect.height * 0.25,
      };
    case 'center':
      return {
        left: rect.left + rect.width * 0.25,
        top: rect.top + rect.height * 0.25,
        width: rect.width * 0.5,
        height: rect.height * 0.5,
      };
  }
}

/**
 * Map a pointer position to a drop zone.
 *
 * The outer 25% bands are the four edges; the 50% x 50% box in the middle is
 * center. Top/bottom take precedence in corner overlap; left/right apply to
 * the mid-height band.
 */
export function computeDropZone(rect: Rect, cx: number, cy: number): DropZoneResult {
  const nx = clamp01((cx - rect.left) / rect.width);
  const ny = clamp01((cy - rect.top) / rect.height);

  let zone: SplitZone;
  if (nx >= 0.25 && nx <= 0.75 && ny >= 0.25 && ny <= 0.75) {
    zone = 'center';
  } else if (ny < 0.25) {
    zone = 'top';
  } else if (ny > 0.75) {
    zone = 'bottom';
  } else if (nx < 0.25) {
    zone = 'left';
  } else {
    zone = 'right';
  }

  return { zone, label: ZONE_LABELS[zone], rect: zoneRect(rect, zone) };
}

/**
 * Calculate new flex shares for the two panes either side of a divider.
 *
 * `isRow` identifies the axis (`row` width / `col` height); the drag math is
 * axis-agnostic because it operates on scalar coordinates. `prevGrow` and
 * `nextGrow` use the same unit as the result; summing is preserved. Both
 * results are clamped to at least `MIN_FLEX`.
 */
export function calculateResize(
  isRow: boolean,
  startCoord: number,
  currentCoord: number,
  totalPx: number,
  prevGrow: number,
  nextGrow: number,
): ResizeResult {
  void isRow;

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