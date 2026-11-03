import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
const DIR = join(homedir(), ".dsh", "ade-layouts");
function fileFor(workspaceId) {
  return join(DIR, `${sanitize(workspaceId)}.json`);
}
function sanitize(id) {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}
function ensureLayoutDir() {
  mkdirSync(DIR, { recursive: true });
  return DIR;
}
function saveLayout(workspaceId, layout) {
  ensureLayoutDir();
  const record = {
    workspaceId,
    layout,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  writeFileSync(fileFor(workspaceId), JSON.stringify(record, null, 2));
  return record;
}
function loadLayout(workspaceId) {
  const path = fileFor(workspaceId);
  try {
    const record = JSON.parse(readFileSync(path, "utf8"));
    return record.layout;
  } catch {
    return void 0;
  }
}
export {
  ensureLayoutDir,
  loadLayout,
  saveLayout
};
