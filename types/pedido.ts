/**
 * Fluydo.AI - Interface Pedido
 * Pedido vinculado à loja, com valorTotal e comissão de 5%.
 */

export interface ItemPedido {
  produtoId: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  precoUnitario: number;
  /** quantidade * precoUnitario */
  subtotal: number;
}

export interface Pedido {
  id: string;
  lojaId: string;
  /** Soma dos subtotais dos itens */
  valorTotal: number;
  /** 5% sobre valorTotal */
  valorComissao: number;
  itens: ItemPedido[];
  createdAt: Date;
  updatedAt: Date;
}

export type PedidoCreateInput = Omit<Pedido, 'id' | 'createdAt' | 'updatedAt' | 'valorComissao'> & {
  id?: string;
  /** Se não informado, calculado como valorTotal * 0.05 */
  valorComissao?: number;
};

export type PedidoUpdateInput = Partial<Omit<Pedido, 'id' | 'lojaId' | 'createdAt'>>;

/** Percentual de comissão por venda (0.05 = 5%) */
export const COMISSAO_PERCENTUAL = 0.05;

export function calcularComissao(valorTotal: number): number {
  return Math.round(valorTotal * COMISSAO_PERCENTUAL * 100) / 100;
}
