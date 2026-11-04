import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

mkdirSync(resolve(root, 'dist/client'), { recursive: true });
mkdirSync(resolve(root, 'dist/layout'), { recursive: true });

async function build() {
  console.log('Building host backend...');
  await esbuild.build({
    entryPoints: [
      resolve(root, 'src/index.ts'),
      resolve(root, 'src/state-store.ts'),
      resolve(root, 'src/layout/engine.ts'),
    ],
    outdir: resolve(root, 'dist'),
    format: 'esm',
    platform: 'node',
    target: 'node22',
    bundle: false,
    sourcemap: false,
  });

  console.log('Building client bundle...');
  // Build client bundle as CJS for DSH __ModuleLoader__
  const clientBuild = await esbuild.build({
    entryPoints: [resolve(root, 'client/index.js')],
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    bundle: true,
    write: false,
    loader: { '.js': 'jsx', '.css': 'text' },
    external: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@deepseek-ai/cordis',
      '@deepseek-ai/*',
    ],
    sourcemap: false,
  });

  const rawCode = clientBuild.outputFiles[0].text;

  // Wrap like native DSH UI plugins: only register through
  // window.__ModuleLoader__.load. No CommonJS `module.exports` fallback,
  // because in the renderer both branches execute and run the factory twice,
  // triggering duplicate registration / freezes.
  const wrapped = `window.__ModuleLoader__.load({
  id: "@community/dsh-plugin-ade",
  factory: (require) => {
    if (typeof window !== 'undefined' && window.__ADE_CLIENT_LOADED__) {
      return window.__ADE_CLIENT_EXPORTS__;
    }
    var module = { exports: {} };
    var exports = module.exports;
    ${rawCode}
    if (typeof window !== 'undefined') {
      window.__ADE_CLIENT_LOADED__ = true;
      window.__ADE_CLIENT_EXPORTS__ = module.exports;
    }
    return module.exports;
  }
});
`;

  writeFileSync(resolve(root, 'dist/client/index.js'), wrapped, 'utf8');
  console.log('Build complete.');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
