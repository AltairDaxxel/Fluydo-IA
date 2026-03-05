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
 *
 * Palavra reservada "Linha": se a mensagem for "linha X" (ex.: "linha VD", "linha CE"),
 * retorna produtos cujo código (parte antes do primeiro ".") tenha os 2 ou 3 primeiros
 * caracteres iguais a X.
 *
 * Palavra reservada "Medida" (ou "com medida"): os números que vierem APÓS essa frase
 * são considerados apenas como dimensões (dim1, dim2, dim3, dim4), não no código.
 * Ex.: "retentor medida 130" → descrição/código contém "retentor" E alguma dim = 130;
 * "medida 20 30" → produtos que tenham 20 e 30 em dim1..dim4.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getLinhasBloqueadas, produtoPertenceALinhaBloqueada } from './linhas';

/** Epsilon para comparação de decimais (evita 50.0 !== 50.0001) */
const EPSILON_DIM = 0.001;
/** Tolerância default (mm) para modo TOLERANCE da busca estruturada */
const DEFAULT_TOLERANCE_MM = 0.2;

export type StructuredDimFilter = {
  dim1?: number | null;
  dim2?: number | null;
  dim3?: number | null;
  dim4?: number | null;
  /** STRICT = sem tolerância; TOLERANCE = aplica intervalo nas dimensões. */
  mode: 'STRICT' | 'TOLERANCE';
  /**
   * Tolerância absoluta em milímetros (usada quando tolerancePercent não é fornecido).
   * Ex.: 0.2mm em torno da medida alvo.
   */
  toleranceMm?: number;
  /**
   * Tolerância percentual (0.05 = 5%). Quando presente, a tolerância por dimensão
   * é calculada como abs(dimDesejada) * tolerancePercent.
   */
  tolerancePercent?: number;
  /**
   * Direção da tolerância relativa:
   * - PLUS_MINUS: faixa simétrica (v * (1 ± p))
   * - PLUS_ONLY:  apenas para mais (v .. v * (1 + p))
   * - MINUS_ONLY: apenas para menos (v * (1 - p) .. v)
   * Quando ausente, assume PLUS_MINUS para manter compatibilidade.
   */
  direction?: 'PLUS_MINUS' | 'PLUS_ONLY' | 'MINUS_ONLY';
};

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

/** Rótulos: d1/d2/d3/d4 → dim1..dim4; mat → Material; perf → CTU (perfil); apli → Aplicacao */
export interface ParsedLabels {
  /** Tokens restantes para busca na CTU (nome do produto, perfil já incluso se houver "perf X") */
  termosCTU: string[];
  dim1?: number;
  dim2?: number;
  dim3?: number;
  dim4?: number;
  material?: string;
  perfil?: string;
  aplicacao?: string;
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

const ROTULOS_DIM = /^(d1|d2|d3|d4|dim1|dim2|dim3|dim4)$/i;
const ROTULO_MAT = /^mat$/i;
const ROTULO_PERF = /^perf$/i;
const ROTULO_APLI = /^apli$/i;
function isNumberToken(t: string): boolean {
  return /^\d+([.,]\d+)?$/.test(t) && !Number.isNaN(parseFloat(t.replace(',', '.')));
}

/**
 * Parseia rótulos na mensagem: d1/d2/d3/d4 (ou dim1..dim4) → dimensões; mat → material; perf → perfil (CTU); apli → aplicação (campo Aplicacao).
 * Retorna termos restantes para CTU (sem os rótulos nem os valores usados em dim/material/aplicação) e perfil incluso em termosCTU.
 */
export function parseLabels(mensagem: string): ParsedLabels {
  const texto = (mensagem || '').trim().replace(/,/g, '.');
  const tokens = texto.split(/\s+/).map((t) => t.trim()).filter(Boolean);
  const termosCTU: string[] = [];
  const out: ParsedLabels = { termosCTU };

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    const next = tokens[i + 1];
    const tLower = t.toLowerCase();

    if (ROTULOS_DIM.test(t) && next !== undefined && isNumberToken(next)) {
      const num = parseFloat(next.replace(',', '.'));
      if (!Number.isNaN(num)) {
        if (/^d1|dim1$/i.test(t)) out.dim1 = num;
        else if (/^d2|dim2$/i.test(t)) out.dim2 = num;
        else if (/^d3|dim3$/i.test(t)) out.dim3 = num;
        else if (/^d4|dim4$/i.test(t)) out.dim4 = num;
        i += 1;
        continue;
      }
    }
    if (ROTULO_MAT.test(t) && next !== undefined && next.length > 0) {
      out.material = next.trim();
      i += 1;
      continue;
    }
    if (ROTULO_PERF.test(t) && next !== undefined && next.length > 0) {
      out.perfil = next.trim();
      termosCTU.push(next.trim());
      i += 1;
      continue;
    }
    if (ROTULO_APLI.test(t) && next !== undefined && next.length > 0) {
      out.aplicacao = next.trim();
      i += 1;
      continue;
    }
    termosCTU.push(t);
  }

  return out;
}

/** Normaliza medidas: ponto vira vírgula (31.9 → 31,9). Usuário pode digitar com ponto ou vírgula; internamente buscamos com vírgula. */
function normalizarMedidasParaVirgula(texto: string): string {
  return (texto || '').replace(/(\d+)\.(\d+)/g, '$1,$2');
}

/** Palavras que não exige no produto: conectores + frases de pedido (ex.: "preciso de guia de nylon com 62" → busca só guia, nylon e 62). */
const STOP_WORDS_BUSCA = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'por', 'um', 'uma', 'uns', 'umas',
  'com', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'à', 'às', 'em', 'e', 'ou', 'que', 'o', 'a', 'os', 'as',
  'preciso', 'precisamos', 'quero', 'queremos', 'necessito', 'gostaria', 'queria', 'precisa',
  'tem', 'tenho', 'achar', 'acho', 'procurando', 'buscar', 'busca', 'encontrar', 'encontre',
  'mandar', 'enviar', 'pedir', 'pedido', 'cotar', 'cotação', 'orçar', 'orcamento',
]);

/** Remove acentos para comparação (vedação = vedacao) */
function normalizarParaBusca(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '');
}

/** Texto sem separadores para "contains" (oring bate em O-Ring, o-ring, etc.) */
function textoSemSeparadores(s: string): string {
  return normalizarParaBusca(s).replace(/[\s\-_.,;]+/g, '');
}

/**
 * Constrói blocos de texto do catálogo (cada descrição/código/material/aplicação sem separadores).
 * Usado para saber se uma palavra do usuário "aparece" no catálogo (ex.: "oring" em "O-Ring NBR").
 */
function buildCatalogTexts(
  produtos: Array<{ descricao: string | null; codigo: string | null; material: string | null; aplicacao?: string | null }>
): string[] {
  const blocos: string[] = [];
  for (const p of produtos) {
    for (const val of [p.descricao ?? '', p.codigo ?? '', p.material ?? '', (p as { aplicacao?: string | null }).aplicacao ?? '']) {
      const semSep = textoSemSeparadores(val);
      if (semSep.length > 0) blocos.push(semSep);
    }
  }
  return blocos;
}

/**
 * Anel e O-Ring são o mesmo produto: busca por "anel" deve trazer anel e oring, e vice-versa.
 * Retorna a palavra normalizada e suas variantes (sem separadores) para matching.
 * Exportada para testes.
 */
export function variantesAnelOring(palavraSemSep: string): string[] {
  if (!palavraSemSep) return [];
  const p = palavraSemSep.toLowerCase();
  if (p === 'anel' || p === 'oring') return ['anel', 'oring'];
  return [p];
}

/** Verifica se a palavra (sem separadores) ou alguma variante sinônima aparece no catálogo. */
function palavraEstaNoCatalogo(palavraSemSep: string, catalogTexts: string[]): boolean {
  if (!palavraSemSep) return false;
  const variantes = variantesAnelOring(palavraSemSep);
  return variantes.some((v) => catalogTexts.some((bloco) => bloco.includes(v)));
}

/** Verifica se a palavra (normalizada, sem separadores) aparece em algum dos textos. */
function textoContemPalavra(textoNormSemSep: string, palavraNormSemSep: string): boolean {
  if (!palavraNormSemSep) return true;
  return textoNormSemSep.includes(palavraNormSemSep);
}

/**
 * Cada palavra deve aparecer em pelo menos um de: código, descrição, material.
 * Todas as palavras precisam ser atendidas (AND).
 * Usa matching sem separadores (oring = O-Ring). Anel e oring são sinônimos: basta o produto ter um ou outro.
 */
function atendePalavras(
  palavras: string[],
  descricao: string,
  codigo: string,
  material: string | null
): boolean {
  if (palavras.length === 0) return true;
  const d = textoSemSeparadores(descricao);
  const c = textoSemSeparadores(codigo);
  const m = textoSemSeparadores(material ?? '');
  return palavras.every((palavra) => {
    const p = textoSemSeparadores(palavra);
    const variantes = variantesAnelOring(p);
    return variantes.some(
      (v) =>
        textoContemPalavra(d, v) ||
        textoContemPalavra(c, v) ||
        textoContemPalavra(m, v)
    );
  });
}

/** Retorna quantas palavras (ou variantes anel/oring) aparecem no produto (para ordenar por relevância). */
function countPalavrasMatch(
  palavras: string[],
  descricao: string,
  codigo: string,
  material: string | null
): number {
  if (palavras.length === 0) return 0;
  const d = textoSemSeparadores(descricao);
  const c = textoSemSeparadores(codigo);
  const m = textoSemSeparadores(material ?? '');
  return palavras.filter((palavra) => {
    const p = textoSemSeparadores(palavra);
    const variantes = variantesAnelOring(p);
    return variantes.some(
      (v) =>
        textoContemPalavra(d, v) ||
        textoContemPalavra(c, v) ||
        textoContemPalavra(m, v)
    );
  }).length;
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

/**
 * Cada número deve aparecer em alguma dimensão (dim1..dim4) — não considera código.
 * Usado quando o usuário escreve "medida 130" ou "com medida 20 30".
 */
function atendeNumerosSoDimensao(
  numeros: number[],
  dim1: number | null,
  dim2: number | null,
  dim3: number | null,
  dim4: number | null
): boolean {
  if (numeros.length === 0) return true;
  const dims = [dim1, dim2, dim3, dim4].filter((d) => d != null) as number[];
  const quaseIgual = (a: number, b: number) => Math.abs(a - b) < EPSILON_DIM;
  return numeros.every((num) => dims.some((d) => quaseIgual(d, num)));
}

function quaseIgualComTolerancia(a: number, b: number, tol: number, direction: 'PLUS_MINUS' | 'PLUS_ONLY' | 'MINUS_ONLY'): boolean {
  if (direction === 'PLUS_ONLY') {
    // a (valor real) pode ser maior até tol, mas não menor
    if (a < b) return false;
    return a - b <= tol;
  }
  if (direction === 'MINUS_ONLY') {
    // a pode ser menor até tol, mas não maior
    if (a > b) return false;
    return b - a <= tol;
  }
  // PLUS_MINUS (padrão): faixa simétrica
  return Math.abs(a - b) <= tol;
}

function atendeDimFilterEstruturado(
  p: { dim1: unknown; dim2: unknown; dim3: unknown; dim4: unknown },
  filter: StructuredDimFilter
): boolean {
  const hasPercent = typeof filter.tolerancePercent === 'number' && Number.isFinite(filter.tolerancePercent);
  const baseTolMm = filter.toleranceMm ?? DEFAULT_TOLERANCE_MM;
  const direction: 'PLUS_MINUS' | 'PLUS_ONLY' | 'MINUS_ONLY' = filter.direction ?? 'PLUS_MINUS';
  const d1 = p.dim1 != null ? decimalToNumber(p.dim1) : null;
  const d2 = p.dim2 != null ? decimalToNumber(p.dim2) : null;
  const d3 = p.dim3 != null ? decimalToNumber(p.dim3) : null;
  const d4 = p.dim4 != null ? decimalToNumber(p.dim4) : null;

  const checks: Array<[number | null | undefined, number | null]> = [
    [filter.dim1, d1],
    [filter.dim2, d2],
    [filter.dim3, d3],
    [filter.dim4, d4],
  ];
  for (const [wanted, actual] of checks) {
    if (wanted == null) continue;
    if (actual == null) return false;
    const tol =
      filter.mode === 'TOLERANCE'
        ? hasPercent
          ? Math.abs(wanted) * (filter.tolerancePercent as number)
          : baseTolMm
        : EPSILON_DIM;
    if (!quaseIgualComTolerancia(actual, wanted, tol, direction)) return false;
  }
  return true;
}

/**
 * Primeira pesquisa: por código no campo Produtos.Codigo (exato ou prefixo).
 * Usada assim que um candidato a código é identificado na mensagem (após eliminar ruído).
 */
export async function buscarProdutosPorCodigo(codigo: string, idEmitente: string): Promise<ProdutoBuscaResult[]> {
  const idEmit = (idEmitente || '').trim();
  const cod = (codigo || '').trim();
  if (!idEmit || !cod) return [];

  try {
    const patternPrefix = `${cod}%`;
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        codigo: string;
        descricao: string;
        dim1: unknown;
        dim2: unknown;
        dim3: unknown;
        dim4: unknown;
        material: string | null;
        unidade: string | null;
        aplicacao: string | null;
        estoque: unknown;
        precoUnitario: unknown;
        ipi: unknown;
      }>
    >(
      Prisma.sql`SELECT id, Codigo AS codigo, Descricao AS descricao, dim1, dim2, dim3, dim4, Material AS material, Unidade AS unidade, Aplicacao AS aplicacao, Estoque AS estoque, PrecoUnitario AS precoUnitario, IPI AS ipi FROM Produtos WHERE id_emitente = ${idEmit} AND Ativo = 1 AND (LOWER(RTRIM(Codigo)) = LOWER(${cod}) OR LOWER(Codigo) LIKE LOWER(${patternPrefix}))`
    );

    const linhasBloqueadas = await getLinhasBloqueadas();
    const filtrados =
      linhasBloqueadas.length > 0 ? rows.filter((p) => !produtoPertenceALinhaBloqueada(p.codigo ?? '', linhasBloqueadas)) : rows;

    return filtrados.map((p) => ({
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
  } catch (err) {
    console.error('[busca-prisma] buscarProdutosPorCodigo:', err);
    return [];
  }
}

/** Mapeia resultado da busca Prisma para o formato do chat (com medidas e material) */
export function mapBuscaToChatProduto(p: ProdutoBuscaResult): {
  id: string;
  codigo: string;
  descricao: string;
  estoque: number;
  material?: string;
  unidade?: string | null;
  aplicacao?: string | null;
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
    aplicacao: p.aplicacao ?? undefined,
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
 * Busca produtos com isolamento por emitente usando CTU (Chave Técnica Unificada).
 * A pesquisa é feita exclusivamente na coluna CTU com interseção obrigatória de TODOS os termos digitados.
 * @param mensagem - Termo de busca digitado pelo usuário
 * @param idEmitente - ID do emitente da sessão (obrigatório; nenhum dado de outro emitente é retornado)
 */
export async function buscarProdutosPrisma(
  mensagem: string,
  idEmitente: string,
  opts?: { structuredDimFilter?: StructuredDimFilter }
): Promise<ProdutoBuscaResult[]> {
  const idEmit = (idEmitente || '').trim();
  if (!idEmit) return [];

  const textoOriginal = (mensagem || '').trim();
  if (!textoOriginal) return [];

  // 1) Parser de rótulos: d1..d4 → dim1..dim4; mat → Material; perf → CTU; apli → Aplicacao
  const parsed = parseLabels(textoOriginal);

  // 2) Remoção de saudações nos termos que vão para a CTU
  const saudacoesSimples = new Set(['oi', 'olá', 'ola']);
  const termos: string[] = [];
  const termosCTU = parsed.termosCTU;
  for (let i = 0; i < termosCTU.length; i += 1) {
    const atual = termosCTU[i];
    const prox = termosCTU[i + 1];
    const atualLower = atual.toLowerCase();
    const proxLower = prox?.toLowerCase();
    if (
      (atualLower === 'bom' && proxLower === 'dia') ||
      (atualLower === 'boa' && (proxLower === 'tarde' || proxLower === 'noite'))
    ) {
      i += 1;
      continue;
    }
    if (saudacoesSimples.has(atualLower)) continue;
    termos.push(atual);
  }

  const keywords = Array.from(new Set(termos.map((t) => t.toUpperCase()))).filter((t) => t.length > 0);
  const hasStructured = [parsed.dim1, parsed.dim2, parsed.dim3, parsed.dim4, parsed.material, parsed.aplicacao].some(
    (v) => v != null && (typeof v !== 'string' || v.length > 0)
  );
  if (keywords.length === 0 && !hasStructured) return [];

  // 3) Condições WHERE: base + dim1..dim4 + Material + Aplicacao + CTU
  const parts: Prisma.Sql[] = [];

  if (parsed.dim1 != null) parts.push(Prisma.sql`dim1 = ${parsed.dim1}`);
  if (parsed.dim2 != null) parts.push(Prisma.sql`dim2 = ${parsed.dim2}`);
  if (parsed.dim3 != null) parts.push(Prisma.sql`dim3 = ${parsed.dim3}`);
  if (parsed.dim4 != null) parts.push(Prisma.sql`dim4 = ${parsed.dim4}`);
  if (parsed.material != null && parsed.material.length > 0) {
    parts.push(Prisma.sql`LOWER(Material) LIKE LOWER(${'%' + parsed.material + '%'})`);
  }
  if (parsed.aplicacao != null && parsed.aplicacao.length > 0) {
    parts.push(Prisma.sql`LOWER(Aplicacao) LIKE LOWER(${'%' + parsed.aplicacao + '%'})`);
  }

  for (const term of keywords) {
    parts.push(Prisma.sql`LOWER(CTU) LIKE LOWER(${'%' + term + '%'})`);
  }

  let whereClause = parts[0];
  for (let i = 1; i < parts.length; i += 1) {
    whereClause = Prisma.sql`${whereClause} AND ${parts[i]}`;
  }

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        codigo: string;
        descricao: string;
        dim1: unknown;
        dim2: unknown;
        dim3: unknown;
        dim4: unknown;
        material: string | null;
        unidade: string | null;
        aplicacao: string | null;
        estoque: unknown;
        precoUnitario: unknown;
        ipi: unknown;
      }>
    >(
      Prisma.sql`SELECT id, Codigo AS codigo, Descricao AS descricao, dim1, dim2, dim3, dim4, Material AS material, Unidade AS unidade, Aplicacao AS aplicacao, Estoque AS estoque, PrecoUnitario AS precoUnitario, IPI AS ipi FROM Produtos WHERE id_emitente = ${idEmit} AND Ativo = 1 AND ${whereClause}`
    );

    // Não listar produtos de linhas bloqueadas em nenhuma pesquisa.
    let filtrados = rows;
    try {
      const linhasBloqueadas = await getLinhasBloqueadas();
      if (linhasBloqueadas.length > 0) {
        filtrados = rows.filter((p) => !produtoPertenceALinhaBloqueada(p.codigo ?? '', linhasBloqueadas));
      }
    } catch (err) {
      console.warn('[busca-prisma] Erro ao filtrar linhas bloqueadas (CTU):', err);
    }

    return filtrados.map((p) => ({
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
  } catch (err) {
    console.error('[busca-prisma] Erro na busca CTU (interseção obrigatória):', err);
    return [];
  }
}
