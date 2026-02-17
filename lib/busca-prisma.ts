/**
 * Fluydo.IA - Busca inteligente em Produtos (Prisma)
 * Descrição (todas as palavras), dimensões (10%), material. Filtros: Ativo=1, Estoque>0.
 */

import { prisma } from './prisma';

const TOLERANCIA_DIM = 0.1;

/** Termos conhecidos de material para match no campo Material */
const MATERIAIS_CONHECIDOS = [
  'viton', 'nitrílica', 'nitrilica', 'nbr', 'epdm', 'silicone', 'ptfe', 'poliuretano',
  'vedação', 'vedacao', 'borracha', 'metal', 'acrílico', 'acrilico',
];

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

/** Verifica se o produto atende às dimensões com tolerância 10% */
function atendeDimensoes(
  dim1: number | null, dim2: number | null, dim3: number | null,
  valores: number[]
): boolean {
  if (valores.length === 0) return true;
  const dims = [dim1, dim2, dim3].filter((d) => d != null) as number[];
  if (dims.length < valores.length) return false;
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i];
    const min = v * (1 - TOLERANCIA_DIM);
    const max = v * (1 + TOLERANCIA_DIM);
    const encontrou = dims.some((d) => d >= min && d <= max);
    if (!encontrou) return false;
  }
  return true;
}

/** Descrição contém todas as palavras (ordem livre) */
function atendeDescricao(descricao: string, palavras: string[]): boolean {
  if (palavras.length === 0) return true;
  const d = descricao.toLowerCase();
  return palavras.every((p) => d.includes(p.toLowerCase()));
}

/** Material coincide com algum termo da busca */
function atendeMaterial(material: string | null, termosBusca: string[]): boolean {
  if (!material || termosBusca.length === 0) return true;
  const m = material.toLowerCase();
  const termos = termosBusca.map((t) => t.toLowerCase());
  return termos.some((t) => m.includes(t) || MATERIAIS_CONHECIDOS.some((mc) => mc.includes(t) && m.includes(mc)));
}

/** Identifica termos que parecem material */
function termosMaterial(palavras: string[]): string[] {
  return palavras.filter((p) =>
    MATERIAIS_CONHECIDOS.some((mc) => mc.includes(p.toLowerCase()) || p.toLowerCase().includes(mc))
  );
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
  dim1?: number | null;
  dim2?: number | null;
  dim3?: number | null;
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
    dim1: p.dim1,
    dim2: p.dim2,
    dim3: p.dim3,
    medidas: medidas.length > 0 ? medidas : [{ tipo_medida: 'unidade', valor_mm: 0, unidade: p.unidade ?? 'Un' }],
  };
}

export async function buscarProdutosPrisma(mensagem: string): Promise<ProdutoBuscaResult[]> {
  const texto = mensagem.trim();
  const palavras = texto.split(/\s+/).map((p) => p.trim()).filter((p) => p.length > 0);
  const numeros = extrairNumeros(texto);
  const palavrasSemNumero = palavras.filter((p) => !/^\d+([.,]\d+)?$/.test(p.replace(',', '.')));
  const termosMat = termosMaterial(palavrasSemNumero);

  const produtos = await prisma.produto.findMany({
    where: {
      ativo: 1,
      estoque: { gt: 0 },
    },
  });

  return produtos
    .filter((p) => {
      const estoqueNum = decimalToNumber(p.estoque);
      if (estoqueNum <= 0) return false;
      if (!atendeDescricao(p.descricao, palavrasSemNumero)) return false;
      const dim1 = p.dim1 != null ? decimalToNumber(p.dim1) : null;
      const dim2 = p.dim2 != null ? decimalToNumber(p.dim2) : null;
      const dim3 = p.dim3 != null ? decimalToNumber(p.dim3) : null;
      if (!atendeDimensoes(dim1, dim2, dim3, numeros)) return false;
      if (!atendeMaterial(p.material, termosMat)) return false;
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
    }));
}
