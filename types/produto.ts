/**
 * Fluydo.AI - Interface Produto
 * Reflete o retorno da API externa de estoque (vedações).
 * Medidas suportam tolerância de 10% na busca.
 */

export interface MedidaProduto {
  tipo_medida: string;
  valor_mm: number;
  unidade?: string;
}

export interface Produto {
  id: string;
  codigo: string;
  descricao: string;
  estoque: number;
  ativo: boolean;
  medidas: MedidaProduto[];
}

/** Resposta da API externa (lista de produtos) */
export type ProdutosResponse = Produto[];

/** Filtros de busca (tolerância 10% aplicada no serviço para medida) */
export interface ProdutoBuscaFiltros {
  medida?: number;
  codigo?: string;
  descricao?: string;
  tipo_medida?: string;
}
