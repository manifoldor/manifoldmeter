import { access, copyFile, mkdir, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const assets = resolve(root, 'store/assets');

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
].filter(Boolean);

let chromePath = null;
for (const candidate of chromeCandidates) {
  try {
    await access(candidate);
    chromePath = candidate;
    break;
  } catch {
    // Try the next known Chrome/Chromium location.
  }
}

if (!chromePath) {
  throw new Error('Chrome/Chromium not found. Set CHROME_PATH to its executable.');
}

await mkdir(assets, { recursive: true });

async function screenshot(source, output, width, height) {
  const url = pathToFileURL(resolve(root, source));
  if (source === 'dashboard.html') url.searchParams.set('demo', '1');

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--force-device-scale-factor=1',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=2500',
    `--window-size=${width},${height}`,
    `--screenshot=${resolve(assets, output)}`,
    url.href
  ];

  await new Promise((resolvePromise, reject) => {
    const child = spawn(chromePath, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) reject(new Error(`Chrome terminated by ${signal}`));
      else if (code !== 0) reject(new Error(`Chrome exited with code ${code}`));
      else resolvePromise();
    });
  });
}

async function assertPngSize(file, expectedWidth, expectedHeight) {
  const bytes = await readFile(resolve(assets, file));
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(
      `${file} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}`
    );
  }
}

await screenshot('dashboard.html', 'screenshot-dashboard-1280x800.png', 1280, 800);
await screenshot(
  'store/assets-source/popup-showcase.html',
  'screenshot-popup-1280x800.png',
  1280,
  800
);
await screenshot('onboarding.html', 'screenshot-onboarding-1280x800.png', 1280, 800);
await screenshot(
  'store/assets-source/small-promo.html',
  'promo-small-440x280.png',
  440,
  280
);
await screenshot(
  'store/assets-source/marquee.html',
  'promo-marquee-1400x560.png',
  1400,
  560
);
await copyFile(resolve(root, 'icons/icon128.png'), resolve(assets, 'icon-128.png'));

for (const [file, width, height] of [
  ['icon-128.png', 128, 128],
  ['screenshot-dashboard-1280x800.png', 1280, 800],
  ['screenshot-popup-1280x800.png', 1280, 800],
  ['screenshot-onboarding-1280x800.png', 1280, 800],
  ['promo-small-440x280.png', 440, 280],
  ['promo-marquee-1400x560.png', 1400, 560]
]) {
  await assertPngSize(file, width, height);
}

console.log('Chrome Web Store assets regenerated and dimension-checked.');
