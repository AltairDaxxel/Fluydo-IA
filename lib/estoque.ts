/**
 * Fluydo.AI - Serviço de consulta ao estoque (API externa).
 * Aplica tolerância de 10% nas medidas quando a medida exata não está disponível.
 */

import type { Produto, ProdutoBuscaFiltros } from '@/types';

const TOLERANCIA = 0.1;

/** Dados mock quando FLUYDO_ESTOQUE_API_URL não estiver definida */
const MOCK_PRODUTOS: Produto[] = [
  {
    id: '1',
    codigo: 'VD-001',
    descricao: 'Vedação O-Ring NBR 70 Shore',
    estoque: 100,
    ativo: true,
    medidas: [
      { tipo_medida: 'diametro_interno', valor_mm: 50, unidade: 'mm' },
      { tipo_medida: 'espessura', valor_mm: 3, unidade: 'mm' },
    ],
  },
  {
    id: '2',
    codigo: 'VD-002',
    descricao: 'Vedação O-Ring Viton',
    estoque: 50,
    ativo: true,
    medidas: [
      { tipo_medida: 'diametro_interno', valor_mm: 48, unidade: 'mm' },
      { tipo_medida: 'espessura', valor_mm: 3.2, unidade: 'mm' },
    ],
  },
  {
    id: '3',
    codigo: 'VD-003',
    descricao: 'Retentor radial 50x70x7',
    estoque: 30,
    ativo: true,
    medidas: [
      { tipo_medida: 'diametro_interno', valor_mm: 50, unidade: 'mm' },
      { tipo_medida: 'diametro_externo', valor_mm: 70, unidade: 'mm' },
      { tipo_medida: 'espessura', valor_mm: 7, unidade: 'mm' },
    ],
  },
];

function faixaComTolerancia(medida: number): { min: number; max: number } {
  return {
    min: medida * (1 - TOLERANCIA),
    max: medida * (1 + TOLERANCIA),
  };
}

function itemAtendeMedida(item: Produto, medida: number): boolean {
  const { min, max } = faixaComTolerancia(medida);
  return (item.medidas || []).some(
    (m) => m.valor_mm >= min && m.valor_mm <= max
  );
}

function itemAtendeCodigo(item: Produto, codigo: string): boolean {
  if (!codigo.trim()) return true;
  return item.codigo.toLowerCase().includes(codigo.trim().toLowerCase());
}

function itemAtendeDescricao(item: Produto, termo: string): boolean {
  if (!termo.trim()) return true;
  return item.descricao.toLowerCase().includes(termo.trim().toLowerCase());
}

/**
 * Consulta o estoque por medida (com tolerância 10%) e/ou código.
 * Se a API externa estiver configurada (FLUYDO_ESTOQUE_API_URL), chama ela;
 * caso contrário, usa dados mock.
 */
export async function consultarEstoque(
  filtros: ProdutoBuscaFiltros
): Promise<Produto[]> {
  const { medida, codigo, descricao } = filtros;
  const apiUrl = process.env.FLUYDO_ESTOQUE_API_URL;

  let lista: Produto[];

  if (apiUrl) {
    try {
      const params = new URLSearchParams();
      if (medida != null) params.set('medida', String(medida));
      if (codigo) params.set('codigo', codigo);
      if (descricao) params.set('descricao', descricao);
      const res = await fetch(`${apiUrl}?${params.toString()}`);
      if (!res.ok) throw new Error(`API estoque: ${res.status}`);
      lista = (await res.json()) as Produto[];
    } catch {
      lista = [...MOCK_PRODUTOS];
    }
  } else {
    lista = [...MOCK_PRODUTOS];
  }

  return lista.filter((item) => {
    if (!item.ativo) return false;
    if (medida != null && !itemAtendeMedida(item, medida)) return false;
    if (codigo && !itemAtendeCodigo(item, codigo)) return false;
    if (descricao && !itemAtendeDescricao(item, descricao)) return false;
    return true;
  });
}

export { TOLERANCIA, faixaComTolerancia };
