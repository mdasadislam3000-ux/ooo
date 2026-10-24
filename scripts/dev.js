import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['server/index.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of processes) {
    if (child.exitCode === null && !child.killed) child.kill();
  }
  process.exitCode = code;
}

for (const child of processes) {
  child.on('error', (error) => {
    console.error(`Failed to start ${child.spawnargs.at(-1)}:`, error.message);
    stop(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      if (signal) console.log(`Development process stopped (${signal}).`);
      stop(code || 0);
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => stop(0));
}
