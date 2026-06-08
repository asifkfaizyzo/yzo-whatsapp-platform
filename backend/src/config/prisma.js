import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// Use a global variable to persist the client instance across hot reloads in development
const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

export default prisma;
