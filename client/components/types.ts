// Re-export the frozen layout-engine contract so UI code imports one surface.
export type {
  SplitZone,
  SplitDirection,
  Rect,
  PaneNode,
  SplitNode,
  LayoutNode,
  LayoutTree,
  DropZoneResult,
  ResizeResult,
} from '../../src/layout/engine.js';

/** Human-readable pane state used for status dots. */
export type PaneStatus = 'idle' | 'running' | 'success' | 'error';

export interface ToolCall {
  id: string;
  name: string;
  input?: string;
  output?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  codeBlocks?: string[];
  timestamp?: number | string;
}

export interface PaneData {
  id: string;
  title: string;
  workspaceId?: string;
  workspaceName?: string;
  status: PaneStatus;
  messages: Message[];
}

export interface Workspace {
  id: string;
  name: string;
}

export interface Session {
  id: string;
  workspaceId: string;
  parentId?: string | null;
  title: string;
  status?: PaneStatus;
  agentRole?: string;
}

/** Payload carried by a Sidebar session drag via pointer capture. */
export interface DragSessionPayload {
  type: 'ade/session';
  sessionId: string;
  title: string;
  workspaceId?: string;
}

/** Drop preview already positioned relative to the stage container. */
export interface DropPreview {
  rect: { left: number; top: number; width: number; height: number };
  label: string;
}

export type LayoutPreset = 'single' | '2col' | '2x2';

export const LAYOUT_PRESETS: ReadonlyArray<{ id: LayoutPreset; label: string }> = [
  { id: 'single', label: 'Single' },
  { id: '2col', label: '2 Col' },
  { id: '2x2', label: '2x2 Grid' },
];