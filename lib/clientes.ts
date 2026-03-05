/**
 * Fluydo.AI - Busca de cliente (CPF/CNPJ) e condições de pagamento.
 * CNPJ: API pública OpenCNPJ (https://opencnpj.org/). CPF: env FLUYDO_CLIENTES_API_URL ou mock.
 */

import type { Cliente, CondicaoPagamento } from '@/types';

const OPENCNPJ_BASE = 'https://api.opencnpj.org';

/** Resposta da API OpenCNPJ (campos usados para mapear para Cliente) */
interface OpenCnpjResponse {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  municipio?: string;
  email?: string;
  telefones?: Array<{ ddd?: string; numero?: string }>;
}

function normalizarCpfCnpj(v: string): string {
  return v.replace(/\D/g, '');
}

function formatarCep(cep: string | undefined): string | undefined {
  if (!cep) return undefined;
  const n = cep.replace(/\D/g, '');
  if (n.length !== 8) return cep;
  return `${n.slice(0, 5)}-${n.slice(5)}`;
}

/** Mock: clientes e condições (usado para CPF quando não há API externa). */
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

/** Consulta CNPJ na API pública OpenCNPJ e mapeia para Cliente. */
async function buscarCnpjOpenCnpj(cnpjNumeros: string): Promise<Cliente | null> {
  try {
    const res = await fetch(`${OPENCNPJ_BASE}/${cnpjNumeros}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OpenCnpjResponse;
    const nome = data.razao_social?.trim() || data.nome_fantasia?.trim() || 'Empresa';
    const partesEndereco = [
      [data.logradouro, data.numero].filter(Boolean).join(', '),
      data.complemento,
      data.bairro,
    ].filter(Boolean);
    const endereco = partesEndereco.length > 0 ? partesEndereco.join(', ') : '';
    const telefone =
      data.telefones?.[0] != null
        ? `(${data.telefones[0].ddd ?? ''}) ${data.telefones[0].numero ?? ''}`.trim()
        : undefined;
    const cliente: Cliente = {
      id: data.cnpj ?? cnpjNumeros,
      nome,
      cpfCnpj: data.cnpj ?? cnpjNumeros,
      endereco,
      cidade: data.municipio ?? '',
      uf: data.uf ?? '',
      cep: formatarCep(data.cep),
      email: data.email?.trim() || undefined,
      telefone,
    };
    return cliente;
  } catch {
    return null;
  }
}

export async function buscarClientePorCpfCnpj(cpfOuCnpj: string): Promise<Cliente | null> {
  const n = normalizarCpfCnpj(cpfOuCnpj);
  if (n.length < 11) return null;

  // API própria (env) tem prioridade
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

  // CNPJ (14 dígitos): consulta API pública OpenCNPJ
  if (n.length === 14) {
    const porApi = await buscarCnpjOpenCnpj(n);
    if (porApi) return porApi;
  }

  // CPF (11 dígitos): não há API pública gratuita com dados; usa mock ou cadastro próprio
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
