# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses calendar versioning (`YYYY.M.PATCH`).

## [Unreleased]

## [2026.8.30] - 2026-08-29

### Fixed
- Run signed-tag verification on the Gitea runner host where GnuPG is available, while retaining the digest-pinned Node container for package checks.
- Run release containers as the runner user so generated workspace files retain usable ownership.

## [2026.8.29] - 2026-08-29

### Changed
- Renamed the project and public package to Hound MCP (`@jmagly/hound-mcp`) before its first npmjs.org release.
- Adopted CalVer (`YYYY.M.PATCH`) and a signed-tag, provenance-bearing release process.
- Split continuous integration from tag-triggered Gitea and npmjs.org publishing.

### Security
- Pinned third-party CI actions to immutable commit SHAs.
- Added package-name, version/tag, tarball-content, checksum, and npm provenance gates.

### Added
- GitHub provider support alongside Gitea for file context and deep links
- Docker infrastructure with production and development configurations
- Gitea CI/CD workflow with test, build, and publish pipeline
- Pagination support for `hound_search` with `offset`, `limit`, and `hasMore`

### Changed
- Minimum Node.js version bumped from 18 to 20
- Tool descriptions updated for provider-agnostic language

### Fixed
- HTTP transport sessionId storage timing issue

## [0.1.0] - 2026-01-03

### Added
- Initial release of MCP-Hound
- `hound_search` tool for regex-based code search across repositories
- `hound_repos` tool for listing indexed repositories
- `hound_file_context` tool for getting extended context around code matches
- HoundClient for typed communication with Hound API
- Gitea integration for file context and deep links
- Comprehensive unit tests with 83%+ coverage
- GitHub Actions CI pipeline
- MIT license and contribution guidelines

### Technical Details
- Built with TypeScript and MCP SDK
- Uses Zod for input validation
- Supports Node.js 20+
- Configurable via environment variables

[Unreleased]: https://github.com/jmagly/hound-mcp/compare/v2026.8.30...HEAD
[2026.8.30]: https://github.com/jmagly/hound-mcp/compare/v2026.8.29...v2026.8.30
[2026.8.29]: https://github.com/jmagly/hound-mcp/releases/tag/v2026.8.29
[0.1.0]: https://github.com/jmagly/hound-mcp/releases/tag/v0.1.0
