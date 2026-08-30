#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-}"
[[ "$VERSION" =~ ^[0-9]{4}\.([1-9]|1[0-2])\.[0-9]+(-(alpha|beta|rc|nightly)\.[0-9]+)?$ ]] || {
  echo 'usage: tools/release/cut-tag.sh YYYY.M.PATCH[-CHANNEL.N]' >&2
  exit 2
}
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
[[ "$PACKAGE_VERSION" == "$VERSION" ]] || { echo "package.json is $PACKAGE_VERSION, not $VERSION" >&2; exit 1; }
grep -Fq "## [$VERSION]" CHANGELOG.md || { echo "CHANGELOG.md has no $VERSION entry" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo 'worktree must be clean before tagging' >&2; exit 1; }
npm ci
npm run check
git tag -s "v$VERSION" -m "Release v$VERSION"
git verify-tag "v$VERSION"
echo "Created and verified v$VERSION. Review it, then push the same tag to origin and github."
