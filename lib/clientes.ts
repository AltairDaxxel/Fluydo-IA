/**
 * Fluydo.AI - Busca de cliente (CPF/CNPJ) e condições de pagamento.
 * Pode ser conectado a API/banco real via env.
 */

import type { Cliente, CondicaoPagamento } from '@/types';

function normalizarCpfCnpj(v: string): string {
  return v.replace(/\D/g, '');
}

/** Mock: clientes e condições. Substituir por chamada à API quando houver. */
const MOCK_CLIENTES: Cliente[] = [
  {
    id: '1',
    nome: 'Empresa Exemplo Ltda',
    cpfCnpj: '12345678000199',
    endereco: 'Rua das Flores, 100',
    cidade: 'São Paulo',
    uf: 'SP',
    cep: '01234-567',
    email: 'contato@exemplo.com',
    telefone: '(11) 99999-9999',
  },
  {
    id: '2',
    nome: 'João Silva',
    cpfCnpj: '12345678901',
    endereco: 'Av. Brasil, 500',
    cidade: 'Curitiba',
    uf: 'PR',
    cep: '80000-000',
  },
];

const MOCK_CONDICOES: CondicaoPagamento[] = [
  { id: '1', descricao: 'À vista', parcelas: 1 },
  { id: '2', descricao: '30 dias', diasPrazo: 30 },
  { id: '3', descricao: '2x 30/60 dias', parcelas: 2 },
  { id: '4', descricao: '3x 30/60/90 dias', parcelas: 3 },
];

export async function buscarClientePorCpfCnpj(cpfOuCnpj: string): Promise<Cliente | null> {
  const n = normalizarCpfCnpj(cpfOuCnpj);
  if (n.length < 11) return null;
  const url = process.env.FLUYDO_CLIENTES_API_URL;
  if (url) {
    try {
      const res = await fetch(`${url}?cpfCnpj=${encodeURIComponent(n)}`);
      if (!res.ok) return null;
      const data = (await res.json()) as Cliente | null;
      return data;
    } catch {
      return null;
    }
  }
  const found = MOCK_CLIENTES.find((c) => normalizarCpfCnpj(c.cpfCnpj) === n);
  return found ?? null;
}

export async function listarCondicoesPagamento(): Promise<CondicaoPagamento[]> {
  const url = process.env.FLUYDO_CONDICOES_PAGAMENTO_API_URL;
  if (url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return MOCK_CONDICOES;
      const data = (await res.json()) as CondicaoPagamento[];
      return Array.isArray(data) ? data : MOCK_CONDICOES;
    } catch {
      return MOCK_CONDICOES;
    }
  }
  return MOCK_CONDICOES;
}
