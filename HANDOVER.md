# ADE handover — 2026-11-04

## Status
- `community-ade` (bundle id `@community/dsh-plugin-ade`) no longer causes freeze.
- Web Auth startup crash root-caused and fixed (cookie accumulation, not plugin).
- App launches, renderer CPU stays < 5% over 30s sampling, no new crash log.

## Root cause: "desktop welcome: Web authentication failed" (startup crash, NOT plugin)
- Every DSH launch spins the host on a random `127.0.0.1:<port>`.
- Host auth cookie name is `dsh-auth-<base64url(sha256(authority))>`, so each new port
  creates a NEW cookie scoped only to `127.0.0.1` (browsers ignore port).
- Cookies accumulate, never evicted. ~70 rows × ~227 bytes blows past Node HTTP
  server default `maxHeaderSize` (16 KB) -> host answers 431 -> `connectDesktopWelcome`
  throws `Web authentication failed` at startup.
- Evidence: `Network\Cookies` had 71 `dsh-auth-*` rows, `sum(length(name)+length(value))`
  = 15975 bytes before deletion.
- Fix applied: backed up and deleted all `dsh-auth-*` cookies for `127.0.0.1`/`localhost`,
  `VACUUM`. Diagnostic/cleanup scripts live in `scripts\check-cookies.cjs` and
  `scripts\clean-cookies.cjs`.
- Recurrence expected after ~a month of launches until upstream fix (port-independent
  cookie name or startup purge). Recovery = rerun `clean-cookies.cjs`.

## Fix yang sudah diterapkan
- File: `scripts/build.mjs`
- Masalah: client bundle mendaftarkan dirinya dua kali ke `window.__ModuleLoader__`, dua ID untuk factory yang sama:
  ```js
  window.__ModuleLoader__.load({ id: "@community/dsh-plugin-ade", factory: factory });
  window.__ModuleLoader__.load({ id: "community-ade", factory: factory });
  ```
- Akibat di log renderer:
  ```
  client-modules: duplicate factory registration for "community-ade"
  (bundle executed twice without invalidate?)
  ```
- Perbaikan: hanya daftarkan satu ID:
  ```js
  window.__ModuleLoader__.load({ id: "@community/dsh-plugin-ade", factory: factory });
  ```
- Rebuild sudah dijalankan: `node scripts/build.mjs` (status `Build complete.`).

## Fix usSyncExternalStore renderer loop
- File: `client/index.js`
- Masalah: `useSyncExternalStore` di React 18 dipakai dengan `getSnapshot` yang tidak
  di-cache (`() => readSessionsSnapshot()`), sehingga referensi hasil selalu baru tiap
  render via `Object.is`, memaksa infinite re-render / renderer 1-core loop.
- Perbaikan: tambah `getCachedSessionsSnapshot()` + `invalidateSessionsSnapshotCache()`,
  invalidate dipanggil setelah reconcile subagent. Snapshot `expandedSessionIds` tetap
  Set (stable reference), tidak bermasalah; konsumen utamanya memakai boolean primitive.

## Fix ADESubagentRowExpander DOM insertion loop
- File: `client/index.js`
- Masalah: `hostEl` disimpan di `useState`, lalu `hostEl` dimasukkan sebagai dependency
  `useEffect`. `setHostEl(host)` di dalam effect memicu effect re-run tiap kali host
  di-insert, cleanup membuang host, effect insert lagi -> loop mount/unmount.
- Perbaikan: DOM host disimpan di `React.useRef` (`hostRef`), `useState` hanya untuk
  trigger render portal. Dependency effect dikurangi jadi `[isExpanded, sessionId,
  children.length]`; `setHostEl` hanya dipanggil saat host pertama dibuat.
- Rebuild dijalankan ulang (status `Build complete.`).
- Validasi: DeepSeek Harness Desktop diluncurkan, 5 proses renderer/host terpantau
  `CPU_Percent = 0` selama sampling 3 detik, tidak ada crash log baru (`crash-*.log`
  terakhir tetap `2026-11-03`).

## Masalah tersisa yang perlu dicek agent utama
Log crash yang sama juga memuat error ini (belum tentu hilang dengan build fix):
1. `ReferenceError: getSnapshot is not defined`
   - Sumber stack: `dsh-app://app/assets/index-BXV-oxvX.js:56`
   - Bukan dari `client/index.js` ADE (grep `getSnapshot` tidak menemukan bare call).
2. `cannot get required service "sessions" in inactive context`
   - Muncul berulang sebelum host crash.
3. Host crash `CordisError: cannot create effect on inactive context` / `INACTIVE_EFFECT`
   - Terjadi saat `Fiber._reload` (live patch reload) memproses patch.

## Langkah kalau masih freeze
1. Tutup DSHS.
2. Disable sementara di:
   - `C:\Users\LGSM228\.dsh\profiles\desktop\cordis.patch.yml`
   - tambah entri:
     ```yaml
     - id: community-ade
       disabled: true
     ```
   atau hapus `"@community/dsh-plugin-ade"` dari `dsh.profile.bundles` di
   `C:\Users\LGSM228\.dsh\profiles\desktop\package.json`.
3. Buka lagi DSHS, pastikan tidak freeze.
4. Untuk memunculkan kembali plugin, hapus/ubah entri disable tadi, lalu rebuild ADE dan restart DSHS.

## File config penting
- Profile desktop:
  - `C:\Users\LGSM228\.dsh\profiles\desktop\cordis.patch.yml`
  - `C:\Users\LGSM228\.dsh\profiles\desktop\package.json`
- ADE source:
  - host: `C:\tmp\dsh-plugin-ade\src\index.ts`
  - client: `C:\tmp\dsh-plugin-ade\client\index.js`
  - build: `C:\tmp\dsh-plugin-ade\scripts\build.mjs`
- Log crash DSHS:
  - `C:\Users\LGSM228\AppData\Roaming\@deepseek-ai\dsh-desktop\logs\` (lihat file `crash-*.log` / `dsh-*.error.log`).