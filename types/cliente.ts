/**
 * Fluydo.AI - Cliente e condições de pagamento
 */

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

export interface CondicaoPagamento {
  id: string;
  descricao: string;
  parcelas?: number;
  diasPrazo?: number;
}
