import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface AdeLayout {
  workspaceId: string;
  layout: unknown;
  updatedAt: string;
}

const DIR = join(homedir(), ".dsh", "ade-layouts");

function fileFor(workspaceId: string): string {
  return join(DIR, `${sanitize(workspaceId)}.json`);
}

function sanitize(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/** Ensure the ADE layout directory exists. */
export function ensureLayoutDir(): string {
  mkdirSync(DIR, { recursive: true });
  return DIR;
}

/** Persist an ADE layout for a workspace. */
export function saveLayout(workspaceId: string, layout: unknown): AdeLayout {
  ensureLayoutDir();
  const record: AdeLayout = {
    workspaceId,
    layout,
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(fileFor(workspaceId), JSON.stringify(record, null, 2));
  return record;
}

/** Load a persisted ADE layout for a workspace, if any. */
export function loadLayout(workspaceId: string): unknown | undefined {
  const path = fileFor(workspaceId);
  try {
    const record = JSON.parse(readFileSync(path, "utf8")) as AdeLayout;
    return record.layout;
  } catch {
    return undefined;
  }
}