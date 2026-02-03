# Build stage for client
FROM node:20-alpine AS client-build
WORKDIR /app

# Copy all package files for workspace
COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install all dependencies (workspace mode)
RUN npm ci

# Copy source code
COPY client/ ./client/
COPY server/ ./server/

# Build client
RUN npm run build --workspace=client

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# System deps for movie clip cache
RUN apk add --no-cache ffmpeg python3 py3-pip && \
    pip install --break-system-packages yt-dlp

# Copy package files
COPY package*.json ./
COPY server/package.json ./server/

# Install production dependencies only
RUN npm ci --omit=dev --workspace=server

# Copy server code
COPY server/ ./server/

# Copy built client from build stage
COPY --from=client-build /app/client/dist ./client/dist

# Expose port
EXPOSE 7111

ENV NODE_ENV=production
ENV PORT=7111

# Start server
WORKDIR /app/server
CMD ["node", "index.js"]
