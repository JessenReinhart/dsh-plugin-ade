import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const bundlePath = resolve(root, 'dist/client/index.js');
const pkgPath = resolve(root, 'package.json');

describe('Client Bundle Loader & Execution', () => {
  it('dist/client/index.js exists and is non-empty', () => {
    assert.ok(existsSync(bundlePath), 'dist/client/index.js must exist. Run build before test.');
    const code = readFileSync(bundlePath, 'utf8');
    assert.ok(code.length > 1000, 'Bundle must not be empty');
  });

  it('registers exactly one module with DSH ModuleLoader matching package.json', () => {
    const code = readFileSync(bundlePath, 'utf8');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    const loadCalls = [...code.matchAll(/window\.__ModuleLoader__\.load\(\s*\{([^}]+)\}\s*\)/g)];
    assert.strictEqual(loadCalls.length, 1, 'Must call __ModuleLoader__.load exactly once to prevent freeze');

    // Verify registered ID matches package.json name exactly
    const idMatch = loadCalls[0][1].match(/id:\s*["']([^"']+)["']/);
    assert.ok(idMatch, 'Module id must be specified in load call');
    assert.strictEqual(idMatch[1], pkg.name, 'Module id must match package.json name');

    // Verify obsolete or duplicate alias "community-ade" is NOT registered
    assert.ok(!code.includes('id: "community-ade"'), 'Legacy alias community-ade must not be registered');
    assert.ok(!code.includes("id: 'community-ade'"), 'Legacy alias community-ade must not be registered');
  });

  it('loads and initializes in simulated browser/DSH runtime without throwing', () => {
    const code = readFileSync(bundlePath, 'utf8');

    let registeredModule = null;
    const mockStorage = new Map();

    // Mock DOM Element
    function createMockElement(tag) {
      const listeners = {};
      const children = [];
      const attrs = {};
      return {
        tagName: (tag || 'DIV').toUpperCase(),
        style: {},
        dataset: {},
        childNodes: children,
        children,
        appendChild(child) {
          children.push(child);
          if (child) child.parentNode = this;
          return child;
        },
        removeChild(child) {
          const idx = children.indexOf(child);
          if (idx !== -1) children.splice(idx, 1);
          return child;
        },
        insertBefore(child, ref) {
          const idx = children.indexOf(ref);
          if (idx !== -1) children.splice(idx, 0, child);
          else children.push(child);
          return child;
        },
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return attrs[k] ?? null; },
        removeAttribute(k) { delete attrs[k]; },
        addEventListener(event, fn) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(fn);
        },
        removeEventListener(event, fn) {
          if (!listeners[event]) return;
          listeners[event] = listeners[event].filter((f) => f !== fn);
        },
        querySelector() { return null; },
        querySelectorAll() { return []; },
        getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; },
      };
    }

    const mockHead = createMockElement('HEAD');
    const mockBody = createMockElement('BODY');

    const mockDocument = {
      head: mockHead,
      body: mockBody,
      createElement(tag) { return createMockElement(tag); },
      querySelector(sel) {
        if (sel === 'head') return mockHead;
        if (sel === 'body') return mockBody;
        return null;
      },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      addEventListener() {},
      removeEventListener() {},
    };

    const mockWindow = {
      __ModuleLoader__: {
        load(entry) {
          registeredModule = entry;
        },
      },
      document: mockDocument,
      localStorage: {
        getItem(k) { return mockStorage.get(k) || null; },
        setItem(k, v) { mockStorage.set(k, String(v)); },
        removeItem(k) { mockStorage.delete(k); },
      },
      sessionStorage: {
        getItem() { return null; },
        setItem() {},
        removeItem() {},
      },
      addEventListener() {},
      removeEventListener() {},
      setTimeout(fn) { return setTimeout(fn, 0); },
      clearTimeout(id) { clearTimeout(id); },
      requestAnimationFrame(fn) { return setTimeout(fn, 16); },
      cancelAnimationFrame(id) { clearTimeout(id); },
      dispatchEvent() { return true; },
      location: { href: 'http://localhost/' },
    };

    // React mock with required hooks and Component
    class MockComponent {
      constructor(props) { this.props = props; this.state = {}; }
      setState(next) { Object.assign(this.state, typeof next === 'function' ? next(this.state) : next); }
      render() { return null; }
    }

    const mockReact = {
      Component: MockComponent,
      PureComponent: MockComponent,
      createElement(type, props, ...children) {
        return { type, props: props || {}, children };
      },
      useState(initial) {
        return [typeof initial === 'function' ? initial() : initial, () => {}];
      },
      useRef(initial) { return { current: initial }; },
      useMemo(fn) { return fn(); },
      useCallback(fn) { return fn; },
      useEffect() {},
      useLayoutEffect() {},
      useSyncExternalStore(subscribe, getSnapshot) {
        assert.strictEqual(typeof subscribe, 'function', 'useSyncExternalStore subscribe must be a function');
        assert.strictEqual(typeof getSnapshot, 'function', 'useSyncExternalStore getSnapshot must be a function');
        return getSnapshot();
      },
    };
    mockReact.default = mockReact;

    const mockRequire = (id) => {
      if (id === 'react') return mockReact;
      if (id === 'react-dom') {
        return {
          createPortal(el) { return el; },
        };
      }
      if (id === 'react/jsx-runtime') {
        return {
          jsx: mockReact.createElement,
          jsxs: mockReact.createElement,
        };
      }
      return {};
    };

    const context = vm.createContext({
      window: mockWindow,
      document: mockDocument,
      localStorage: mockWindow.localStorage,
      sessionStorage: mockWindow.sessionStorage,
      setTimeout,
      clearTimeout,
      console,
      require: mockRequire,
      module: { exports: {} },
      exports: {},
    });

    // Execute bundle script in VM
    assert.doesNotThrow(() => {
      vm.runInContext(code, context);
    }, 'Evaluating client bundle must not throw ReferenceError or SyntaxError');

    assert.ok(registeredModule, 'Bundle must call __ModuleLoader__.load');
    assert.strictEqual(typeof registeredModule.factory, 'function', 'factory must be a function');

    // Execute factory
    let exported = null;
    assert.doesNotThrow(() => {
      exported = registeredModule.factory(mockRequire);
    }, 'Factory execution must not throw');

    assert.ok(exported, 'Factory must return module exports');
    assert.strictEqual(typeof exported.apply, 'function', 'Plugin must export apply() function');
    assert.ok(Array.isArray(exported.inject), 'Plugin must export inject array');
    assert.ok(exported.inject.includes('slots'), 'inject must include slots');
    assert.ok(exported.inject.includes('sessions'), 'inject must include sessions');
    assert.ok(exported.inject.includes('layout'), 'inject must include layout');

    // Test apply(ctx) lifecycle
    const mockCtx = {
      slots: {
        subscribe() { return () => {}; },
        register() {},
        get() { return null; },
        getTable() { return []; },
      },
      sessions: {
        list: {
          getSnapshot() {
            return {
              byId: {
                'session-1': { id: 'session-1', title: 'Main Session', origin: 'user' },
                'session-sub': { id: 'session-sub', title: 'Subagent', origin: 'subagent', parentId: 'session-1' },
              },
            };
          },
          subscribe() { return () => {}; },
        },
      },
      layout: {
        selectPanel() {},
        hasMainPanel() { return true; },
      },
      uiWorkspace: {
        openSession() {},
      },
      workspaces: {},
    };

    let cleanup = null;
    assert.doesNotThrow(() => {
      cleanup = exported.apply(mockCtx);
    }, 'Plugin apply(mockCtx) must execute cleanly without runtime error');

    if (typeof cleanup === 'function') {
      assert.doesNotThrow(() => {
        cleanup();
      }, 'Plugin cleanup() must execute cleanly');
    }
  });
});
