# Contributing to Hound MCP

Thank you for your interest in contributing to Hound MCP! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 20+ (LTS recommended)
- npm 9+
- Access to a Hound code search instance
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jmagly/hound-mcp.git
   cd mcp-hound
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Hound server URL
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run tests**
   ```bash
   npm test
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

- `feat/` - New features (e.g., `feat/add-file-filter`)
- `fix/` - Bug fixes (e.g., `fix/search-timeout`)
- `docs/` - Documentation updates (e.g., `docs/update-readme`)
- `refactor/` - Code refactoring (e.g., `refactor/hound-client`)
- `test/` - Test additions/updates (e.g., `test/search-tool`)

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `ci`, `build`

**Scopes**: `tools`, `client`, `server`, `config`, `tests`, `docs`

**Examples**:
```
feat(tools): add file pattern filtering to hound_search
fix(client): handle Hound API timeout gracefully
docs: update installation instructions
test(tools): add unit tests for hound_repos
```

### Pull Requests

1. **Create a feature branch** from `main`
2. **Make your changes** with clear, focused commits
3. **Write/update tests** for your changes
4. **Update documentation** if needed
5. **Run the full test suite** before submitting
6. **Open a pull request** with a clear description

#### PR Description Template

```markdown
## Summary
Brief description of changes

## Changes
- Change 1
- Change 2

## Testing
How were these changes tested?

## Related Issues
Closes #123
```

## Code Style

### TypeScript Guidelines

- Use TypeScript strict mode
- Prefer `interface` over `type` for object shapes
- Use explicit return types for public functions
- Avoid `any` - use `unknown` if type is truly unknown

### Formatting

- Use Prettier for formatting (run `npm run format`)
- Use ESLint for linting (run `npm run lint`)
- 2-space indentation
- Single quotes for strings
- Semicolons required

### File Organization

```
src/
├── index.ts           # MCP server entry point
├── tools/             # MCP tool implementations
│   ├── search.ts      # hound_search tool
│   ├── repos.ts       # hound_repos tool
│   └── context.ts     # hound_file_context tool
├── clients/           # API clients
│   ├── hound.ts       # Hound API client
│   └── gitea.ts       # Gitea API client (for file context)
└── types.ts           # Shared TypeScript interfaces
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Place tests in `__tests__/` directories or use `.test.ts` suffix
- Use descriptive test names: `it('should return empty array when no results')`
- Mock external APIs (Hound, Gitea) for unit tests
- Aim for 60%+ coverage (85%+ for critical paths)

### Test Structure

```typescript
describe('hound_search', () => {
  describe('when query matches files', () => {
    it('should return formatted results with Gitea URLs', async () => {
      // Arrange
      const mockResponse = { /* ... */ };

      // Act
      const result = await houndSearch({ query: 'test' });

      // Assert
      expect(result.total_matches).toBe(5);
    });
  });
});
```

## Issue Tracking

### Reporting Bugs

Include:
- Hound MCP version
- Node.js version
- Hound server version
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternative approaches considered

## Architecture Overview

Hound MCP is a stateless MCP server that wraps the Hound code search API:

```
Claude Code ──stdio──> MCP Server ──HTTP──> Hound API
                           │
                           └──HTTP──> Gitea API (file context)
```

**Key Components**:
- **MCP Server** (`index.ts`): Protocol handling, tool registration
- **Tools** (`tools/`): MCP tool implementations with Zod schemas
- **Clients** (`clients/`): Typed HTTP clients for external APIs

## Getting Help

- **Documentation**: See the [README](https://github.com/jmagly/hound-mcp#readme)
- **Issues**: Open an [issue](https://github.com/jmagly/hound-mcp/issues) for bugs or questions
- **Discussions**: Use GitHub Discussions for feature ideas

## License

By contributing to Hound MCP, you agree that your contributions will be licensed under the MIT License.
