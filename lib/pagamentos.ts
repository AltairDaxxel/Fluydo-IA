/**
 * Fluydo.IA - Opções de pagamento (tabela Pagamentos: Codigo | Descricao).
 */

import { hasDatabase, prisma } from './prisma';

export interface ItemPagamento {
  codigo: string;
  descricao: string;
}

export async function listarPagamentos(idEmitente: string): Promise<ItemPagamento[]> {
  const idEmit = (idEmitente || '').trim();
  if (!idEmit || !hasDatabase()) return [];
  try {
    const rows = await prisma.pagamento.findMany({
      where: { idEmitente: idEmit },
      select: { codigo: true, descricao: true },
      orderBy: { codigo: 'asc' },
    });
    return rows.map((r) => ({ codigo: r.codigo, descricao: r.descricao }));
  } catch {
    return [];
  }
}

/** Formata opções de pagamento para exibição no chat (Codigo | Descricao). */
export function formatarOpcoesPagamentos(itens: ItemPagamento[]): string {
  if (itens.length === 0) return 'Nenhuma opção de pagamento cadastrada.';
  const linhas = itens.map((i) => `${i.codigo} | ${i.descricao}`);
  return 'Opções de pagamento:\n' + linhas.join('\n');
}
