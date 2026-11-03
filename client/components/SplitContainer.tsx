import * as React from 'react';
import { calculateResize } from '../../src/layout/engine.js';
import type { LayoutNode, SplitNode, PaneData, SplitZone } from './types.js';
import { PaneView } from './PaneView.js';

interface SplitContainerProps {
  node: LayoutNode | null;
  panes: Record<string, PaneData>;
  activePaneId: string | null;
  dropZones: Record<string, SplitZone | null>;
  onActivate: (paneId: string) => void;
  onPaneClose: (paneId: string) => void;
  onPaneMinimize: (paneId: string) => void;
  onPaneMaximize: (paneId: string) => void;
  onResize: (
    nodeId: string,
    index: number,
    newPrevGrow: number,
    newNextGrow: number,
  ) => void;
}

export function SplitContainer(props: SplitContainerProps) {
  if (!props.node) {
    return <div className="ade-stage-empty" />;
  }
  return <NodeView node={props.node} {...props} />;
}

type NodeProps = SplitContainerProps & { node: LayoutNode };

function NodeView({ node, ...rest }: NodeProps) {
  if (node.kind === 'pane') {
    const pane = rest.panes[node.id];
    if (!pane) {
      return null;
    }
    return (
      <PaneView
        pane={pane}
        active={rest.activePaneId === node.id}
        dropZone={rest.dropZones[node.id] ?? null}
        onActivate={() => rest.onActivate(node.id)}
        onClose={() => rest.onPaneClose(node.id)}
        onMinimize={() => rest.onPaneMinimize(node.id)}
        onMaximize={() => rest.onPaneMaximize(node.id)}
      />
    );
  }
  return <SplitNodeView node={node} {...rest} />;
}

interface ResizerProps {
  isRow: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  prevGrow: number;
  nextGrow: number;
  onPreview: (prev: number, next: number) => void;
  onCommit: (prev: number, next: number) => void;
}

function Resizer({
  isRow,
  containerRef,
  prevGrow,
  nextGrow,
  onPreview,
  onCommit,
}: ResizerProps) {
  const [resizing, setResizing] = React.useState(false);
  const dragRef = React.useRef<{
    start: number;
    prev: number;
    next: number;
    totalPx: number;
    isRow: boolean;
  } | null>(null);

  const coord = (e: React.PointerEvent) => (isRow ? e.clientX : e.clientY);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) {
      return;
    }
    e.preventDefault();
    const el = containerRef.current;
    const totalPx = el
      ? isRow
        ? el.clientWidth
        : el.clientHeight
      : 1;
    dragRef.current = {
      start: coord(e),
      prev: prevGrow,
      next: nextGrow,
      totalPx: totalPx || 1,
      isRow,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return;
    }
    const d = dragRef.current;
    const result = calculateResize(
      d.isRow,
      d.start,
      coord(e),
      d.totalPx,
      d.prev,
      d.next,
    );
    onPreview(result.newPrevGrow, result.newNextGrow);
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) {
      return;
    }
    const d = dragRef.current;
    const result = calculateResize(
      d.isRow,
      d.start,
      coord(e),
      d.totalPx,
      d.prev,
      d.next,
    );
    onCommit(result.newPrevGrow, result.newNextGrow);
    dragRef.current = null;
    setResizing(false);
  };

  return (
    <div
      className={`ade-resizer ade-resizer--${isRow ? 'row' : 'col'}${resizing ? ' resizing' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
  );
}

function SplitNodeView({
  node,
  panes,
  activePaneId,
  dropZones,
  onActivate,
  onPaneClose,
  onPaneMinimize,
  onPaneMaximize,
  onResize,
}: SplitNodeViewProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [liveSizes, setLiveSizes] = React.useState<number[]>(() => node.sizes);

  React.useEffect(() => {
    setLiveSizes(node.sizes);
  }, [node.sizes]);

  const isRow = node.direction === 'row';

  return (
    <div
      ref={containerRef}
      className={`ade-split-container ade-split-container--${node.direction}`}
      data-split-id={node.id}
    >
      {node.children.map((child, index) => (
        <React.Fragment key={child.id}>
          <div
            className="ade-split-child"
            style={{
              flexGrow: liveSizes[index] ?? node.sizes[index],
              flexBasis: 0,
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <NodeView
              node={child}
              panes={panes}
              activePaneId={activePaneId}
              dropZones={dropZones}
              onActivate={onActivate}
              onPaneClose={onPaneClose}
              onPaneMinimize={onPaneMinimize}
              onPaneMaximize={onPaneMaximize}
              onResize={onResize}
            />
          </div>
          {index < node.children.length - 1 ? (
            <Resizer
              key={`resizer-${node.id}-${index}`}
              isRow={isRow}
              containerRef={containerRef}
              prevGrow={node.sizes[index]}
              nextGrow={node.sizes[index + 1]}
              onPreview={(prev, next) =>
                setLiveSizes((sizes) => {
                  const copy = sizes.slice();
                  copy[index] = prev;
                  copy[index + 1] = next;
                  return copy;
                })
              }
              onCommit={(prev, next) => onResize(node.id, index, prev, next)}
            />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

type SplitNodeViewProps = SplitContainerProps & { node: SplitNode };