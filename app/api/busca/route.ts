/**
 * Fluydo.IA - API de busca inteligente (Prisma)
 * Regra de isolamento: ID_Emitente obrigatório (query ou body). Descrição, dimensões 10%, material. Ativo=1, Estoque>0.
 */

import { NextRequest, NextResponse } from 'next/server';
import { hasDatabase } from '@/lib/prisma';
import { buscarProdutosPrisma, type ProdutoBuscaResult } from '@/lib/busca-prisma';

export const dynamic = 'force-dynamic';

export interface BuscaResponse {
  ok: boolean;
  produtos?: ProdutoBuscaResult[];
  texto?: string;
  error?: string;
}

function getIdEmitente(request: NextRequest, body: Record<string, unknown>): string {
  const fromQuery = request.nextUrl.searchParams.get('idEmitente') ?? request.nextUrl.searchParams.get('id_emitente');
  const fromBody = body?.idEmitente ?? body?.id_emitente;
  const str = (typeof fromBody === 'string' ? fromBody : fromQuery) ?? '';
  return str.trim();
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  const idEmitente = getIdEmitente(request, {});
  return handleBusca(q.trim(), idEmitente);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const mensagem = typeof body.mensagem === 'string' ? body.mensagem : typeof body.q === 'string' ? body.q : '';
    const idEmitente = getIdEmitente(request, body);
    return handleBusca(mensagem.trim(), idEmitente);
  } catch {
    return NextResponse.json({ ok: false, error: 'Requisição inválida.' }, { status: 400 });
  }
}

async function handleBusca(mensagem: string, idEmitente: string): Promise<NextResponse<BuscaResponse>> {
  if (!hasDatabase()) {
    return NextResponse.json({
      ok: false,
      produtos: [],
      texto: 'Banco de dados não configurado. Configure DATABASE_URL e execute as migrações Prisma.',
    });
  }

  if (!idEmitente) {
    return NextResponse.json(
      { ok: false, produtos: [], error: 'ID_Emitente é obrigatório para a busca (query idEmitente ou body idEmitente).' },
      { status: 400 }
    );
  }

  if (mensagem.length < 2) {
    return NextResponse.json({
      ok: true,
      produtos: [],
      texto: 'Digite ao menos um termo para buscar (descrição, dimensões ou material).',
    });
  }

  try {
    const produtos = await buscarProdutosPrisma(mensagem, idEmitente);

    const texto =
      produtos.length === 0
        ? `Nenhum produto encontrado para "${mensagem}". Tente outros termos, dimensões ou material.`
        : produtos.length === 1
          ? `Encontrei 1 produto para "${mensagem}".`
          : `Encontrei ${produtos.length} produtos para "${mensagem}".`;

    return NextResponse.json({
      ok: true,
      produtos,
      texto,
    });
  } catch (err) {
    console.error('[api/busca]', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Erro ao buscar produtos.',
      },
      { status: 500 }
    );
  }
}
