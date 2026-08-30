import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));
const expectedName = '@jmagly/hound-mcp';
const calver = /^\d{4}\.(?:[1-9]|1[0-2])\.\d+(?:-(?:alpha|beta|rc|nightly)\.\d+)?$/;

if (pkg.name !== expectedName) throw new Error(`package name must be ${expectedName}`);
if (!calver.test(pkg.version)) throw new Error(`version must be CalVer YYYY.M.PATCH: ${pkg.version}`);
if (pkg.private === true) throw new Error('release package cannot be private');
if (pkg.publishConfig?.access !== 'public' || pkg.publishConfig?.provenance !== true) {
  throw new Error('publishConfig must require public access and provenance');
}

const packed = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json'], { encoding: 'utf8' }))[0];
const paths = new Set(packed.files.map((file) => file.path));
for (const required of ['dist/index.js', 'dist/cli.js', 'README.md', 'LICENSE', 'CONTRIBUTING.md']) {
  if (!paths.has(required)) throw new Error(`tarball is missing ${required}`);
}
for (const file of packed.files) {
  if (/^(?:src|test|\.github|\.gitea|\.aiwg)\//.test(file.path) || /(?:^|\/)\.env(?:\.|$)/.test(file.path)) {
    throw new Error(`tarball contains non-release file ${file.path}`);
  }
}
console.log(`verified ${packed.name}@${packed.version}: ${packed.entryCount} files, ${packed.size} bytes`);

