import { Service, type Context } from "@deepseek-ai/cordis";
import * as store from "./state-store.js";

export interface WorkspaceRecord {
  id: string;
  path?: string;
  title?: string;
  sessionIds?: readonly string[];
  [key: string]: unknown;
}

export interface WorkspaceRegistry {
  list(): WorkspaceRecord[];
  get(id: string): WorkspaceRecord | undefined;
}

export interface SessionRecord {
  id?: string;
  sessionId?: string;
  parentSessionId?: string;
  [key: string]: unknown;
}

export interface Sessions {
  list(): SessionRecord[];
  get(id: string): unknown;
}

export interface AgentRef {
  id: string;
  steer?(message: unknown): Promise<void> | void;
  inject?(message: unknown): Promise<void> | void;
}

export interface AgentsService {
  get(sessionId: string): AgentRef | undefined;
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    ade: AdeService;
    workspaceRegistry: WorkspaceRegistry;
    sessions: Sessions;
    agents?: AgentsService;
    agentLoop: unknown;
  }

  interface Events {
    "agent/status"(payload: { agent: { id: string }; status: string }): void;
    "agent/turn-stopping"(payload: { agent: { id: string }; turn: number }): void;
    "ade/event"(payload: { type: string; sessionId?: string; data?: unknown }): void;
  }
}

/** ADE host service mounted on the host context. */
export class AdeService extends Service {
  static inject = ["workspaceRegistry", "sessions"] as const;

  constructor(ctx: Context) {
    super(ctx, "ade");

    // Live agent status updates (idle <-> running)
    ctx.on("agent/status", (payload) => {
      const sessionId = payload?.agent?.id;
      const status = payload?.status;
      if (sessionId) {
        ctx.emit("ade/event", {
          type: "status",
          sessionId: String(sessionId),
          data: { status },
        });
      }
    });

    // Agent turn conclusion notification
    ctx.on("agent/turn-stopping", (payload) => {
      const sessionId = payload?.agent?.id;
      if (sessionId) {
        ctx.emit("ade/event", {
          type: "turn-stopping",
          sessionId: String(sessionId),
          data: { turn: payload.turn },
        });
      }
    });
  }

  /** Read durable workspaces and active sessions from the host registry. */
  listWorkspaces(): { workspaces: WorkspaceRecord[]; sessions: SessionRecord[] } {
    const registry = this.ctx.workspaceRegistry;
    const sessions = this.ctx.sessions;
    return {
      workspaces: registry ? registry.list() : [],
      sessions: sessions ? sessions.list() : [],
    };
  }

  /** Save an ADE layout for a workspace. */
  saveLayout(workspaceId: string, layout: unknown): void {
    store.saveLayout(workspaceId, layout);
  }

  /** Load an ADE layout for a workspace. */
  loadLayout(workspaceId: string): unknown {
    return store.loadLayout(workspaceId);
  }

  /** Dispatch a user prompt to target sessions (single or broadcast). */
  async broadcastMessage(sessionIds: string[], text: string): Promise<{ sent: number }> {
    if (!text || !sessionIds.length) return { sent: 0 };
    let sentCount = 0;

    for (const sessionId of sessionIds) {
      if (!sessionId) continue;
      const agents = this.ctx.agents;
      const agent = agents?.get(sessionId);

      if (agent && typeof agent.steer === "function") {
        try {
          await agent.steer({ role: "user", content: text });
          sentCount++;
          continue;
        } catch (_) {}
      }

      // Fallback via sessions or agentLoop
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentLoop = this.ctx.agentLoop as any;
      if (agentLoop && typeof agentLoop.dispatchUserMessage === "function") {
        try {
          await agentLoop.dispatchUserMessage(sessionId, { role: "user", text });
          sentCount++;
          continue;
        } catch (_) {}
      }

      // Notify ADE clients of dispatched user prompt
      this.ctx.emit("ade/event", {
        type: "user-message",
        sessionId,
        data: { text },
      });
      sentCount++;
    }

    return { sent: sentCount };
  }
}

export function apply(ctx: Context): void {
  ctx.plugin(AdeService);
}

const AdePlugin = {
  name: "@community/dsh-plugin-ade",
  inject: AdeService.inject,
  apply(ctx: Context) {
    ctx.plugin(AdeService);
  },
};

export default AdePlugin;