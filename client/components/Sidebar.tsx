import * as React from 'react';
import type { Workspace, Session, DragSessionPayload } from './types.js';
import { useWorkspaces } from '../hooks/useWorkspaces.js';

interface SidebarProps {
  workspaces?: Workspace[];
  sessions?: Session[];
  activePaneId: string | null;
  onSessionSelect?: (sessionId: string) => void;
  onSessionDragStart?: (payload: DragSessionPayload) => void;
  onSessionDragMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSessionDragEnd?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

interface SessionTree {
  session: Session;
  children: SessionTree[];
}

function buildTree(sessions: Session[]): SessionTree[] {
  const byId = new Map<string, Session>();
  for (const session of sessions) {
    byId.set(session.id, session);
  }
  const roots: SessionTree[] = [];
  const childrenByParent = new Map<string, SessionTree[]>();

  for (const session of sessions) {
    const node: SessionTree = { session, children: [] };
    if (session.parentId && byId.has(session.parentId)) {
      const siblings = childrenByParent.get(session.parentId) ?? [];
      siblings.push(node);
      childrenByParent.set(session.parentId, siblings);
    } else {
      roots.push(node);
    }
  }

  const attach = (node: SessionTree): SessionTree => {
    const kids = childrenByParent.get(node.session.id) ?? [];
    if (kids.length > 0) {
      node.children = kids.map(attach);
    }
    return node;
  };

  return roots.map(attach);
}

function SessionRow({
  tree,
  depth,
  activePaneId,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
}: {
  tree: SessionTree;
  depth: number;
  activePaneId: string | null;
  onSelect?: (id: string) => void;
  onDragStart?: (payload: DragSessionPayload) => void;
  onDragMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const { session } = tree;
  const classes = [
    'ade-session-item',
    depth > 0 ? 'ade-session-item--child' : '',
    activePaneId === session.id ? 'active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <React.Fragment>
      <div
        className={classes}
        data-session-id={session.id}
        draggable={false}
        onPointerDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          e.currentTarget.setPointerCapture(e.pointerId);
          onDragStart?.({
            type: 'ade/session',
            sessionId: session.id,
            title: session.title,
            workspaceId: session.workspaceId,
          });
        }}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        onClick={() => onSelect?.(session.id)}
      >
        <span className="ade-session-title">{session.title}</span>
        {session.agentRole ? (
          <span className="ade-session-role">{session.agentRole}</span>
        ) : null}
      </div>
      {tree.children.map((child) => (
        <SessionRow
          key={child.session.id}
          tree={child}
          depth={depth + 1}
          activePaneId={activePaneId}
          onSelect={onSelect}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      ))}
    </React.Fragment>
  );
}

export function Sidebar({
  workspaces: workspacesProp,
  sessions: sessionsProp,
  activePaneId,
  onSessionSelect,
  onSessionDragStart,
  onSessionDragMove,
  onSessionDragEnd,
}: SidebarProps) {
  const hookData = useWorkspaces();
  const workspaces = workspacesProp ?? hookData.workspaces;
  const sessions = sessionsProp ?? hookData.sessions;

  const sessionsByWorkspace = React.useMemo(() => {
    const map = new Map<string, Session[]>();
    for (const session of sessions) {
      const list = map.get(session.workspaceId) ?? [];
      list.push(session);
      map.set(session.workspaceId, list);
    }
    return map;
  }, [sessions]);

  return (
    <aside className="ade-sidebar">
      <div className="ade-sidebar-header">Workspaces</div>
      {workspaces.map((workspace) => {
        const workspaceSessions = sessionsByWorkspace.get(workspace.id) ?? [];
        if (workspaceSessions.length === 0) {
          return (
            <div className="ade-workspace-group" key={workspace.id}>
              <div className="ade-workspace-title">{workspace.name}</div>
            </div>
          );
        }
        const tree = buildTree(workspaceSessions);
        return (
          <div className="ade-workspace-group" key={workspace.id}>
            <div className="ade-workspace-title">{workspace.name}</div>
            {tree.map((node) => (
              <SessionRow
                key={node.session.id}
                tree={node}
                depth={0}
                activePaneId={activePaneId}
                onSelect={onSessionSelect}
                onDragStart={onSessionDragStart}
                onDragMove={onSessionDragMove}
                onDragEnd={onSessionDragEnd}
              />
            ))}
          </div>
        );
      })}
    </aside>
  );
}