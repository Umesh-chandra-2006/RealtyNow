#!/usr/bin/env node
// =============================================================================
// docs-sync.mjs — source-of-truth inventory generator + drift checker.
//
// Discovers the REAL API surface from the codebase and emits it into
// docs/generated/ so the documentation can never silently drift from the code:
//
//   - Edge functions        <- supabase/functions/*/index.ts
//   - DB functions (RPCs)   <- CREATE FUNCTION in supabase/migrations/*.sql
//   - Tables                <- CREATE TABLE in supabase/migrations/*.sql
//   - Client query targets  <- `.from('tbl')` / `.rpc('fn')` in src/**
//   - Dependency usage      <- imports in src/** and supabase/functions/**
//
// Usage:
//   node scripts/docs-sync.mjs            # regenerate docs/generated/* + snapshot
//   node scripts/docs-sync.mjs --check    # compare current surface to committed
//                                         # snapshot; exit(1) on drift (CI gate)
//
// Emitted files (all marked "do not edit"):
//   docs/generated/api-inventory.md
//   docs/generated/dependencies.md
//   docs/generated/.snapshot.json
//
// Requires Node built-ins only (fs/path). Node 18+.
// =============================================================================

import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GEN_DIR = join(ROOT, 'docs', 'generated');
const SNAPSHOT = join(GEN_DIR, '.snapshot.json');
const CHECK = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// Small filesystem helpers
// ---------------------------------------------------------------------------
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

// Stable, platform-independent relative path (posix separators).
function rel(file) {
  return file.replaceAll(sep, '/').replace(ROOT.replaceAll(sep, '/') + '/', '');
}

const read = (f) => {
  try {
    return readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};

const uniq = (arr) => [...new Set(arr)].sort();

// ---------------------------------------------------------------------------
// 1. Edge functions
// ---------------------------------------------------------------------------
const FN_DIR = join(ROOT, 'supabase', 'functions');
const edgeFunctions = readdirSync(FN_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== '_shared' && existsSync(join(FN_DIR, d.name, 'index.ts')))
  .map((d) => d.name)
  .sort();

// ---------------------------------------------------------------------------
// 2 & 3. DB functions (RPCs) and tables from migrations
// ---------------------------------------------------------------------------
const migrationFiles = walk(join(ROOT, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql'));

const RPC_RE = /(?:CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+)(?:([a-z_][a-z0-9_]*)\s*\.\s*)?public\.([a-zA-Z_][a-zA-Z0-9_]*)\s*[\n\r(]/gi;
const FUNC_RE = /(?:CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+)(?:([a-z_][a-z0-9_]*)\s*\.\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\s*[\n\r(]/gi;
const TABLE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;

const rpcs = {};
const tables = {};
for (const f of migrationFiles) {
  const src = read(f);
  // Prefer full `public.`-qualified matches; fall back to any FUNCTION form.
  let m;
  let sawPublic = false;
  const re1 = new RegExp(RPC_RE.source, 'gi');
  while ((m = re1.exec(src)) !== null) {
    sawPublic = true;
    (rpcs[m[2]] ??= []).push(rel(f));
  }
  if (!sawPublic) {
    const re2 = new RegExp(FUNC_RE.source, 'gi');
    while ((m = re2.exec(src)) !== null) {
      (rpcs[m[2]] ??= []).push(rel(f));
    }
  }
  while ((m = TABLE_RE.exec(src)) !== null) {
    (tables[m[1]] ??= []).push(rel(f));
  }
}
const rpcNames = Object.keys(rpcs).sort();
const tableNames = Object.keys(tables).sort();

// ---------------------------------------------------------------------------
// 4. Client query targets (`.from('tbl')`, `.rpc('fn')`) from src/**
// ---------------------------------------------------------------------------
const srcFiles = walk(join(ROOT, 'src'))
  .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) && !f.includes(`${sep}test${sep}`));
const clientSources = srcFiles.map((f) => ({ path: f, src: read(f) }));
const FROM_RE = /\.from\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g;
const RPC_CALL_RE = /\.rpc\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g;
const clientTables = new Set();
const clientRpcCalls = new Set();
for (const { src } of clientSources) {
  let m;
  const reF = new RegExp(FROM_RE.source, 'g');
  while ((m = reF.exec(src)) !== null) clientTables.add(m[1]);
  const reR = new RegExp(RPC_CALL_RE.source, 'g');
  while ((m = reR.exec(src)) !== null) clientRpcCalls.add(m[1]);
}

// ---------------------------------------------------------------------------
// 5. Dependency usage
// ---------------------------------------------------------------------------
const pkg = JSON.parse(read(join(ROOT, 'package.json')));
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
const deps = Object.entries(allDeps)
  .map(([name, version]) => ({
    name,
    version: String(version).replace(/^[\^~]/, ''), // report resolved-ish major pin intent
    range: String(version),
    kind: pkg.devDependencies[name] ? 'dev' : 'runtime',
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

// package -> files that import it (client + edge, incl. Deno externals)
function scanImports(fileList, includeEdge = false) {
  const usage = new Map(); // name -> Set(rel file)
  const paths = includeEdge ? fileList : srcFiles;
  for (const f of paths) {
    const src = read(f);
    const m = src.matchAll(/from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g);
    for (const hit of m) {
      const spec = hit[1] || hit[2];
      if (!spec) continue;
      // npm:/jsr:/https: -> record the raw specifier as its own "package"
      if (spec.startsWith('npm:') || spec.startsWith('jsr:') || spec.startsWith('https://') || spec.startsWith('esm.sh/')) {
        if (!usage.has(spec)) usage.set(spec, new Set());
        usage.get(spec).add(rel(f));
        continue;
      }
      // bare specifier -> match against installed packages by name boundary
      const bare = spec.startsWith('@')
        ? spec.split('/').slice(0, 2).join('/')
        : spec.split('/')[0];
      if (bare && allDeps[bare]) {
        if (!usage.has(bare)) usage.set(bare, new Set());
        usage.get(bare).add(rel(f));
      }
    }
  }
  return usage;
}

const clientUsage = scanImports(srcFiles);
const edgeFiles = walk(FN_DIR).filter((f) => f.endsWith('.ts'));
const edgeUsage = scanImports(edgeFiles, true);

// Internal module map
const libModules = readdirSync(join(ROOT, 'src', 'lib')).filter((f) => f.endsWith('.ts')).sort();
const sharedFiles = readdirSync(join(FN_DIR, '_shared')).sort();

// ---------------------------------------------------------------------------
// Edge-function per-directory dependency facts (first import line each)
// ---------------------------------------------------------------------------
const edgeDenoDeps = {};
for (const fn of edgeFunctions) {
  edgeDenoDeps[fn] = uniq(
    edgeFiles
      .filter((f) => f.includes(`${sep}${fn}${sep}`) || f === join(FN_DIR, fn, 'index.ts'))
      .flatMap((f) => {
        const src = read(f);
        const out = [];
        for (const hit of src.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
          const s = hit[1];
          if (s.startsWith('npm:') || s.startsWith('jsr:') || s.startsWith('https://') || s.startsWith('esm.sh/')) out.push(s);
        }
        return out;
      })
  );
}

// ---------------------------------------------------------------------------
// Snapshot + generation
// ---------------------------------------------------------------------------
const stamp = () => new Date().toISOString().slice(0, 10);

function buildSnapshot() {
  return {
    generated: stamp(),
    edgeFunctions,
    rpcs: rpcNames,
    tables: tableNames,
    clientQueryTargets: { tables: uniq([...clientTables]), rpcs: uniq([...clientRpcCalls]) },
    dependencies: deps.map((d) => `${d.name}@${d.range}`),
    denoExternals: edgeFunctions.flatMap((fn) => edgeDenoDeps[fn]).filter((v, i, a) => a.indexOf(v) === i).sort(),
    edgeDenoDeps,
    libModules,
  };
}

function renderInventory() {
  const L = [];
  L.push('<!-- AUTO-GENERATED by scripts/docs-sync.mjs — DO NOT EDIT. Re-run: node scripts/docs-sync.mjs -->');
  L.push('');
  L.push(`# API Surface Inventory (generated ${stamp()})`);
  L.push('');
  L.push('This file is produced from the code itself. If it does not match the code, run the generator.');
  L.push('');
  L.push(`## Supabase Edge Functions (${edgeFunctions.length})`);
  L.push('');
  L.push(`> Endpoint base: \`https://<project-ref>.supabase.co/functions/v1/<name>\` — all require \`Authorization: Bearer <token>\` unless stated otherwise. Deep-dives: see \`docs/API.md\`.`);
  L.push('');
  L.push('| Function | Deno external dependencies |');
  L.push('| --- | --- |');
  for (const fn of edgeFunctions) {
    const deps = edgeDenoDeps[fn];
    L.push(`| \`${fn}\` | ${deps.length ? deps.map((d) => '<code>' + d + '</code>').join('<br>') : '—'} |`);
  }
  L.push('');
  L.push(`## Client query targets (from \`src/**\`)`);
  L.push('');
  L.push('Tables referenced via `.from(...)`:');
  L.push('');
  L.push(uniq([...clientTables]).map((t) => '`' + t + '`').join(', ') || '—');
  L.push('');
  L.push('RPCs referenced via `.rpc(...)`:');
  L.push('');
  L.push(uniq([...clientRpcCalls]).map((t) => '`' + t + '`').join(', ') || '—');
  L.push('');
  L.push(`## Database functions — RPC inventory (${rpcNames.length})`);
  L.push('');
  L.push('Every `CREATE FUNCTION` in the migration history. Reader-facing RPCs documented in depth in `docs/API.md`.');
  L.push('');
  L.push(rpcNames.map((n) => '`' + n + '`').join(', '));
  L.push('');
  L.push(`## Tables (${tableNames.length})`);
  L.push('');
  L.push('Every `CREATE TABLE` in the migration history (includes superseded/renamed versions and implementation tables).');
  L.push('');
  L.push(tableNames.map((n) => '`' + n + '`').join(', '));
  L.push('');
  return L.join('\n');
}

function renderDependencies() {
  const L = [];
  L.push('<!-- AUTO-GENERATED by scripts/docs-sync.mjs — DO NOT EDIT. Re-run: node scripts/docs-sync.mjs -->');
  L.push('');
  L.push(`# Dependency & Module Inventory (generated ${stamp()})`);
  L.push('');
  L.push('Purpose field and "where used" detail are curated in `docs/DEPENDENCIES.md`; the tables below are generated from source.');
  L.push('');
  L.push(`## npm dependencies (${deps.length})`);
  L.push('');
  L.push('| Package | Version range | Kind | Client usage (files) |');
  L.push('| --- | --- | --- | --- |');
  for (const d of deps) {
    const files = [...(clientUsage.get(d.name) ?? [])];
    const shown = files.slice(0, 4).map((f) => '`' + f + '`').join(', ') + (files.length > 4 ? ` (+${files.length - 4})` : '');
    L.push(`| \`${d.name}\` | ${d.range} | ${d.kind} | ${shown || '—'} |`);
  }
  L.push('');
  L.push(`## Deno external specifiers (edge functions)`);
  L.push('');
  L.push('| Package | Used by |');
  L.push('| --- | --- |');
  const bySpec = {};
  for (const fn of edgeFunctions) {
    for (const s of edgeDenoDeps[fn]) bySpec[s] = [...(bySpec[s] ?? []), fn];
  }
  for (const [spec, fns] of Object.entries(bySpec).sort()) {
    L.push(`| \`${spec}\` | ${fns.map((f) => '`' + f + '`').join(', ')} |`);
  }
  L.push('');
  L.push(`## Internal modules — src/lib (${libModules.length})`);
  L.push('');
  L.push(libModules.map((f) => '`' + f + '`').join(', '));
  L.push('');
  L.push(`## Shared edge-function helpers — supabase/functions/_shared (${sharedFiles.length})`);
  L.push('');
  L.push(sharedFiles.map((f) => '`' + f + '`').join(', '));
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const snapshot = buildSnapshot();

if (CHECK) {
  if (!existsSync(SNAPSHOT)) {
    console.error('docs-sync: no committed snapshot found (%s). Run `node scripts/docs-sync.mjs` first.', SNAPSHOT);
    process.exit(1);
  }
  const committed = JSON.parse(read(SNAPSHOT));
  const { generated: _g, ...cA } = committed;
  const { generated: _g2, ...cB } = snapshot;
  if (JSON.stringify(cA) !== JSON.stringify(cB)) {
    console.error('docs-sync FAIL: documented surface drifts from code. Re-run `node scripts/docs-sync.mjs` and commit.');
    console.error('  edgeFunctions:    ' + (JSON.stringify(cA.edgeFunctions) === JSON.stringify(cB.edgeFunctions) ? 'ok' : 'CHANGED'));
    console.error('  rpcs:             ' + (JSON.stringify(cA.rpcs) === JSON.stringify(cB.rpcs) ? 'ok' : 'CHANGED'));
    console.error('  tables:           ' + (JSON.stringify(cA.tables) === JSON.stringify(cB.tables) ? 'ok' : 'CHANGED'));
    console.error('  clientQueries:    ' + (JSON.stringify(cA.clientQueryTargets) === JSON.stringify(cB.clientQueryTargets) ? 'ok' : 'CHANGED'));
    console.error('  dependencies:     ' + (JSON.stringify(cA.dependencies) === JSON.stringify(cB.dependencies) ? 'ok' : 'CHANGED'));
    console.error('  denoExternals:    ' + (JSON.stringify(cA.denoExternals) === JSON.stringify(cB.denoExternals) ? 'ok' : 'CHANGED'));
    console.error('  libModules:       ' + (JSON.stringify(cA.libModules) === JSON.stringify(cB.libModules) ? 'ok' : 'CHANGED'));
    process.exit(1);
  }
  console.log('docs-sync OK: documented API surface matches code.');
  process.exit(0);
}

if (!existsSync(GEN_DIR)) mkdirSync(GEN_DIR, { recursive: true });

writeFileSync(join(GEN_DIR, 'api-inventory.md'), renderInventory());
writeFileSync(join(GEN_DIR, 'dependencies.md'), renderDependencies());
writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
console.log('docs-sync: regenerated docs/generated/* and .snapshot.json');