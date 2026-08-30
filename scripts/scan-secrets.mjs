#!/usr/bin/env node
// RealtyNow secret scanner
// Scans the working tree for known-leaked credentials and high-entropy secrets
// before they can be committed again. Run manually: `node scripts/scan-secrets.mjs`
// It can be wired as a git pre-commit hook via `git config core.hooksPath scripts/githooks`.

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

// Directories/files we never scan (e.g. vendored deps, build output, git).
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'dist-ssr', '.git', '.vite', 'coverage', 'playwright-report', 'test-results', 'scratch', 'supabase/.temp',
]);
function scanableDir(name) {
  return !SKIP_DIRS.has(name) && !name.startsWith('.');
}

// Known-leaked secrets. Two categories:
//  - FAIL: values scrubbed from .env.example that must NEVER reappear in source
//    or committed config (a committed Maps key or MSG91 auth key is a regression).
//  - WARN: values that live only in already-applied migrations / seed data and
//    cannot be removed without a git-history rewrite. They remain until that
//    rewrite + credential rotation happen (see audit report), so we warn, not
//    block, to avoid locking the developer out of committing unrelated work.
const KNOWN_LEAKS = [
  { pattern: /AIzaSyB3ZBgokyE8rJQjZJNLGmXYu8APeoPRzEQ/, label: 'Google Maps API key (leaked)', level: 'FAIL' },
  { pattern: /377725TW8g1bjW6a6def54P1/, label: 'MSG91 widget token (leaked)', level: 'FAIL' },
  { pattern: /377725AaDUlgNyLN6a55ddadP1/, label: 'MSG91 AUTH_KEY (leaked)', level: 'FAIL' },
  { pattern: /jbopkeanshuetjjqofef/, label: 'Supabase project ref realtynow production', level: 'WARN' },
  { pattern: /c94c26244e5c08d5b81affea22d56f6b4ecff26b2a06a0fef4406fb2721c9c5b/, label: 'Admin password hash (known password)', level: 'WARN' },
];

// High-entropy secret candidate regexes (JWT-ish, long base64/hex tokens)
const ENTROPY_RULES = [
  { re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, label: 'JWT-like token' },
  { re: /\bAIza[0-9A-Za-z_-]{30,}\b/, label: 'Google API key' },
  { re: /\b(ghp|gho|ghu|github_pat)_[A-Za-z0-9]{30,}\b/, label: 'GitHub token' },
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: 'AWS access key id' },
  { re: /\b(sk|sk-x)-[A-Za-z0-9]{20,}\b/, label: 'OpenAI-style secret key' },
];

// Allowlist for files that legitimately hold opaque identifiers (test fixtures
// and seeded demo data that are not runtime secrets).
function isAllowlisted(relPath, line) {
  const p = relPath.split('\\').join('/');
  if (p.includes('scratch') || p.includes('test') || p.includes('spec')) return true;
  // Ignore the scanner's own KNOWN_LEAK definitions
  if (p.endsWith('scripts/scan-secrets.mjs')) return true;
  return false;
}

const findings = [];
const warns = [];

function scanFile(absPath, relPath) {
  if (!/[.](js|mjs|ts|tsx|sql|json|toml|yaml|yml|env|example|md|txt)$/.test(absPath)) return;
  let content;
  try {
    content = readFileSync(absPath, 'utf8');
  } catch {
    return;
  }
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (isAllowlisted(relPath, line)) return;
    for (const { pattern, label, level } of KNOWN_LEAKS) {
      if (pattern.test(line)) {
        (level === 'WARN' ? warns : findings).push(`${relPath}:${idx + 1}  [${level}] ${label}`);
      }
    }
    // Only run entropy rules on lines that look like assignments (reduce noise)
    if (/(KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|API_KEY|PRIVATE|SIG|CREDENTIAL|VAPID)/i.test(line)) {
      for (const { re, label } of ENTROPY_RULES) {
        if (re.test(line)) {
          // Pre-existing committed SQL migrations are treated as WARN (they are
          // append-only and can only be remediated by a git-history rewrite +
          // rotation). New code outside migrations hard-fails.
          const isMigration = relPath.split('\\').join('/').includes('/migrations/') || relPath.toLowerCase().includes('.temp/');
          (isMigration ? warns : findings).push(`${relPath}:${idx + 1}  [${isMigration ? 'WARN' : 'ENTROPY'}] ${label}`);
        }
      }
    }
  });
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const abs = join(dir, name);
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    const rel = relative(ROOT, abs);
    if (st.isDirectory()) {
      if (scanableDir(name)) walk(abs);
    } else {
      scanFile(abs, rel);
    }
  }
}

walk(ROOT);

if (warns.length > 0) {
  console.warn('\nSECRET WARNINGS (pre-existing in committed migrations; block a git-history rewrite until rotated):');
  for (const w of warns) console.warn('  ' + w);
  console.warn('');
}

if (findings.length > 0) {
  console.error('SECRET SCANNER FAILURE — potential secrets found in the working tree:\n');
  for (const f of findings) console.error('  ' + f);
  console.error('\nFix: remove/rotate the leaked values (see audit report), or document why they are benign.');
  process.exit(1);
}

console.log('Secret scan passed: no new known-leaked or high-entropy secrets found.');
