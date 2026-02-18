/**
 * Fluydo.IA - Busca inteligente em Produtos (Prisma)
 * Regra de isolamento: ID_Emitente obrigatório em todas as consultas.
 * Filtro: Ativo=1.
 *
 * Regra da busca com várias palavras/números:
 * Retorna SOMENTE produtos que coincidirem com TODAS as palavras e números.
 * Ex.: "ce oring 20 3" → o produto deve ter:
 *   - "ce" em código, descrição ou material;
 *   - "oring" em código, descrição ou material;
 *   - 20 no código (substring) ou em alguma medida (dim1, dim2, dim3, dim4);
 *   - 3 no código (substring) ou em alguma medida.
 */

import { prisma } from './prisma';

/** Epsilon para comparação de decimais (evita 50.0 !== 50.0001) */
const EPSILON_DIM = 0.001;

export interface ProdutoBuscaResult {
  id: string;
  codigo: string;
  descricao: string;
  dim1: number | null;
  dim2: number | null;
  dim3: number | null;
  dim4: number | null;
  material: string | null;
  unidade: string | null;
  aplicacao: string | null;
  estoque: number;
  precoUnitario: number | null;
  ipi: number | null;
}

function decimalToNumber(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === 'number') return d;
  if (typeof d === 'object' && d !== null && 'toNumber' in d) return (d as { toNumber: () => number }).toNumber();
  return Number(d);
}

/** Extrai números da string de busca (para dim1, dim2, dim3) */
function extrairNumeros(texto: string): number[] {
  const numeros: number[] = [];
  const regex = /(\d+([.,]\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    const n = parseFloat(m[1].replace(',', '.'));
    if (!Number.isNaN(n) && n > 0) numeros.push(n);
  }
  return numeros;
}

/** Remove acentos para comparação (vedação = vedacao) */
function normalizarParaBusca(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '');
}

/**
 * Cada palavra deve aparecer em pelo menos um de: código, descrição, material.
 * Todas as palavras precisam ser atendidas (AND).
 */
function atendePalavras(
  palavras: string[],
  descricao: string,
  codigo: string,
  material: string | null
): boolean {
  if (palavras.length === 0) return true;
  const d = normalizarParaBusca(descricao);
  const c = normalizarParaBusca(codigo);
  const m = normalizarParaBusca(material ?? '');
  return palavras.every((palavra) => {
    const p = normalizarParaBusca(palavra);
    return d.includes(p) || c.includes(p) || m.includes(p);
  });
}

/**
 * Cada número deve aparecer no código (como substring) OU em alguma dimensão (dim1..dim4).
 * Todos os números precisam ser atendidos (AND).
 */
function atendeNumeros(
  numeros: number[],
  codigo: string,
  dim1: number | null,
  dim2: number | null,
  dim3: number | null,
  dim4: number | null
): boolean {
  if (numeros.length === 0) return true;
  const codigoNorm = (codigo || '').toLowerCase();
  const dims = [dim1, dim2, dim3, dim4].filter((d) => d != null) as number[];
  const quaseIgual = (a: number, b: number) => Math.abs(a - b) < EPSILON_DIM;
  return numeros.every((num) => {
    const noCodigo = codigoNorm.includes(String(num));
    const emDimensao = dims.some((d) => quaseIgual(d, num));
    return noCodigo || emDimensao;
  });
}

/** Mapeia resultado da busca Prisma para o formato do chat (com medidas e material) */
export function mapBuscaToChatProduto(p: ProdutoBuscaResult): {
  id: string;
  codigo: string;
  descricao: string;
  estoque: number;
  material?: string;
  unidade?: string | null;
  precoUnitario?: number | null;
  ipi?: number | null;
  dim1?: number | null;
  dim2?: number | null;
  dim3?: number | null;
  dim4?: number | null;
  medidas: { tipo_medida: string; valor_mm: number; unidade?: string }[];
} {
  const medidas: { tipo_medida: string; valor_mm: number; unidade?: string }[] = [];
  if (p.dim1 != null) medidas.push({ tipo_medida: 'dim1', valor_mm: p.dim1, unidade: 'mm' });
  if (p.dim2 != null) medidas.push({ tipo_medida: 'dim2', valor_mm: p.dim2, unidade: 'mm' });
  if (p.dim3 != null) medidas.push({ tipo_medida: 'dim3', valor_mm: p.dim3, unidade: 'mm' });
  if (p.dim4 != null) medidas.push({ tipo_medida: 'dim4', valor_mm: p.dim4, unidade: 'mm' });
  return {
    id: p.id,
    codigo: p.codigo,
    descricao: p.descricao,
    estoque: p.estoque,
    material: p.material ?? undefined,
    unidade: p.unidade,
    precoUnitario: p.precoUnitario ?? undefined,
    ipi: p.ipi ?? undefined,
    dim1: p.dim1,
    dim2: p.dim2,
    dim3: p.dim3,
    dim4: p.dim4,
    medidas: medidas.length > 0 ? medidas : [{ tipo_medida: 'unidade', valor_mm: 0, unidade: p.unidade ?? 'Un' }],
  };
}

/**
 * Busca produtos com isolamento por emitente.
 * @param mensagem - Termo de busca (descrição, dimensões, material)
 * @param idEmitente - ID do emitente da sessão (obrigatório; nenhum dado de outro emitente é retornado)
 */
export async function buscarProdutosPrisma(mensagem: string, idEmitente: string): Promise<ProdutoBuscaResult[]> {
  const idEmit = (idEmitente || '').trim();
  if (!idEmit) return [];

  const texto = mensagem.trim();
  const palavras = texto.split(/\s+/).map((p) => p.trim()).filter((p) => p.length > 0);
  const numeros = extrairNumeros(texto);
  const palavrasSemNumero = palavras.filter((p) => !/^\d+([.,]\d+)?$/.test(p.replace(',', '.')));

  let produtos;
  try {
    produtos = await prisma.produto.findMany({
      where: {
        idEmitente: idEmit,
        ativo: 1, // só listar ativos; estoque pode ser zero
      },
    });
  } catch (err) {
    console.error('[busca-prisma] Erro ao buscar produtos no banco:', err);
    return [];
  }

  const antesFiltro = produtos.length;
  const resultado = produtos
    .filter((p) => {
      const dim1 = p.dim1 != null ? decimalToNumber(p.dim1) : null;
      const dim2 = p.dim2 != null ? decimalToNumber(p.dim2) : null;
      const dim3 = p.dim3 != null ? decimalToNumber(p.dim3) : null;
      const dim4 = p.dim4 != null ? decimalToNumber(p.dim4) : null;
      if (!atendePalavras(palavrasSemNumero, p.descricao, p.codigo, p.material)) return false;
      if (!atendeNumeros(numeros, p.codigo, dim1, dim2, dim3, dim4)) return false;
      return true;
    })
    .map((p) => ({
      id: p.id,
      codigo: p.codigo,
      descricao: p.descricao,
      dim1: p.dim1 != null ? decimalToNumber(p.dim1) : null,
      dim2: p.dim2 != null ? decimalToNumber(p.dim2) : null,
      dim3: p.dim3 != null ? decimalToNumber(p.dim3) : null,
      dim4: p.dim4 != null ? decimalToNumber(p.dim4) : null,
      material: p.material,
      unidade: p.unidade,
      aplicacao: p.aplicacao,
      estoque: decimalToNumber(p.estoque),
      precoUnitario: p.precoUnitario != null ? decimalToNumber(p.precoUnitario) : null,
      ipi: p.ipi != null ? decimalToNumber(p.ipi) : null,
    }));

  if (antesFiltro > 0 && resultado.length === 0) {
    console.warn('[busca-prisma] idEmitente=', idEmit, 'termo=', texto, '| produtos no DB=', antesFiltro, '| nenhum produto atendeu a todos os termos');
  }
  if (antesFiltro === 0) {
    console.warn('[busca-prisma] Nenhum produto no DB para idEmitente=', idEmit, 'com ativo=1. Verifique id_emitente e Ativo na tabela Produtos.');
  }

  return resultado;
}
