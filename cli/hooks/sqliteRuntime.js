// Ensure sql.js (wasm) is available in USER_DATA_DIR/runtime/node_modules as the
// fallback driver. node:sqlite (Node ≥22.5) / bun:sqlite are built-in; sql.js is
// bundled in bin/app. No native modules — nothing to compile.
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SQL_JS_VERSION = "1.14.1";

function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  return process.platform === "win32"
    ? path.join(process.env.APPDATA || os.homedir(), "9router")
    : path.join(os.homedir(), ".9router");
}

function getRuntimeDir() {
  return path.join(getDataDir(), "runtime");
}

function getRuntimeNodeModules() {
  return path.join(getRuntimeDir(), "node_modules");
}

function ensureRuntimeDir() {
  const dir = getRuntimeDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Minimal package.json so npm treats it as a project root
  const pkgPath = path.join(dir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(pkgPath, JSON.stringify({
      name: "9router-runtime",
      version: "1.0.0",
      private: true,
      description: "User-writable runtime deps for 9router (sql.js fallback driver)",
    }, null, 2));
  }
  return dir;
}

// Extract a short, user-friendly reason from npm stderr.
function summarizeNpmError(stderr = "") {
  const text = String(stderr);
  if (/ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|getaddrinfo/i.test(text)) return "No internet connection or registry unreachable";
  if (/EACCES|EPERM|permission denied/i.test(text)) return "Permission denied (check folder permissions)";
  if (/ENOSPC|no space/i.test(text)) return "Not enough disk space";
  if (/ETARGET|version.*not found/i.test(text)) return "Package version not found on registry";
  const m = text.match(/npm ERR! (.+)/);
  if (m) return m[1].slice(0, 200);
  const lastLine = text.trim().split(/\r?\n/).filter(Boolean).pop();
  return lastLine ? lastLine.slice(0, 200) : "Unknown error";
}

function runNpmInstall({ cwd, pkgs, extraArgs = [], timeout = 180000 }) {
  const args = ["install", ...pkgs, "--no-audit", "--no-fund", "--prefer-online", ...extraArgs];
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const res = spawnSync(npmCmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    timeout,
    shell: process.platform === "win32",
    encoding: "utf8",
  });
  return { ok: res.status === 0, code: res.status, stderr: res.stderr || "", stdout: res.stdout || "" };
}

function npmInstall(pkgs, opts = {}) {
  const cwd = ensureRuntimeDir();
  if (!opts.silent) console.log("⏳ Installing SQLite engine (first run)...");
  const res = runNpmInstall({ cwd, pkgs, extraArgs: ["--no-save"], timeout: opts.timeout || 180000 });
  if (!res.ok && !opts.silent) {
    const reason = summarizeNpmError(res.stderr);
    console.warn("⚠️  SQLite engine install failed — using fallback");
    console.warn(`   Reason: ${reason}`);
    console.warn(`   Retry:  cd "${cwd}" && npm install ${pkgs.join(" ")}`);
  }
  return res.ok;
}

// sql.js may be bundled in bin/app, but npm publish strips .wasm from nested
// node_modules — verify and reinstall if missing.
function isSqlJsWasmValid() {
  const bundledWasm = path.join(__dirname, "..", "app", "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  if (fs.existsSync(bundledWasm)) return true;
  const runtimeWasm = path.join(getRuntimeNodeModules(), "sql.js", "dist", "sql-wasm.wasm");
  return fs.existsSync(runtimeWasm);
}

// Public: ensure a SQLite driver is usable. node:sqlite (Node ≥22.5) needs no
// install; for older Node, sql.js (wasm, bundled) is the fallback — verify its
// wasm is present and reinstall to the user-writable runtime dir if not.
function ensureSqliteRuntime({ silent = false } = {}) {
  ensureRuntimeDir();

  let sqlJsOk = isSqlJsWasmValid();
  if (!sqlJsOk) {
    sqlJsOk = npmInstall([`sql.js@${SQL_JS_VERSION}`], { silent });
    if (sqlJsOk) sqlJsOk = isSqlJsWasmValid();
  }

  if (!silent) console.log("✅ SQLite engine ready");
  return { sqlJs: sqlJsOk };
}

// Inject runtime + bundled node_modules into NODE_PATH so child Node processes
// resolve sql.js (bundled in bin/app/node_modules, or runtime dir fallback).
function buildEnvWithRuntime(baseEnv = process.env) {
  const runtimeNm = getRuntimeNodeModules();
  const bundledNm = path.join(__dirname, "..", "app", "node_modules");
  const existing = baseEnv.NODE_PATH || "";
  const NODE_PATH = [runtimeNm, bundledNm, existing].filter(Boolean).join(path.delimiter);
  return { ...baseEnv, NODE_PATH };
}

module.exports = {
  ensureSqliteRuntime,
  buildEnvWithRuntime,
  getRuntimeDir,
  getRuntimeNodeModules,
  runNpmInstall,
  summarizeNpmError,
};
