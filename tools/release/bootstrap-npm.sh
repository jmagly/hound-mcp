#!/usr/bin/env bash
set -euo pipefail

VERSION="2026.8.0-alpha.0"
PUBLISH=0
REGISTRY="https://registry.npmjs.org/"
PACKAGE="hound-search-mcp"

usage() {
  printf 'usage: %s [--publish] [--version YYYY.M.PATCH-alpha.N]\n' "$0" >&2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish) PUBLISH=1; shift ;;
    --version) VERSION="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 2 ;;
  esac
done

[[ "$VERSION" =~ ^[0-9]{4}\.([1-9]|1[0-2])\.[0-9]+-alpha\.[0-9]+$ ]] || {
  echo 'bootstrap version must be a CalVer alpha prerelease' >&2
  exit 2
}
[[ -z "$(git status --porcelain)" ]] || {
  echo 'source worktree must be clean' >&2
  exit 1
}
if npm view "$PACKAGE@$VERSION" version --registry "$REGISTRY" >/dev/null 2>&1; then
  echo "$PACKAGE@$VERSION already exists; npm versions are immutable" >&2
  exit 1
fi

work="$(mktemp -d /tmp/hound-mcp-npm-bootstrap.XXXXXX)"
cleanup() {
  [[ "$work" == /tmp/hound-mcp-npm-bootstrap.* ]] && find "$work" -depth -delete
}
trap cleanup EXIT INT TERM HUP
git archive HEAD | tar -x -C "$work"
(
  cd "$work"
  npm version "$VERSION" --no-git-tag-version
  npm ci
  npm run check
  npm pack --dry-run
  if [[ "$PUBLISH" == 1 ]]; then
    npm whoami --registry "$REGISTRY" >/dev/null
    npm publish --access public --provenance=false --tag bootstrap --registry "$REGISTRY"
  fi
)

if [[ "$PUBLISH" == 1 ]]; then
  published=""
  for attempt in {1..12}; do
    published="$(npm view "$PACKAGE@$VERSION" version --registry "$REGISTRY" 2>/dev/null || true)"
    [[ "$published" == "$VERSION" ]] && break
    sleep 5
  done
  [[ "$published" == "$VERSION" ]] || { echo 'bootstrap publication did not propagate within 60 seconds' >&2; exit 1; }
  bootstrap_tag="$(npm view "$PACKAGE" dist-tags.bootstrap --registry "$REGISTRY")"
  [[ "$bootstrap_tag" == "$VERSION" ]] || { echo 'bootstrap dist-tag did not verify' >&2; exit 1; }
  latest_tag="$(npm view "$PACKAGE" dist-tags.latest --registry "$REGISTRY" 2>/dev/null || true)"
  if [[ "$latest_tag" == "$VERSION" ]]; then
    npm dist-tag rm "$PACKAGE" latest --registry "$REGISTRY"
  fi
  echo "verified bootstrap publication: $PACKAGE@$VERSION (dist-tag: bootstrap)"
else
  echo "bootstrap dry run passed for $PACKAGE@$VERSION; rerun with --publish from an authenticated npm owner session"
fi
