# Releasing Hound MCP

Hound MCP follows CalVer (`YYYY.M.PATCH`). Stable versions publish with the
`latest` npm dist-tag; `alpha`, `beta`, and `rc` versions publish with `next`;
nightly versions publish with `nightly`.

## One-time setup

1. Rename both forge repositories to `hound-mcp` and retain redirects from
   `mcp-hound` where the forge supports them.
2. Bootstrap the package name with a distinct prerelease such as
   `2026.8.0-alpha.0`, published under a non-default `bootstrap` dist-tag from a
   disposable clean worktree. Use an operator-authenticated npm session with
   account 2FA (or a short-lived granular token with bypass 2FA), inspect the
   exact tarball first, and use `--access public`. Never use the intended stable
   release version for this step: npm versions are immutable and the subsequent
   trusted-publisher workflow must publish that stable version itself. A trusted
   publisher cannot be configured until the package exists.

   Run the guarded bootstrap from a clean checkout. It defaults to a dry run
   and never changes the source worktree:

   ```bash
   tools/release/bootstrap-npm.sh
   tools/release/bootstrap-npm.sh --publish
   ```

   The publish form requires an authenticated npm owner session, publishes only
   the disposable CalVer alpha version under the `bootstrap` dist-tag, disables
   local provenance, and verifies the resulting registry version.
3. On npmjs.org, configure a GitHub Actions trusted publisher for
   `@jmagly/hound-mcp`, repository `jmagly/hound-mcp`, workflow
   `npm-publish.yml`, environment `npm`. Do not create an `NPM_TOKEN`.
4. Protect the GitHub `npm` environment and `main` branch. Require CI and an
   operator approval for the environment.
5. Keep the Gitea registry credentials behind the scoped `ci-hound-mcp`
   AppRole. Gitea stores only `VAULT_CI_ROLE_ID` and
   `VAULT_CI_SECRET_ID`; publish credentials are fetched at runtime.
   Gitea owns the internal npm/container leg; GitHub OIDC owns npmjs.org.

## Release gates

1. Update `package.json`, `package-lock.json`, and `CHANGELOG.md` to the same
   version. Run `npm ci && npm run check`.
2. Commit and push the release preparation. Wait for Gitea and GitHub CI.
3. Run `tools/release/cut-tag.sh VERSION`. The wrapper refuses a dirty tree,
   mismatched version, missing changelog entry, failed build, or unsigned tag.
   It requires the installed `hound-mcp-release-gpg` OpenBao-backed signer (or
   an explicit `HOUND_MCP_RELEASE_GPG_PROGRAM`) and accepts only fingerprint
   `AA2AEF3332C100FF7DD9AFC7CA0A4B2C2DE0F6BF`.
4. Push the verified tag to both authorities:

   ```bash
   git push origin main refs/tags/vVERSION
   git push github main refs/tags/vVERSION
   ```

5. Verify the Gitea package and immutable container tag. On npmjs.org, verify
   package integrity, the expected dist-tag, and `dist.attestations` provenance.
   A release is incomplete until both registry legs and their CI runs are green.

Never delete or move a published npm version. If a post-tag release fails,
correct it with a new patch version. Never use a prerelease dist-tag for a
stable version or move `latest` from a stable version to a prerelease.
