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
SIGNER="${HOUND_MCP_RELEASE_GPG_PROGRAM:-$(command -v hound-mcp-release-gpg || true)}"
[[ -n "$SIGNER" && -x "$SIGNER" ]] || {
  echo 'Hound MCP release signer is unavailable; set HOUND_MCP_RELEASE_GPG_PROGRAM' >&2
  exit 1
}
git -c gpg.program="$SIGNER" tag -u AA2AEF3332C100FF7DD9AFC7CA0A4B2C2DE0F6BF -s "v$VERSION" -m "Release v$VERSION"
tools/ci/verify-signed-tag.sh "v$VERSION"
echo "Created and verified v$VERSION. Review it, then push the same tag to origin and github."
