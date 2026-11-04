import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure reproduction of layout filter calculation logic from client/node-graph.js
 */
function computeLayoutFilters({ savedLayouts, activeLayout, layoutIds = [] }) {
  const list = [];
  const savedLayoutList = Array.isArray(savedLayouts) ? savedLayouts : [];

  if (activeLayout && Array.isArray(activeLayout.paneIds) && activeLayout.paneIds.length >= 2) {
    list.push({
      id: 'layout',
      label: activeLayout.name || `Layout ${activeLayout.paneIds.length}`,
      title: 'Only sessions mounted in the active multi-pane layout plus their linked subagents and forks',
      paneIds: activeLayout.paneIds.filter((id) => id && typeof id === 'string'),
    });
  } else if (layoutIds.length >= 2) {
    list.push({
      id: 'layout',
      label: `Layout ${layoutIds.length}`,
      title: 'Only sessions mounted in the active multi-pane layout plus their linked subagents and forks',
      paneIds: layoutIds,
    });
  }

  const activeKey = activeLayout ? activeLayout.id : 'layout';
  const activePaneKey = activeLayout && Array.isArray(activeLayout.paneIds)
    ? [...activeLayout.paneIds].sort().join('\u0000')
    : (layoutIds.length >= 2 ? [...layoutIds].sort().join('\u0000') : '');

  for (const savedLayout of savedLayoutList) {
    if (!savedLayout || typeof savedLayout !== 'object') continue;
    const paneIds = Array.isArray(savedLayout.panes)
      ? savedLayout.panes.map((p) => p && p.sessionId).filter((id) => id && typeof id === 'string')
      : [];
    if (paneIds.length < 2) continue;
    const key = [...paneIds].sort().join('\u0000');
    if (activePaneKey && key === activePaneKey) continue;
    list.push({
      id: `saved:${savedLayout.id}`,
      activeKey,
      label: savedLayout.name || `Layout ${paneIds.length}`,
      title: `Saved layout: ${savedLayout.name || paneIds.length + ' panes'}. Shows only these pane sessions plus their linked subagents and forks.`,
      paneIds,
    });
  }
  return list;
}

/**
 * Pure reproduction of descendant closure calculation for layout filtering
 */
function computeLayoutNodeIds(paneIds, edges) {
  const layoutPaneIdSet = new Set(paneIds);
  if (layoutPaneIdSet.size === 0) return layoutPaneIdSet;

  const childrenOf = new Map();
  for (const edge of edges) {
    if (!childrenOf.has(edge.from)) childrenOf.set(edge.from, []);
    childrenOf.get(edge.from).push(edge.to);
  }

  const closure = new Set(layoutPaneIdSet);
  const queue = [...layoutPaneIdSet];
  const seen = new Set(layoutPaneIdSet);

  while (queue.length > 0) {
    const parentId = queue.shift();
    for (const childId of childrenOf.get(parentId) || []) {
      if (!seen.has(childId)) {
        seen.add(childId);
        closure.add(childId);
        queue.push(childId);
      }
    }
  }
  return closure;
}

describe('Node Graph Layout Filter & Scope Isolation', () => {
  it('does not throw on null, undefined, or malformed savedLayouts', () => {
    assert.doesNotThrow(() => {
      computeLayoutFilters({ savedLayouts: null });
      computeLayoutFilters({ savedLayouts: undefined });
      computeLayoutFilters({ savedLayouts: [null, undefined, {}, { panes: null }, { panes: 'invalid' }] });
    });
  });

  it('includes active layout when activeLayout has >= 2 panes', () => {
    const filters = computeLayoutFilters({
      savedLayouts: [],
      activeLayout: { id: 'split-1', name: 'My Split', paneIds: ['s1', 's2'] },
    });
    assert.strictEqual(filters.length, 1);
    assert.strictEqual(filters[0].id, 'layout');
    assert.strictEqual(filters[0].label, 'My Split');
    assert.deepStrictEqual(filters[0].paneIds, ['s1', 's2']);
  });

  it('ignores layouts with < 2 panes', () => {
    const filters = computeLayoutFilters({
      savedLayouts: [
        { id: 'single', name: 'One Pane', panes: [{ sessionId: 's1' }] },
        { id: 'empty', name: 'No Panes', panes: [] },
      ],
      activeLayout: { id: 'single-active', name: 'One Active', paneIds: ['s1'] },
      layoutIds: ['s1'],
    });
    assert.strictEqual(filters.length, 0);
  });

  it('deduplicates saved layout when it matches activeLayout pane set', () => {
    const filters = computeLayoutFilters({
      savedLayouts: [
        { id: 'saved-dup', name: 'Saved Twin', panes: [{ sessionId: 's2' }, { sessionId: 's1' }] },
        { id: 'saved-other', name: 'Other Split', panes: [{ sessionId: 's3' }, { sessionId: 's4' }] },
      ],
      activeLayout: { id: 'split-1', name: 'Active Twin', paneIds: ['s1', 's2'] },
    });
    assert.strictEqual(filters.length, 2);
    assert.strictEqual(filters[0].id, 'layout');
    assert.strictEqual(filters[1].id, 'saved:saved-other');
  });

  it('strictly isolates layout nodes to pane sessions plus subagents/forks', () => {
    // Session graph:
    // s1 (pane) -> sub1 -> fork1
    // s2 (pane) -> sub2
    // unrelated1 -> unrelatedSub
    const edges = [
      { from: 's1', to: 'sub1' },
      { from: 'sub1', to: 'fork1' },
      { from: 's2', to: 'sub2' },
      { from: 'unrelated1', to: 'unrelatedSub' },
    ];

    const layoutPaneIds = ['s1', 's2'];
    const nodeIds = computeLayoutNodeIds(layoutPaneIds, edges);

    // Pane sessions included
    assert.ok(nodeIds.has('s1'));
    assert.ok(nodeIds.has('s2'));

    // Descendants included
    assert.ok(nodeIds.has('sub1'));
    assert.ok(nodeIds.has('fork1'));
    assert.ok(nodeIds.has('sub2'));

    // Unrelated sessions strictly excluded (no leak)
    assert.ok(!nodeIds.has('unrelated1'), 'Unrelated session must not leak into layout');
    assert.ok(!nodeIds.has('unrelatedSub'), 'Unrelated subagent must not leak into layout');
    assert.strictEqual(nodeIds.size, 5);
  });
});
