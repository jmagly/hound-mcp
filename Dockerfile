# CodeHound MCP Docker Image
# Multi-stage build for minimal production image

#==============================================================================
# Stage 1: Build
#==============================================================================
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

#==============================================================================
# Stage 2: Test (optional - used for CI)
#==============================================================================
FROM node:24-alpine AS test

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies
RUN npm ci

# Copy source and config
COPY tsconfig.json ./
COPY eslint.config.js ./
COPY src/ ./src/

# Run tests, lint, and typecheck
RUN npm run typecheck && npm run lint && npm run test:run

#==============================================================================
# Stage 3: Production
#==============================================================================
FROM node:24-alpine AS production

# Add labels for container metadata
LABEL org.opencontainers.image.title="CodeHound MCP"
LABEL org.opencontainers.image.description="Multi-modal code search MCP server"
LABEL org.opencontainers.image.source="https://github.com/jmagly/mcp-hound"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.vendor="Integro Labs"

# Create non-root user for security
RUN addgroup -g 1001 -S mcp && \
    adduser -u 1001 -S mcp -G mcp

WORKDIR /app

# Copy built application and production dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Set ownership
RUN chown -R mcp:mcp /app

# Switch to non-root user
USER mcp

# Environment defaults
ENV NODE_ENV=production
ENV HOUND_URL=http://localhost:6080
ENV HOUND_TIMEOUT=30000
ENV MCP_PORT=3000

# Expose HTTP port (for remote mode)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:${MCP_PORT}/health || exit 1

# Default: run in HTTP mode
# Override with --stdio for local mode
ENTRYPOINT ["node", "dist/index.js"]
CMD ["--http", "--port", "3000"]
