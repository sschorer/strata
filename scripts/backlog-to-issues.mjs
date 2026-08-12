#!/usr/bin/env node
// Turn BACKLOG.md into GitHub issues — idempotently.
//
//   node scripts/backlog-to-issues.mjs [--dry-run]
//
// For every open item (`[ ]` todo or `[~]` in-progress) it creates an issue
// labelled with its section (area:*) and priority (priority:P0|P1|P2). Done
// items (`[x]`) are skipped, and items whose title already exists as an issue
// (open or closed) are skipped too — so it's safe to re-run after editing the
// backlog.
//
// Auth:  GITHUB_TOKEN (or GH_TOKEN) with `issues: write`.
// Repo:  from `git remote get-url origin`, or $GITHUB_REPOSITORY ("owner/repo").
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DRY = process.argv.includes('--dry-run');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.github.com';

const PRIORITY_COLORS = { P0: 'b60205', P1: 'd93f0b', P2: 'fbca04' };
const STATUS_LABEL = 'status:in-progress';

function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
    cwd: root,
  })
    .toString()
    .trim();
  const m = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!m) throw new Error(`can't parse owner/repo from remote: ${url}`);
  return m[1];
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/`[^`]*`/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Parse BACKLOG.md into a flat list of open items. */
async function parseBacklog() {
  const text = await readFile(resolve(root, 'BACKLOG.md'), 'utf8');
  const items = [];
  let area = 'general';
  for (const raw of text.split('\n')) {
    const section = raw.match(/^##\s+(.+)$/);
    if (section) {
      area = slugify(section[1]);
      continue;
    }
    const item = raw.match(/^-\s+\[( |x|~)\]\s+(.*)$/);
    if (!item) continue;
    const [, state, rest] = item;
    if (state === 'x') continue; // done

    const prio = rest.match(/\*\*(P[012])\*\*/)?.[1] ?? null;
    const title = rest
      .replace(/\*\*(P[012])\*\*/, '')
      .replace(/\*\*/g, '')
      .trim();

    const labels = [`area:${area}`];
    if (prio) labels.push(`priority:${prio}`);
    if (state === '~') labels.push(STATUS_LABEL);

    items.push({ title, area, prio, labels, inProgress: state === '~' });
  }
  return items;
}

async function gh(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && res.status !== 422) {
    throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
  }
  return { status: res.status, json: res.status === 204 ? null : await res.json() };
}

/** Titles of every existing issue (open + closed), lowercased. */
async function existingTitles(token, slug) {
  const seen = new Set();
  for (let page = 1; ; page++) {
    const { json } = await gh(
      token,
      'GET',
      `/repos/${slug}/issues?state=all&per_page=100&page=${page}`,
    );
    if (!json.length) break;
    for (const issue of json) {
      if (!issue.pull_request) seen.add(issue.title.trim().toLowerCase());
    }
    if (json.length < 100) break;
  }
  return seen;
}

async function ensureLabels(token, slug, items) {
  const wanted = new Map();
  for (const it of items) {
    for (const l of it.labels) {
      const color = l.startsWith('priority:')
        ? PRIORITY_COLORS[l.split(':')[1]]
        : l === STATUS_LABEL
          ? '0e8a16'
          : '5319e7'; // area:*
      wanted.set(l, color);
    }
  }
  for (const [name, color] of wanted) {
    await gh(token, 'POST', `/repos/${slug}/labels`, { name, color }); // 422 = exists, ignored
  }
}

async function main() {
  const slug = repoSlug();
  const items = await parseBacklog();
  console.log(`Backlog → issues for ${slug}: ${items.length} open items\n`);

  if (DRY) {
    for (const it of items) {
      console.log(`  + ${it.title}\n      labels: ${it.labels.join(', ')}`);
    }
    console.log('\n(dry run — nothing created; set a token and drop --dry-run)');
    return;
  }

  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (!token) {
    console.error('GITHUB_TOKEN (or GH_TOKEN) with issues:write is required.');
    process.exit(1);
  }

  const existing = await existingTitles(token, slug);
  await ensureLabels(token, slug, items);

  let created = 0;
  let skipped = 0;
  for (const it of items) {
    if (existing.has(it.title.toLowerCase())) {
      skipped++;
      continue;
    }
    const body =
      `Tracked from \`BACKLOG.md\`.\n\n` +
      `- **Area:** ${it.area}\n` +
      `- **Priority:** ${it.prio ?? '—'}\n` +
      (it.inProgress ? `- **Status:** in progress\n` : '');
    const { json } = await gh(token, 'POST', `/repos/${slug}/issues`, {
      title: it.title,
      body,
      labels: it.labels,
    });
    console.log(`  #${json.number} ${it.title}`);
    created++;
  }
  console.log(`\nDone: ${created} created, ${skipped} already existed.`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
