/**
 * Fluydo.IA - Termos de produto a partir da tabela Vocabulario.
 * Em vez de tirar palavras do texto (stop words), usamos só as palavras que estão no Vocabulario.
 * Ex.: "preciso de guia de nylon com 62" → só "guia" e "nylon" (e 62 fica nos números).
 */

import { prisma } from '@/lib/prisma';

const MIN_TOKEN_LEN = 2;

function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '')
    .replace(/[\s.\-_/\\]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenSemSeparadores(s: string): string {
  return normalizar(s).replace(/\s/g, '');
}

/**
 * Retorna só as palavras do texto que existem na tabela Vocabulario (ID ou Descricao).
 * Matching normalizado (case/acento/pontuação) e por prefixo (token >= 2 chars).
 * Se a tabela não existir ou der erro, retorna [] e a busca usa o texto inteiro (com stop words).
 */
export async function getVocabularySearchTerms(userText: string): Promise<string[]> {
  const raw = (userText || '').trim();
  if (!raw) return [];

  const tokens = raw
    .split(/[\s.\-_/\\]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_TOKEN_LEN)
    .filter((t) => !/^\d+([.,]\d+)?$/.test(t.replace(',', '.'))); // não é número

  if (tokens.length === 0) return [];

  let rows: { id: string; descricao: string }[] = [];
  try {
    rows = await prisma.vocabulario.findMany({
      select: { id: true, descricao: true },
    });
  } catch (err) {
    console.warn('[productVocabulary] Vocabulario indisponível:', err);
    return [];
  }

  if (rows.length === 0) return [];

  const termosUnicos = new Set<string>();
  for (const token of tokens) {
    const tokenNorm = tokenSemSeparadores(token);
    if (tokenNorm.length < MIN_TOKEN_LEN) continue;

    for (const row of rows) {
      const idNorm = tokenSemSeparadores(row.id);
      const descNorm = tokenSemSeparadores(row.descricao);
      const match =
        idNorm === tokenNorm ||
        descNorm === tokenNorm ||
        idNorm.startsWith(tokenNorm) ||
        tokenNorm.startsWith(idNorm) ||
        descNorm.startsWith(tokenNorm) ||
        tokenNorm.startsWith(descNorm);
      if (match) {
        termosUnicos.add(tokenNorm);
        break;
      }
    }
  }

  return Array.from(termosUnicos);
}
