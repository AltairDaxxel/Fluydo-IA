/**
 * Fluydo.IA - Identificação do parceiro (emitente) por telefone
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { hasDatabase } from './prisma';

/** Normaliza telefone para comparação (apenas dígitos) */
export function normalizarTelefone(telefone: string): string {
  return (telefone || '').replace(/\D/g, '');
}

function matchTelefone(tel: string, telDb: string | null): boolean {
  if (telDb == null) return false;
  const db = normalizarTelefone(String(telDb).trim());
  return db === tel || db === tel.replace(/^55/, '') || tel === db.replace(/^55/, '');
}

/**
 * Busca ID do emitente pelo telefone (campo Telefone na tabela Emitentes).
 * Retorna null se não encontrar ou se o banco não estiver configurado.
 * Comparação apenas por dígitos (ignora formatação).
 */
export async function getEmitenteByTelefone(telefone: string): Promise<{ id: string; nome: string | null } | null> {
  if (!hasDatabase()) {
    console.warn('[emitente] DATABASE_URL não configurada.');
    return null;
  }
  const tel = normalizarTelefone(telefone);
  if (!tel) return null;

  try {
    const todos = await prisma.emitente.findMany({
      select: { id: true, telefone: true, nome: true },
    });
    const match = todos.find((e) => matchTelefone(tel, e.telefone));
    if (match) return { id: match.id, nome: match.nome ?? null };

    const raw = await prisma.$queryRaw<{ id: string; telefone: string | null; nome: string | null }[]>(
      Prisma.sql`SELECT id, Telefone AS telefone, Nome AS nome FROM Emitentes`
    );
    const matchRaw = raw.find((e) => matchTelefone(tel, e.telefone));
    return matchRaw ? { id: matchRaw.id, nome: matchRaw.nome ?? null } : null;
  } catch (err) {
    console.error('[emitente] Erro ao buscar emitente por telefone:', err);
    try {
      const raw = await prisma.$queryRaw<{ id: string; telefone: string | null; nome: string | null }[]>(
        Prisma.sql`SELECT id, Telefone AS telefone, Nome AS nome FROM Emitentes`
      );
      const matchRaw = raw.find((e) => matchTelefone(tel, e.telefone));
      return matchRaw ? { id: matchRaw.id, nome: matchRaw.nome ?? null } : null;
    } catch (rawErr) {
      console.error('[emitente] Fallback raw também falhou:', rawErr);
      return null;
    }
  }
}
