/**
 * Fluydo.IA - Enriquecimento do carrinho com dados do cadastro do produto.
 * Busca unidade, dimensões (dim1-dim4) e aplicação no banco por código + idEmitente.
 */

import { prisma } from './prisma';
import type { ItemCarrinho } from '@/types';

function toNum(x: unknown): number | null {
  if (x == null) return null;
  if (typeof x === 'number') return x;
  const d = x as { toNumber?: () => number };
  if (typeof d.toNumber === 'function') return d.toNumber();
  const n = Number(x);
  return Number.isNaN(n) ? null : n;
}

/**
 * Enriquece cada item do carrinho com unidade, dim1-dim4 e aplicação
 * buscados no cadastro do produto (por codigo + idEmitente).
 * Se idEmitente estiver vazio ou o produto não for encontrado, os campos opcionais ficam indefinidos.
 */
export async function enrichCartWithProducts(
  cart: ItemCarrinho[],
  idEmitente: string
): Promise<ItemCarrinho[]> {
  const idEmit = (idEmitente || '').trim();
  if (!idEmit || cart.length === 0) return cart;

  const codigos = [...new Set(cart.map((i) => i.codigo))];
  let produtos: Array<{
    codigo: string;
    unidade: string | null;
    ipi: unknown;
    dim1: unknown;
    dim2: unknown;
    dim3: unknown;
    dim4: unknown;
    aplicacao: string | null;
  }>;

  try {
    const rows = await prisma.produto.findMany({
      where: { idEmitente: idEmit, codigo: { in: codigos } },
      select: { codigo: true, unidade: true, ipi: true, dim1: true, dim2: true, dim3: true, dim4: true, aplicacao: true },
    });
    produtos = rows;
  } catch (err) {
    console.error('[enrich-cart] Erro ao buscar produtos:', err);
    return cart;
  }

  const byCodigo = new Map(produtos.map((p) => [p.codigo, p]));

  return cart.map((item) => {
    const p = byCodigo.get(item.codigo);
    if (!p) return item;
    return {
      ...item,
      unidade: p.unidade ?? undefined,
      ipi: toNum(p.ipi) ?? undefined,
      dim1: toNum(p.dim1) ?? undefined,
      dim2: toNum(p.dim2) ?? undefined,
      dim3: toNum(p.dim3) ?? undefined,
      dim4: toNum(p.dim4) ?? undefined,
      aplicacao: p.aplicacao ?? undefined,
    };
  });
}
