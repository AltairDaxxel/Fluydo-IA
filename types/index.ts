/**
 * Fluydo.IA - Barrel de tipos (pedido, produto, cliente, etc.)
 */

export * from './pedido';
export * from './produto';

/** Cliente (CPF/CNPJ) para entrega e condições de pagamento */
export interface Cliente {
  id: string;
  nome: string;
  cpfCnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep?: string;
  email?: string;
  telefone?: string;
}

/** Condição de pagamento (listagem para o cliente) */
export interface CondicaoPagamento {
  id: string;
  descricao: string;
  parcelas?: number;
  diasPrazo?: number;
}

/** Loja/parceiro (usado em scripts e validação) */
export interface Loja {
  id: string;
  nome: string;
  mensalidade: number;
  ativo: boolean;
  createdAt: Date;
  updatedAt: Date;
}
