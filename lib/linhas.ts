/**
 * Fluydo.IA - Regra "Linhas": pré-busca antes de listar produtos.
 * Se o texto do usuário coincidir com Linhas.Descricao e a linha estiver
 * Bloqueada = 'S' ou Aplicacao = 'Exclusiva', não buscamos produtos e retornamos mensagem fixa.
 * Caso contrário, buscamos produtos cujo Código contenha o valor de Linha.
 * Consultas parameterizadas e case-insensitive.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { ProdutoBuscaResult } from './busca-prisma';

export type LinhaMatch = {
  id: string;
  linha: string;
  descricao: string;
  bloqueada: string | null;
  aplicacao: string | null;
};

/**
 * Extrai candidatos para match em Linhas a partir do texto do usuário.
 * Humanos falam "reparo para a linha case", "quero da linha VD" etc.;
 * o que importa é o termo da linha (ex.: "case", "linha case").
 * Retorna [textoCompleto, termoApósLinha, "linha " + termo] sem duplicatas e sem vazios.
 */
export function extractLinhaCandidates(userText: string): string[] {
  const t = (userText || '').trim();
  if (!t) return [];

  const candidates = new Set<string>();
  candidates.add(t);

  // "linha case", "para a linha case", "da linha case", "reparo linha case" → extrai "case"
  const reLinha = /\b(?:para\s+(?:a\s+)?|da\s+|de\s+)?linha\s+(\w+)/gi;
  let match: RegExpExecArray | null;
  while ((match = reLinha.exec(t)) !== null) {
    const term = (match[1] || '').trim();
    if (term.length >= 2) {
      candidates.add(term);
      candidates.add(`linha ${term}`);
    }
  }

  // "listar a linha XXX", "listar linha CE" → extrai "XXX" / "CE"
  const reListarLinha = /\blistar\s+(?:a\s+)?linha\s+(\w+)/gi;
  while ((match = reListarLinha.exec(t)) !== null) {
    const term = (match[1] || '').trim();
    if (term.length >= 2) {
      candidates.add(term);
      candidates.add(`linha ${term}`);
    }
  }

  // Também tenta a última palavra se a frase contiver "linha" (ex.: "reparo linha case" → "case")
  if (/\blinha\b/i.test(t)) {
    const words = t.split(/\s+/).filter((w) => w.length >= 2);
    const last = words[words.length - 1];
    if (last && !/^\d+([.,]\d+)?$/.test(last.replace(',', '.'))) {
      candidates.add(last);
      candidates.add(`linha ${last}`);
    }
  }

  return Array.from(candidates);
}

/**
 * Cascata técnico-descritiva: Passo 1 busca no campo Linha; Passo 2 (se não achar) no campo Descricao.
 * Case-insensitive. Retorna o registro encontrado para filtrar Produtos por prefixo de Codigo.
 */
export async function findLinhaMatch(userText: string): Promise<LinhaMatch | null> {
  const text = (userText || '').trim();
  if (!text) return null;

  try {
    const termo = text.toLowerCase();
    const termoParam = `%${text}%`;

    // Passo 1: buscar no campo Linha da tabela Linhas (exato ou contém)
    const porLinha = await prisma.$queryRaw<Array<{ ID: string; Linha: string; Descricao: string; Bloqueada: string | null; Aplicacao: string | null }>>(
      Prisma.sql`SELECT TOP 5 ID, Linha, Descricao, Bloqueada, Aplicacao FROM Linhas WHERE LOWER(RTRIM(LTRIM(Linha))) = LOWER(${text}) OR LOWER(Linha) LIKE LOWER(${termoParam})`
    );
    if (porLinha.length > 0) {
      const matches = porLinha.map((r) => ({
        id: r.ID,
        linha: (r.Linha ?? '').trim(),
        descricao: r.Descricao ?? '',
        bloqueada: r.Bloqueada ?? null,
        aplicacao: r.Aplicacao ?? null,
      }));
      return pickBestLinhaMatch(matches, text);
    }

    // Passo 2: não achou no Linha → buscar no campo Descricao
    const porDescricao = await prisma.$queryRaw<Array<{ ID: string; Linha: string; Descricao: string; Bloqueada: string | null; Aplicacao: string | null }>>(
      Prisma.sql`SELECT TOP 5 ID, Linha, Descricao, Bloqueada, Aplicacao FROM Linhas WHERE LOWER(Descricao) LIKE LOWER(${termoParam})`
    );
    if (porDescricao.length > 0) {
      const matches = porDescricao.map((r) => ({
        id: r.ID,
        linha: (r.Linha ?? '').trim(),
        descricao: r.Descricao ?? '',
        bloqueada: r.Bloqueada ?? null,
        aplicacao: r.Aplicacao ?? null,
      }));
      return pickBestLinhaMatch(matches, text);
    }

    return null;
  } catch (err) {
    console.warn('[linhas] findLinhaMatch:', err);
    return null;
  }
}

function dbToLinhaMatch(r: { id: string; linha: string; descricao: string; bloqueada: string | null; aplicacao: string | null }): LinhaMatch {
  return {
    id: r.id,
    linha: r.linha ?? '',
    descricao: r.descricao ?? '',
    bloqueada: r.bloqueada ?? null,
    aplicacao: r.aplicacao ?? null,
  };
}

/**
 * Escolhe o melhor match: prioridade para a coluna Linha (código), depois Descricao.
 */
function pickBestLinhaMatch(rows: LinhaMatch[], userText: string): LinhaMatch | null {
  if (rows.length === 0) return null;
  const lower = (userText || '').trim().toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length > 0);
  const termoUnico = words.length === 1 ? words[0] : null;

  const scored = rows.map((r) => {
    const lin = (r.linha || '').trim().toLowerCase();
    const desc = (r.descricao || '').toLowerCase();
    let score = 0;
    // Prioridade máxima: código da linha igual ao termo (ex.: CEN === CEN)
    if (termoUnico && lin === termoUnico) score += 20;
    // Código da linha começa com o termo ou termo começa com o código (ex.: "CE" e linha "CEN")
    else if (termoUnico && (lin.startsWith(termoUnico) || termoUnico.startsWith(lin))) score += 15;
    // Texto completo contém o código da linha (ex.: user "linha CEN" e r.linha "CEN")
    else if (lower.includes(lin) && lin.length >= 2) score += 10;
    // Descrição contém o texto completo
    if (desc.includes(lower)) score += 2;
    // Palavras na descrição ou no código
    score += words.filter((w) => desc.includes(w) || lin.includes(w)).length;
    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0].r : null;
}

/**
 * Indica se a linha está bloqueada ou é exclusiva (não deve listar produtos).
 */
export function isLinhaBloqueadaOuExclusiva(match: LinhaMatch): boolean {
  const bloqueada = (match.bloqueada || '').toUpperCase().trim() === 'S';
  const exclusiva = (match.aplicacao || '').trim() === 'Exclusiva';
  return bloqueada || exclusiva;
}

/**
 * Mensagem padrão quando a linha é bloqueada/exclusiva.
 * Mantém o mesmo texto usado como fallback em Configurações.
 */
export function getMensagemLinhaIndisponivel(): string {
  return 'Essa linha de produto é de venda exclusiva, não está disponível.';
}

/**
 * Retorna os valores da coluna Linha (código da linha) para todas as linhas com Bloqueada = 'S'.
 * Usado em qualquer pesquisa de produtos para não listar produtos dessas linhas.
 */
export async function getLinhasBloqueadas(): Promise<string[]> {
  try {
    const rows = await prisma.$queryRaw<Array<{ Linha: string }>>(
      Prisma.sql`SELECT Linha FROM Linhas WHERE UPPER(RTRIM(LTRIM(ISNULL(Bloqueada,'')))) = 'S'`
    );
    return (rows || []).map((r) => (r.Linha || '').trim()).filter((s) => s.length > 0);
  } catch (err) {
    console.warn('[linhas] getLinhasBloqueadas:', err);
    return [];
  }
}

/**
 * Verifica se um produto pertence a alguma linha bloqueada (por prefixo do código).
 * Prefixo = primeira parte do código antes de '.' ou '-'.
 */
export function produtoPertenceALinhaBloqueada(codigo: string, linhasBloqueadas: string[]): boolean {
  if (!codigo || linhasBloqueadas.length === 0) return false;
  const prefixo = (codigo || '').split(/[.\-]/)[0].trim().toUpperCase();
  if (!prefixo) return false;
  return linhasBloqueadas.some((l) => (l || '').trim().toUpperCase() === prefixo || prefixo.startsWith((l || '').trim().toUpperCase()));
}

/**
 * Busca produtos cujo Código inicia com o código da linha (prefixo).
 * Usado somente na busca por linha (listar linha XXX). Isolamento por idEmitente; apenas ativos.
 * Case-insensitive via raw no SQL Server.
 */
export async function searchProductsByLinha(linha: string, idEmitente: string): Promise<ProdutoBuscaResult[]> {
  const lin = (linha || '').trim();
  const idEmit = (idEmitente || '').trim();
  if (!lin || !idEmit) return [];

  try {
    // Código do produto deve iniciar com o código da linha (ex.: linha CEN → Codigo LIKE 'CEN%')
    const pattern = `${lin}%`;
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
      Prisma.sql`SELECT id, Codigo AS codigo, Descricao AS descricao, dim1, dim2, dim3, dim4, Material AS material, Unidade AS unidade, Aplicacao AS aplicacao, Estoque AS estoque, PrecoUnitario AS precoUnitario, IPI AS ipi FROM Produtos WHERE id_emitente = ${idEmit} AND Ativo = 1 AND LOWER(Codigo) LIKE LOWER(${pattern})`
    );

    const linhasBloqueadas = await getLinhasBloqueadas();
    const filtrados = linhasBloqueadas.length > 0 ? rows.filter((p) => !produtoPertenceALinhaBloqueada(p.codigo ?? '', linhasBloqueadas)) : rows;

    return filtrados.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      descricao: p.descricao,
      dim1: p.dim1 != null ? Number(p.dim1) : null,
      dim2: p.dim2 != null ? Number(p.dim2) : null,
      dim3: p.dim3 != null ? Number(p.dim3) : null,
      dim4: p.dim4 != null ? Number(p.dim4) : null,
      material: p.material,
      unidade: p.unidade,
      aplicacao: p.aplicacao,
      estoque: Number(p.estoque),
      precoUnitario: p.precoUnitario != null ? Number(p.precoUnitario) : null,
      ipi: p.ipi != null ? Number(p.ipi) : null,
    }));
  } catch (err) {
    console.error('[linhas] searchProductsByLinha:', err);
    return [];
  }
}
