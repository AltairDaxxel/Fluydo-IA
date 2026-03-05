/**
 * Fluydo.IA - API de ajuda (FluydoAjuda, FluydoAjudaGatilhos, FluydoAjudaExemplos).
 * GET ?slug=xxx - artigo por slug com exemplos
 * GET ?sugestao=xxx - sugestões a partir do texto
 * GET - lista artigos ativos (menu)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHelpBySlug, getHelpSuggestions, listHelpArticles } from '@/lib/help/fluydoAjuda';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const sugestao = searchParams.get('sugestao');

  try {
    if (slug && typeof slug === 'string') {
      const artigo = await getHelpBySlug(slug.trim());
      if (!artigo) {
        return NextResponse.json({ error: 'Artigo não encontrado' }, { status: 404 });
      }
      return NextResponse.json(artigo);
    }

    if (sugestao && typeof sugestao === 'string') {
      const artigos = await getHelpSuggestions(sugestao.trim());
      return NextResponse.json({ artigos });
    }

    const artigos = await listHelpArticles();
    return NextResponse.json({ artigos });
  } catch (err) {
    console.error('[api/ajuda] Erro:', err);
    return NextResponse.json({ error: 'Erro ao buscar ajuda' }, { status: 500 });
  }
}
