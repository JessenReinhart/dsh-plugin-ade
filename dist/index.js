import { Service } from "@deepseek-ai/cordis";
import * as store from "./state-store.js";
class AdeService extends Service {
  static inject = ["workspaceRegistry", "sessions"];
  constructor(ctx) {
    super(ctx, "ade");
    ctx.on("agent/status", (payload) => {
      const sessionId = payload?.agent?.id;
      const status = payload?.status;
      if (sessionId) {
        ctx.emit("ade/event", {
          type: "status",
          sessionId: String(sessionId),
          data: { status }
        });
      }
    });
    ctx.on("agent/turn-stopping", (payload) => {
      const sessionId = payload?.agent?.id;
      if (sessionId) {
        ctx.emit("ade/event", {
          type: "turn-stopping",
          sessionId: String(sessionId),
          data: { turn: payload.turn }
        });
      }
    });
  }
  /** Read durable workspaces and active sessions from the host registry. */
  listWorkspaces() {
    const registry = this.ctx.workspaceRegistry;
    const sessions = this.ctx.sessions;
    return {
      workspaces: registry ? registry.list() : [],
      sessions: sessions ? sessions.list() : []
    };
  }
  /** Save an ADE layout for a workspace. */
  saveLayout(workspaceId, layout) {
    store.saveLayout(workspaceId, layout);
  }
  /** Load an ADE layout for a workspace. */
  loadLayout(workspaceId) {
    return store.loadLayout(workspaceId);
  }
  /** Dispatch a user prompt to target sessions (single or broadcast). */
  async broadcastMessage(sessionIds, text) {
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
        } catch (_) {
        }
      }
      const agentLoop = this.ctx.agentLoop;
      if (agentLoop && typeof agentLoop.dispatchUserMessage === "function") {
        try {
          await agentLoop.dispatchUserMessage(sessionId, { role: "user", text });
          sentCount++;
          continue;
        } catch (_) {
        }
      }
      this.ctx.emit("ade/event", {
        type: "user-message",
        sessionId,
        data: { text }
      });
      sentCount++;
    }
    return { sent: sentCount };
  }
}
function apply(ctx) {
  ctx.plugin(AdeService);
}
const AdePlugin = {
  name: "@community/dsh-plugin-ade",
  inject: AdeService.inject,
  apply(ctx) {
    ctx.plugin(AdeService);
  }
};
var index_default = AdePlugin;
export {
  AdeService,
  apply,
  index_default as default
};
