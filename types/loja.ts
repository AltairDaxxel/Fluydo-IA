/**
 * Fluydo.AI - Interface Loja
 * Conta do cliente (loja) com mensalidade fixa.
 */

export interface Loja {
  id: string;
  nome: string;
  /** Mensalidade fixa em reais (ex.: 350) */
  mensalidade: number;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type LojaCreateInput = Omit<Loja, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export type LojaUpdateInput = Partial<Omit<Loja, 'id' | 'createdAt'>>;
