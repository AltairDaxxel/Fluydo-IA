/**
 * Fluydo.IA - Cliente Prisma singleton (evita múltiplas instâncias em dev).
 * Se aparecer "Can't resolve '@prisma/client'": rode no terminal
 *   npm install @prisma/client
 *   npx prisma generate
 * ou execute o script: scripts/setup-prisma.bat
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
