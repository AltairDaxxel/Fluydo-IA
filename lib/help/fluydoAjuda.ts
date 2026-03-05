/**
 * Fluydo.IA - Sistema de ajuda carregado apenas do SQL Server.
 * Tabelas: FluydoAjuda, FluydoAjudaGatilhos, FluydoAjudaExemplos.
 */

import { prisma } from '@/lib/prisma';
import type { AjudaArtigo, AjudaArtigoComExemplos, AjudaExemplo } from './types';

function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Busca artigo por slug com exemplos ordenados */
export async function getHelpBySlug(slug: string): Promise<AjudaArtigoComExemplos | null> {
  try {
    const row = await prisma.fluydoAjuda.findFirst({
      where: {
        slug: slug.trim(),
        ativo: 1,
      },
      include: {
        exemplos: {
          where: { ativo: 1 },
          orderBy: { ordem: 'asc' },
        },
      },
    });
    if (!row) return null;
    return mapToArtigoComExemplos(row);
  } catch (err) {
    console.warn('[fluydoAjuda] getHelpBySlug erro:', err);
    return null;
  }
}

/** Lista artigos ativos ordenados por Ordem (para menu de ajuda) */
export async function listHelpArticles(): Promise<AjudaArtigo[]> {
  try {
    const rows = await prisma.fluydoAjuda.findMany({
      where: { ativo: 1 },
      orderBy: { ordem: 'asc' },
    });
    return rows.map(mapToArtigo);
  } catch (err) {
    console.warn('[fluydoAjuda] listHelpArticles erro:', err);
    return [];
  }
}

/** Sugere artigos relevantes a partir do texto do usuário (top 3) */
export async function getHelpSuggestions(userText: string): Promise<AjudaArtigo[]> {
  const t = normalizar(userText);
  if (!t) return [];

  try {
    const artigos = await prisma.fluydoAjuda.findMany({
      where: { ativo: 1 },
      orderBy: { ordem: 'asc' },
      include: { gatilhos: { where: { ativo: 1 } } },
    });

    const scores = new Map<number, number>();

    for (const a of artigos) {
      let totalScore = 0;
      let matchCount = 0;
      for (const g of a.gatilhos) {
        const padraoNorm = normalizar(g.padrao);
        const tipo = (g.tipoPadrao || 'contains').toLowerCase();

        if (tipo === 'contains') {
          const match = t.includes(padraoNorm);
          if (match) {
            const exactToken = t.split(/\s+/).some((tok) => tok === padraoNorm);
            totalScore += g.peso + (exactToken ? 2 : 0);
            matchCount++;
          }
        } else if (tipo === 'startswith') {
          const tokens = t.split(/\s+/);
          const match = tokens.some((tok) => tok.startsWith(padraoNorm) || padraoNorm.startsWith(tok));
          if (match) {
            totalScore += g.peso + 1;
            matchCount++;
          }
        } else if (tipo === 'regex') {
          try {
            const re = new RegExp(padraoNorm, 'i');
            if (re.test(t)) {
              totalScore += g.peso;
              matchCount++;
            }
          } catch {
            // regex inválido, ignora
          }
        }
      }
      if (matchCount > 0) {
        totalScore += matchCount * 0.5; // bônus por múltiplos gatilhos do mesmo artigo
        scores.set(a.id, totalScore);
      }
    }

    const sorted = [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => artigos.find((a) => a.id === id)!)
      .filter(Boolean);

    return sorted.map(mapToArtigo);
  } catch (err) {
    console.warn('[fluydoAjuda] getHelpSuggestions erro:', err);
    return [];
  }
}

/** Verifica se a mensagem é pedido explícito de ajuda */
export function isExplicitHelpRequest(msg: string): boolean {
  const t = normalizar(msg.trim());
  const termos = ['ajuda', 'help', 'como usar', 'como faco', 'como faço', 'como faz', 'manual', 'instrucoes', 'instruções'];
  return termos.some((termo) => t === termo || t.startsWith(termo + ' ') || t.includes(' ' + termo + ' '));
}

function mapToArtigo(row: { id: number; slug: string; titulo: string; resumo: string | null; conteudoMd: string; tags: string | null; ordem: number; ativo: number; visibilidade: string }): AjudaArtigo {
  return {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
    resumo: row.resumo,
    conteudoMd: row.conteudoMd,
    tags: row.tags,
    ordem: row.ordem,
    ativo: row.ativo === 1,
    visibilidade: row.visibilidade,
  };
}

function mapToArtigoComExemplos(
  row: { id: number; slug: string; titulo: string; resumo: string | null; conteudoMd: string; tags: string | null; ordem: number; ativo: number; visibilidade: string; exemplos: Array<{ id: number; ajudaId: number; exemplo: string; observacao: string | null; ordem: number; ativo: number }> }
): AjudaArtigoComExemplos {
  const artigo = mapToArtigo(row);
  const exemplos: AjudaExemplo[] = row.exemplos.map((e) => ({
    id: e.id,
    ajudaId: e.ajudaId,
    exemplo: e.exemplo,
    observacao: e.observacao,
    ordem: e.ordem,
    ativo: e.ativo === 1,
  }));
  return { ...artigo, exemplos };
}
