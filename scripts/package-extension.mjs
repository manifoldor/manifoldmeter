import { cp, mkdir, mkdtemp, readFile, rm, utimes } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

if (manifest.version !== packageJson.version) {
  throw new Error(
    `Version mismatch: manifest=${manifest.version}, package=${packageJson.version}`
  );
}

const files = [
  'manifest.json',
  'background.js',
  'content.js',
  'usage.js',
  'format-utils.js',
  'typography.css',
  'popup.html',
  'popup.js',
  'popup.css',
  'dashboard.html',
  'dashboard.js',
  'dashboard.css',
  'onboarding.html',
  'onboarding.js',
  'onboarding.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'icons/logo.svg',
  'icons/refresh.svg'
];

const stage = await mkdtemp(join(tmpdir(), 'manifold-meter-package-'));
const outputDir = join(root, 'dist');
const output = join(outputDir, `manifold-meter-v${manifest.version}.zip`);
const stableTime = new Date('2000-01-01T00:00:00.000Z');

try {
  for (const file of files) {
    const source = join(root, file);
    const target = join(stage, file);
    await mkdir(dirname(target), { recursive: true });
    await cp(source, target);
    await utimes(target, stableTime, stableTime);
  }

  await mkdir(outputDir, { recursive: true });
  await rm(output, { force: true });

  await new Promise((resolvePromise, reject) => {
    const child = spawn('zip', ['-X', '-q', output, ...files], {
      cwd: stage,
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`zip terminated by ${signal}`));
      else if (code !== 0) reject(new Error(`zip exited with code ${code}`));
      else resolvePromise();
    });
  });

  console.log(`Created dist/${basename(output)} with ${files.length} files.`);
} finally {
  await rm(stage, { recursive: true, force: true });
}
