import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';

const entries = await readdir(new URL('../tests/', import.meta.url), {
  withFileTypes: true
}).catch(() => []);
const tests = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.test.js'))
  .map((entry) => `tests/${entry.name}`)
  .sort();

if (tests.length === 0) {
  console.error('No test files found. Refusing to report a false-positive test pass.');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...tests], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit'
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Test runner terminated by ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
