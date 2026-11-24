FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript to dist
RUN npm run build

# Production runtime stage
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled files
COPY --from=builder /app/dist ./dist

# Create directory for persistent JSON data
RUN mkdir -p /app/data

CMD ["node", "dist/index.js"]
