FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma compatibility on Alpine Linux
RUN apk add --no-cache openssl

# Copy package lock and dependencies definition
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build/prisma)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application code
COPY . .

EXPOSE 5000

# Run migrations and start server automatically
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
