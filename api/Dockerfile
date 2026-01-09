# ─────────────────────────────────────────────────────────────────────────────
# Incident Postmortem Manager API - Docker Image
# Multi-stage build for optimized production image
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Install Azure Functions Core Tools
RUN apk add --no-cache bash && \
    npm install -g azure-functions-core-tools@4 --unsafe-perm

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built code from builder stage
COPY --from=builder /app/dist ./dist

# Copy Azure Functions configuration
COPY host.json ./
COPY local.settings.json ./

# Expose the Azure Functions port
EXPOSE 7071

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:7071/api/incidents || exit 1

# Start Azure Functions runtime
CMD ["func", "start", "--javascript"]

