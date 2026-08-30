#!/usr/bin/env bash
set -euo pipefail

EXPECTED=AA2AEF3332C100FF7DD9AFC7CA0A4B2C2DE0F6BF
TAG="${1:-${GITHUB_REF#refs/tags/}}"
[[ "$TAG" == v* ]] || { echo 'release tag must start with v' >&2; exit 2; }
work="$(mktemp -d)"
cleanup() { rm -rf "$work"; }
trap cleanup EXIT INT TERM HUP
export GNUPGHOME="$work/gnupg"
install -d -m 700 "$GNUPGHOME"
gpg --batch --import .gitea/keys/maintainers.asc >/dev/null 2>&1
actual="$(gpg --batch --with-colons --list-keys | awk -F: '$1=="fpr"{print $10;exit}')"
[[ "$actual" == "$EXPECTED" ]] || { echo 'release verifier key fingerprint mismatch' >&2; exit 1; }
git verify-tag --raw "$TAG" 2>"$work/status"
grep -Fq "[GNUPG:] VALIDSIG $EXPECTED " "$work/status" || { echo 'tag was not signed by the Hound MCP release key' >&2; exit 1; }
echo "verified signed release tag: $TAG ($EXPECTED)"

