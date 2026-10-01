import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.m?js$/.test(entry.name) ? [path] : [];
  });
}

const sourceFiles = [...files('src'), ...files('scripts')];
for (const file of sourceFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
process.stdout.write(`Checked ${sourceFiles.length} Worker source/script files.\n`);
