import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MIN_FLEX,
  calculateResize,
  computeDropZone,
  insertOrSplit,
  removePane,
  replaceTreePaneId,
} from './engine.ts';
import type {
  LayoutNode,
  LayoutTree,
  PaneNode,
  Rect,
  SplitDirection,
  SplitNode,
} from './engine.ts';

function pane(id: string): PaneNode {
  return { kind: 'pane', id };
}

function split(
  direction: SplitDirection,
  children: LayoutNode[],
  sizes?: number[],
): SplitNode {
  return {
    kind: 'split' as const,
    id: 'test-split',
    direction,
    children,
    sizes: sizes ?? children.map(() => 1 / children.length),
  };
}

function tree(node: LayoutNode | null): LayoutTree {
  return { root: node };
}

/** Shape without generated split ids, with sizes rounded for stable deepEqual. */
function shape(node: LayoutNode | null): unknown {
  if (node === null) return null;
  if (node.kind === 'pane') return { kind: 'pane', id: node.id };
  return {
    kind: 'split',
    direction: node.direction,
    children: node.children.map((child) => shape(child as LayoutNode)),
    sizes: node.sizes.map((value) => Math.round(value * 10000) / 10000),
  };
}

function assertClose(actual: number, expected: number, tolerance = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

describe('computeDropZone', () => {
  const rect: Rect = { left: 0, top: 0, width: 100, height: 200 };

  it('returns center for the middle 50% x 50% box', () => {
    const result = computeDropZone(rect, 50, 100);
    assert.equal(result.zone, 'center');
    assert.equal(result.label, 'Center');
    assert.deepEqual(result.rect, { left: 25, top: 50, width: 50, height: 100 });
  });

  it('returns left for the outer 25% band', () => {
    const result = computeDropZone(rect, 10, 100);
    assert.equal(result.zone, 'left');
    assert.equal(result.label, 'Left');
    assert.deepEqual(result.rect, { left: 0, top: 0, width: 25, height: 200 });
  });

  it('returns right for the outer 25% band', () => {
    const result = computeDropZone(rect, 90, 100);
    assert.equal(result.zone, 'right');
    assert.deepEqual(result.rect, { left: 75, top: 0, width: 25, height: 200 });
  });

  it('returns top for the outer 25% band', () => {
    const result = computeDropZone(rect, 50, 20);
    assert.equal(result.zone, 'top');
    assert.deepEqual(result.rect, { left: 0, top: 0, width: 100, height: 50 });
  });

  it('returns bottom for the outer 25% band', () => {
    const result = computeDropZone(rect, 50, 190);
    assert.equal(result.zone, 'bottom');
    assert.deepEqual(result.rect, { left: 0, top: 150, width: 100, height: 50 });
  });

  it('gives vertical bands precedence in corners', () => {
    assert.equal(computeDropZone(rect, 10, 20).zone, 'top');
    assert.equal(computeDropZone(rect, 90, 20).zone, 'top');
    assert.equal(computeDropZone(rect, 10, 190).zone, 'bottom');
    assert.equal(computeDropZone(rect, 90, 190).zone, 'bottom');
  });

  it('treats the 25% boundary as center', () => {
    assert.equal(computeDropZone(rect, 25, 100).zone, 'center');
    assert.equal(computeDropZone(rect, 75, 100).zone, 'center');
    assert.equal(computeDropZone(rect, 50, 50).zone, 'center');
    assert.equal(computeDropZone(rect, 50, 150).zone, 'center');
  });

  it('clamps out-of-bounds coordinates to nearest outer zone', () => {
    assert.equal(computeDropZone(rect, -50, 100).zone, 'left');
    assert.equal(computeDropZone(rect, 150, 100).zone, 'right');
    assert.equal(computeDropZone(rect, 50, -50).zone, 'top');
    assert.equal(computeDropZone(rect, 50, 250).zone, 'bottom');
  });
});

describe('calculateResize', () => {
  it('keeps shares unchanged when the pointer does not move', () => {
    const result = calculateResize(true, 100, 100, 500, 0.5, 0.5);
    assert.deepEqual(result, { newPrevGrow: 0.5, newNextGrow: 0.5 });
  });

  it('grows prev and shrinks next when dragging right', () => {
    const result = calculateResize(true, 100, 200, 500, 0.5, 0.5);
    assertClose(result.newPrevGrow, 0.7);
    assertClose(result.newNextGrow, 0.3);
  });

  it('shrinks prev and grows next when dragging left', () => {
    const result = calculateResize(false, 100, 0, 500, 0.5, 0.5);
    assertClose(result.newPrevGrow, 0.3);
    assertClose(result.newNextGrow, 0.7);
  });

  it('clamps prev to the min flex bound', () => {
    const result = calculateResize(true, 0, -1000, 500, 0.5, 0.5);
    assertClose(result.newPrevGrow, MIN_FLEX);
    assertClose(result.newNextGrow, 1 - MIN_FLEX);
  });

  it('clamps next to the min flex bound', () => {
    const result = calculateResize(true, 0, 1000, 500, 0.5, 0.5);
    assertClose(result.newPrevGrow, 1 - MIN_FLEX);
    assertClose(result.newNextGrow, MIN_FLEX);
  });

  it('keeps the share sum constant', () => {
    const result = calculateResize(false, 40, 340, 400, 0.6, 0.4);
    assertClose(result.newPrevGrow + result.newNextGrow, 1);
  });

  it('is axis-agnostic for isRow', () => {
    assert.deepEqual(
      calculateResize(true, 0, 100, 400, 0.5, 0.5),
      calculateResize(false, 0, 100, 400, 0.5, 0.5),
    );
  });
});

describe('insertOrSplit', () => {
  it('splits a root pane to the right with a new source', () => {
    const result = insertOrSplit(tree(pane('a')), 'b', 'a', 'right');
    assert.deepEqual(shape(result.root), {
      kind: 'split',
      direction: 'row',
      children: [
        { kind: 'pane', id: 'a' },
        { kind: 'pane', id: 'b' },
      ],
      sizes: [0.5, 0.5],
    });
  });

  it('orders children by zone', () => {
    assert.deepEqual(
      shape(insertOrSplit(tree(pane('a')), 'b', 'a', 'left').root),
      {
        kind: 'split',
        direction: 'row',
        children: [
          { kind: 'pane', id: 'b' },
          { kind: 'pane', id: 'a' },
        ],
        sizes: [0.5, 0.5],
      },
    );

    assert.deepEqual(
      shape(insertOrSplit(tree(pane('a')), 'b', 'a', 'top').root),
      {
        kind: 'split',
        direction: 'col',
        children: [
          { kind: 'pane', id: 'b' },
          { kind: 'pane', id: 'a' },
        ],
        sizes: [0.5, 0.5],
      },
    );

    assert.deepEqual(
      shape(insertOrSplit(tree(pane('a')), 'b', 'a', 'bottom').root),
      {
        kind: 'split',
        direction: 'col',
        children: [
          { kind: 'pane', id: 'a' },
          { kind: 'pane', id: 'b' },
        ],
        sizes: [0.5, 0.5],
      },
    );
  });

  it('center inherits the root default direction on a root pane', () => {
    const result = insertOrSplit(tree(pane('a')), 'b', 'a', 'center');
    assert.equal((result.root as SplitNode).direction, 'row');
    assert.deepEqual(
      shape(result.root),
      {
        kind: 'split',
        direction: 'row',
        children: [
          { kind: 'pane', id: 'a' },
          { kind: 'pane', id: 'b' },
        ],
        sizes: [0.5, 0.5],
      },
    );
  });

  it('inserts into a nested split while preserving parent flex ratios', () => {
    const initial = tree(split('row', [pane('a'), pane('b')], [0.6, 0.4]));
    const result = insertOrSplit(initial, 'c', 'b', 'bottom');

    assert.deepEqual(shape(result.root), {
      kind: 'split',
      direction: 'row',
      children: [
        { kind: 'pane', id: 'a' },
        {
          kind: 'split',
          direction: 'col',
          children: [
            { kind: 'pane', id: 'b' },
            { kind: 'pane', id: 'c' },
          ],
          sizes: [0.5, 0.5],
        },
      ],
      sizes: [0.6, 0.4],
    });
  });

  it('center inherits the parent split direction', () => {
    const initial = tree(split('col', [pane('a'), pane('b')]));
    const result = insertOrSplit(initial, 'c', 'a', 'center');
    assert.equal((result.root as SplitNode).direction, 'col');
    const firstChild = (result.root as SplitNode).children[0] as SplitNode;
    assert.equal(firstChild.kind, 'split');
    assert.equal(firstChild.direction, 'col');
    assert.deepEqual(
      firstChild.children.map((child) => (child as PaneNode).id),
      ['a', 'c'],
    );
  });

  it('moves an existing pane: removes it and splits the target', () => {
    const initial = tree(
      split('row', [pane('a'), split('col', [pane('b'), pane('c')], [0.5, 0.5])], [0.6, 0.4]),
    );

    // Move b onto c, right: the emptied col collapses to c, then c splits.
    const result = insertOrSplit(initial, 'b', 'c', 'right');

    assert.deepEqual(shape(result.root), {
      kind: 'split',
      direction: 'row',
      children: [
        { kind: 'pane', id: 'a' },
        {
          kind: 'split',
          direction: 'row',
          children: [
            { kind: 'pane', id: 'c' },
            { kind: 'pane', id: 'b' },
          ],
          sizes: [0.5, 0.5],
        },
      ],
      sizes: [0.6, 0.4],
    });

    // Input must not mutate.
    assert.deepEqual(shape(initial.root), {
      kind: 'split',
      direction: 'row',
      children: [
        { kind: 'pane', id: 'a' },
        {
          kind: 'split',
          direction: 'col',
          children: [
            { kind: 'pane', id: 'b' },
            { kind: 'pane', id: 'c' },
          ],
          sizes: [0.5, 0.5],
        },
      ],
      sizes: [0.6, 0.4],
    });
  });

  it('is a no-op when source and target are the same pane', () => {
    const initial = tree(pane('a'));
    const result = insertOrSplit(initial, 'a', 'a', 'left');
    assert.equal(result, initial);
  });

  it('returns the tree unchanged when target does not exist', () => {
    const initial = tree(pane('a'));
    const result = insertOrSplit(initial, 'b', 'missing', 'left');
    assert.deepEqual(shape(result.root), { kind: 'pane', id: 'a' });
  });

  it('returns an empty tree when the only source pane is removed and target is missing', () => {
    const result = insertOrSplit(tree(pane('a')), 'a', 'missing', 'left');
    assert.equal(result.root, null);
  });
});

describe('removePane', () => {
  it('removes the last pane and returns a null root', () => {
    const result = removePane(tree(pane('a')), 'a');
    assert.equal(result.root, null);
  });

  it('collapses a two-pane split to the surviving pane', () => {
    const result = removePane(
      tree(split('row', [pane('a'), pane('b')], [0.5, 0.5])),
      'b',
    );
    assert.deepEqual(shape(result.root), { kind: 'pane', id: 'a' });
  });

  it('collapses a nested split and preserves the parent slot flex', () => {
    const initial = tree(
      split('row', [pane('a'), split('col', [pane('b'), pane('c')], [0.5, 0.5])], [0.6, 0.4]),
    );
    const result = removePane(initial, 'b');
    assert.deepEqual(shape(result.root), {
      kind: 'split',
      direction: 'row',
      children: [
        { kind: 'pane', id: 'a' },
        { kind: 'pane', id: 'c' },
      ],
      sizes: [0.6, 0.4],
    });
  });

  it('normalizes remaining siblings while preserving their ratios', () => {
    const result = removePane(
      tree(split('row', [pane('a'), pane('b'), pane('c')], [0.3, 0.3, 0.4])),
      'b',
    );
    const root = result.root as SplitNode;
    assert.equal(root.kind, 'split');
    assert.deepEqual(
      root.children.map((child) => (child as PaneNode).id),
      ['a', 'c'],
    );
    assertClose(sum(root.sizes), 1);
    assertClose(root.sizes[0] / root.sizes[1], 0.3 / 0.4);
  });

  it('does not mutate the input tree', () => {
    const initial = tree(
      split('row', [pane('a'), split('col', [pane('b'), pane('c')], [0.5, 0.5])], [0.6, 0.4]),
    );
    const snapshot = JSON.stringify(shape(initial.root));
    removePane(initial, 'b');
    assert.equal(JSON.stringify(shape(initial.root)), snapshot);
  });
});

describe('replaceTreePaneId', () => {
  it('replaces a root pane id', () => {
    const result = replaceTreePaneId(tree(pane('a')), 'a', 'x');
    assert.deepEqual(shape(result.root), { kind: 'pane', id: 'x' });
  });

  it('replaces a nested pane while keeping directions and sizes intact', () => {
    const initial = tree(
      split('row', [pane('parent'), split('col', [pane('child-1'), pane('child-2')], [0.4, 0.6])], [0.5, 0.5]),
    );
    const result = replaceTreePaneId(initial, 'child-1', 'child-99');
    assert.deepEqual(shape(result.root), {
      kind: 'split',
      direction: 'row',
      children: [
        { kind: 'pane', id: 'parent' },
        {
          kind: 'split',
          direction: 'col',
          children: [
            { kind: 'pane', id: 'child-99' },
            { kind: 'pane', id: 'child-2' },
          ],
          sizes: [0.4, 0.6],
        },
      ],
      sizes: [0.5, 0.5],
    });
  });

  it('returns original tree when oldId does not exist or oldId === newId', () => {
    const initial = tree(pane('a'));
    assert.strictEqual(replaceTreePaneId(initial, 'a', 'a'), initial);
    assert.deepEqual(replaceTreePaneId(initial, 'unknown', 'x'), initial);
  });
});