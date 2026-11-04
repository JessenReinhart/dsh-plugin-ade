import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const CLIENT_SOURCE_FILES = [
  'client/index.js',
  'client/node-graph.js',
  'client/layout-engine.js',
];

function forOfStatements(code) {
  const statements = [];
  const re = /for\s*\(\s*(const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+([^)]+)\)/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    statements.push({
      kind: m[1],
      loopVar: m[2],
      iterableExpr: m[3].trim(),
      index: m.index,
    });
  }
  return statements;
}

describe('Client Source Static Analysis (TDZ / shadowing regression)', () => {
  for (const rel of CLIENT_SOURCE_FILES) {
    const file = join(root, rel);

    it(`${rel} has no self-referential for...of loop (would throw ReferenceError)`, () => {
      const code = readFileSync(file, 'utf8');

      for (const stmt of forOfStatements(code)) {
        // A `for (const X of X)` reference is a TDZ ReferenceError at runtime.
        // It arises after a rename where the loop variable shadows / aliases
        // the iterable in the same declaration scope.
        assert.notStrictEqual(
          stmt.loopVar,
          stmt.iterableExpr.replace(/;.*$/, '').trim(),
          `Self-referential loop detected at offset ${stmt.index}: for (${stmt.kind} ${stmt.loopVar} of ${stmt.iterableExpr})`
        );
      }
    });

    it(`${rel} has no loop variable shadowing a same-named variable in the iterable`, () => {
      const code = readFileSync(file, 'utf8');
      for (const stmt of forOfStatements(code)) {
        const iterable = stmt.iterableExpr.replace(/;$/, '').trim();
        // Direct identifier match (e.g. `const savedLayout of saved` where
        // `saved` also names an earlier binding) is suspicious but legitimate
        // only when the loop var differs. We flag the exact same-name case.
        if (/^[A-Za-z_$][\w$]*$/.test(iterable)) {
          assert.notStrictEqual(stmt.loopVar, iterable, `Likely TDZ: for (${stmt.kind} ${stmt.loopVar} of ${iterable})`);
        }
      }
    });
  }
});