# Releasing Hound MCP

Hound MCP follows CalVer (`YYYY.M.PATCH`). Stable versions publish with the
`latest` npm dist-tag; `alpha`, `beta`, and `rc` versions publish with `next`;
nightly versions publish with `nightly`.

## One-time setup

1. Rename both forge repositories to `hound-mcp` and retain redirects from
   `mcp-hound` where the forge supports them.
2. On npmjs.org, configure a GitHub Actions trusted publisher for
   `@jmagly/hound-mcp`, repository `jmagly/hound-mcp`, workflow
   `npm-publish.yml`, environment `npm`. Do not create an `NPM_TOKEN`.
3. Protect the GitHub `npm` environment and `main` branch. Require CI and an
   operator approval for the environment.
4. Keep the Gitea registry credentials in OpenBao-backed repository secrets.
   Gitea owns the internal npm/container leg; GitHub OIDC owns npmjs.org.

## Release gates

1. Update `package.json`, `package-lock.json`, and `CHANGELOG.md` to the same
   version. Run `npm ci && npm run check`.
2. Commit and push the release preparation. Wait for Gitea and GitHub CI.
3. Run `tools/release/cut-tag.sh VERSION`. The wrapper refuses a dirty tree,
   mismatched version, missing changelog entry, failed build, or unsigned tag.
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

