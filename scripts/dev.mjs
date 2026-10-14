// Local dev with the mock provider (no Cloudflare login): builds a throwaway project dir whose wrangler.toml has
// no [ai] binding (that binding always connects to Cloudflare), copies the real code in (restart to pick up edits), and starts `wrangler pages dev`.
import { mkdirSync, writeFileSync, cpSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// Outside the repo on purpose: wrangler searches parent directories for a config and would find the real one.
const dev = join(tmpdir(), 'ask-anuj-dev');
const port = process.env.PORT || '8788';
rmSync(join(dev, 'functions'), { recursive: true, force: true }); rmSync(join(dev, 'public'), { recursive: true, force: true });
mkdirSync(dev, { recursive: true });
writeFileSync(join(dev, 'wrangler.toml'), `name = "ask-anuj"
pages_build_output_dir = "public"
compatibility_date = "2025-09-01"
[[d1_databases]]
binding = "DB"
database_name = "ask-anuj"
database_id = "local"
`);
cpSync(join(root, 'functions'), join(dev, 'functions'), { recursive: true });
cpSync(join(root, 'public'), join(dev, 'public'), { recursive: true });
if (existsSync(join(root, '.dev.vars'))) copyFileSync(join(root, '.dev.vars'), join(dev, '.dev.vars'));
const bin = join(root, 'node_modules/.bin/wrangler');
spawnSync(bin, ['d1', 'execute', 'ask-anuj', '--local', '--file', join(root, 'schema.sql')], { cwd: dev, stdio: 'inherit' });
const child = spawn(bin, ['pages', 'dev', 'public', '--port', port], { cwd: dev, stdio: 'inherit' });
child.on('exit', (c) => process.exit(c ?? 0));
