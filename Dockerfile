# Build stage for client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Copy server code
COPY server/ ./server/

# Copy built client
COPY --from=client-build /app/client/dist ./client/dist

# Expose port
EXPOSE 3001

# Start server
WORKDIR /app/server
CMD ["node", "index.js"]
