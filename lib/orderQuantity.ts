/**
 * Regra de inclusão no pedido: apenas itens com Quantidade preenchida e > 0.
 * Usado pela grade de resultados no chat.
 */

export type QtyMap = Record<string, number | ''>;

export interface OrderItemDraft {
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario?: number;
}

/**
 * Retorna itens a incluir no pedido: produtos cujo código está em qtyMap com quantidade > 0.
 * qty vazio ou 0 não inclui.
 */
export function getSelectedItems(
  products: Array<{ codigo: string; descricao: string; precoUnitario?: number | string }>,
  qtyMap: QtyMap
): OrderItemDraft[] {
  const items: OrderItemDraft[] = [];
  for (const p of products) {
    const q = qtyMap[p.codigo];
    const num = typeof q === 'number' ? q : (q === '' ? 0 : parseInt(String(q).replace(/\D/g, ''), 10) || 0);
    if (num > 0) {
      items.push({
        codigo: p.codigo,
        descricao: p.descricao,
        quantidade: num,
        precoUnitario: typeof p.precoUnitario === 'number' ? p.precoUnitario : undefined,
      });
    }
  }
  return items;
}
