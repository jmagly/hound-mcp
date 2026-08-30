#!/usr/bin/env bash
set -euo pipefail
set +x

SPEC=""
DRY_RUN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --spec) SPEC="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -r "$SPEC" ]] || { echo 'a readable --spec is required' >&2; exit 2; }
if [[ "$DRY_RUN" == 1 ]]; then
  awk 'NF && $1 != "env" {exit 2} NF && NF != 4 {exit 2}' "$SPEC"
  echo "vault-fetch: dry-run OK for $SPEC"
  exit 0
fi
for name in VAULT_ADDR VAULT_CI_ROLE_ID VAULT_CI_SECRET_ID GITHUB_ENV; do
  [[ -n "${!name:-}" ]] || { echo "$name is required" >&2; exit 1; }
done
resolve() {
  local value="$1" name
  if [[ "$value" =~ ^\$\{([A-Z_][A-Z0-9_]*)\}$ ]]; then
    name="${BASH_REMATCH[1]}"
    [[ -n "${!name:-}" ]] || { echo "$name is required" >&2; return 1; }
    printf '%s\n' "${!name}"
  else
    printf '%s\n' "$value"
  fi
}
token="$(printf '%s\n%s\n' "$VAULT_CI_ROLE_ID" "$VAULT_CI_SECRET_ID" |
  jq -Rn '{role_id:input,secret_id:input}' |
  curl -fsS --max-time 20 -X POST --data @- "$VAULT_ADDR/v1/auth/approle/login" |
  jq -er '.auth.client_token')"
trap 'curl -fsS --max-time 10 --config /dev/fd/3 -X POST "$VAULT_ADDR/v1/auth/token/revoke-self" 3<<<"header = \"X-Vault-Token: $token\"" >/dev/null 2>&1 || true' EXIT
echo "::add-mask::$token"
while read -r kind name path field extra; do
  [[ -z "${kind:-}" || "$kind" == \#* ]] && continue
  [[ "$kind" == env && -z "${extra:-}" && "$name" =~ ^[A-Z_][A-Z0-9_]*$ ]] || { echo 'invalid spec' >&2; exit 2; }
  path="$(resolve "$path")"
  field="$(resolve "$field")"
  [[ "$path" == */data/* ]] || path="${path%%/*}/data/${path#*/}"
  value="$(curl -fsS --max-time 20 --config /dev/fd/3 "$VAULT_ADDR/v1/$path" 3<<<"header = \"X-Vault-Token: $token\"" | jq -er --arg field "$field" '.data.data[$field]')"
  echo "::add-mask::$value"
  {
    echo "$name<<__VAULT__"
    printf '%s\n' "$value"
    echo '__VAULT__'
  } >> "$GITHUB_ENV"
  unset value
done < "$SPEC"

