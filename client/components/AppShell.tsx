import * as React from 'react';
import type {
  LayoutNode,
  Workspace,
  Session,
  PaneData,
  DragSessionPayload,
  DropPreview,
  LayoutPreset,
  SplitZone,
} from './types.js';
import { LAYOUT_PRESETS } from './types.js';
import { Sidebar } from './Sidebar.js';
import { SplitContainer } from './SplitContainer.js';
import { DragOverlay } from './DragOverlay.js';
import { Composer } from './Composer.js';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

interface AppShellProps {
  layout: LayoutNode | null;
  paneOrder: string[];
  panes: Record<string, PaneData>;
  workspaces: Workspace[];
  sessions: Session[];
  activePaneId: string | null;
  broadcast: boolean;
  preset: LayoutPreset;
  dropPreview: DropPreview | null;
  targetPaneId: string | null;
  onPresetSelect: (preset: LayoutPreset) => void;
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
  onSplitActive: (direction: SplitZone) => void;
  onFocusPaneByIndex: (index: number) => void;
  onSessionSelect: (sessionId: string) => void;
  onSessionDragStart: (payload: DragSessionPayload) => void;
  onSessionDragMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSessionDragEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onToggleBroadcast: () => void;
  onSend: (text: string) => void;
}

export function AppShell({
  layout,
  paneOrder,
  panes,
  workspaces,
  sessions,
  activePaneId,
  broadcast,
  preset,
  dropPreview,
  targetPaneId,
  onPresetSelect,
  onActivate,
  onPaneClose,
  onPaneMinimize,
  onPaneMaximize,
  onResize,
  onSplitActive,
  onFocusPaneByIndex,
  onSessionSelect,
  onSessionDragStart,
  onSessionDragMove,
  onSessionDragEnd,
  onToggleBroadcast,
  onSend,
}: AppShellProps) {
  const activePane = activePaneId ? panes[activePaneId] : null;
  const openCount = paneOrder.filter((id) => Boolean(panes[id])).length;

  useKeyboardShortcuts({
    paneCount: paneOrder.length,
    onFocusPane: onFocusPaneByIndex,
    onSplit: onSplitActive,
    onClose: () => {
      if (activePaneId) {
        onPaneClose(activePaneId);
      }
    },
    onMaximize: () => {
      if (activePaneId) {
        onPaneMaximize(activePaneId);
      }
    },
    onToggleBroadcast,
  });

  const dropZones = React.useMemo(() => {
    const map: Record<string, SplitZone | null> = {};
    const preview = dropPreview;
    if (preview && targetPaneId) {
      // The DragOverlay preview already encodes the zone; reattach it to the pane
      // so PaneView can draw an edge highlight. Zone live in the label.
      const zoneFromLabel = labelToZone(preview.label);
      map[targetPaneId] = zoneFromLabel;
    }
    return map;
  }, [dropPreview, targetPaneId]);

  return (
    <div className="ade-app-shell">
      <header className="ade-topbar">
        <div className="ade-topbar-left">
          <div className="ade-button-group" role="tablist" aria-label="Layout preset">
            {LAYOUT_PRESETS.map((p) => (
              <button
                key={p.id}
                className={preset === p.id ? 'active' : ''}
                onClick={() => onPresetSelect(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ade-topbar-right">
          <span
            className={`ade-badge${broadcast ? ' ade-badge--broadcast' : ''}`}
          >
            {broadcast ? `Broadcast: ${openCount} panes` : 'Single target'}
          </span>
        </div>
      </header>

      <div className="ade-main-area">
        <Sidebar
          workspaces={workspaces}
          sessions={sessions}
          activePaneId={activePaneId}
          onSessionSelect={onSessionSelect}
          onSessionDragStart={onSessionDragStart}
          onSessionDragMove={onSessionDragMove}
          onSessionDragEnd={onSessionDragEnd}
        />
        <main className="ade-stage">
          <SplitContainer
            node={layout}
            panes={panes}
            activePaneId={activePaneId}
            dropZones={dropZones}
            onActivate={onActivate}
            onPaneClose={onPaneClose}
            onPaneMinimize={onPaneMinimize}
            onPaneMaximize={onPaneMaximize}
            onResize={onResize}
          />
          <DragOverlay preview={dropPreview} />
        </main>
      </div>

      <Composer
        broadcast={broadcast}
        targetLabel={
          broadcast ? 'All open panes' : activePane?.title ?? 'No target'
        }
        targetCount={broadcast ? openCount : activePane ? 1 : 0}
        onToggleBroadcast={onToggleBroadcast}
        onSend={onSend}
      />
    </div>
  );
}

/** Label to zone reverse-map keeps the drag preview authoritative. */
function labelToZone(label: string): SplitZone | null {
  const normalized = label.toLowerCase();
  return normalized === 'left' ||
    normalized === 'right' ||
    normalized === 'top' ||
    normalized === 'bottom' ||
    normalized === 'center'
    ? (normalized as SplitZone)
    : null;
}