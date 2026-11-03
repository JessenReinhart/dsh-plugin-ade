import * as React from 'react';
import type { Workspace, Session } from '../components/types.js';

export interface UseWorkspacesResult {
  workspaces: Workspace[];
  sessions: Session[];
  loading: boolean;
  error: Error | null;
  refresh?: () => Promise<void>;
}

export const WorkspacesContext = React.createContext<UseWorkspacesResult>({
  workspaces: [],
  sessions: [],
  loading: false,
  error: null,
});

/**
 * Accesses live workspaces and sessions from the nearest WorkspacesContext,
 * falling back to window.parent ADE bridge state or defaults when standalone.
 */
export function useWorkspaces(): UseWorkspacesResult {
  const context = React.useContext(WorkspacesContext);
  return context;
}