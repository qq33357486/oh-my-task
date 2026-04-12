# Stage 1: Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web ./
RUN npm run build

# Stage 3: Production
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy backend production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend build output
COPY --from=backend-builder /app/dist ./dist
COPY src/db/schema.sql ./dist/db/

# Copy frontend build output
COPY --from=frontend-builder /app/web/dist ./web/dist

# Create data directory for SQLite
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV API_PORT=3000
ENV DB_PATH=/app/data/data.db
ENV WEB_DIST_PATH=/app/web/dist

EXPOSE 3000

# Use dumb-init to properly forward signals
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
