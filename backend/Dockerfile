# ==========================================
# Backend Production Dockerfile
# ==========================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install OpenSSL (required by Prisma), Python and C++ build tools (required by Mediasoup)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

# Install exact dependencies
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Environment setup
ENV NODE_ENV=production
EXPOSE 5000
EXPOSE 40000-40200/udp

# Run Prisma generate, migrations & start Express server
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node src/server.js"]
