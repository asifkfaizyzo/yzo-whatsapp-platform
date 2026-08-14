# ==========================================
# Backend Production Dockerfile
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies and OpenSSL (required by Prisma)
RUN apk add --no-cache openssl

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

# Run Prisma generate, migrations & start Express server
CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && node src/server.js"]
