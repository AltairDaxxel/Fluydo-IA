/**
 * Fluydo.IA - Diagnóstico: verifica conexão com o banco e produtos por emitente.
 * Uso: GET /api/debug-busca?telefone=11941701005
 */

import { NextRequest, NextResponse } from 'next/server';
import { getEmitenteByTelefone } from '@/lib/emitente';
import { prisma } from '@/lib/prisma';
import { hasDatabase } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === 'number') return d;
  if (typeof d === 'object' && d !== null && 'toNumber' in d) return (d as { toNumber: () => number }).toNumber();
  return Number(d);
}

export async function GET(request: NextRequest) {
  const telefone = request.nextUrl.searchParams.get('telefone') ?? '';
  if (!telefone.trim()) {
    return NextResponse.json(
      { error: 'Passe ?telefone=11941701005' },
      { status: 400 }
    );
  }

  if (!hasDatabase()) {
    return NextResponse.json({
      ok: false,
      erro: 'DATABASE_URL não configurada',
      telefone: telefone.trim(),
    });
  }

  const emitente = await getEmitenteByTelefone(telefone);
  if (!emitente) {
    return NextResponse.json({
      ok: false,
      erro: 'Telefone não encontrado na tabela Emitentes',
      telefone: telefone.trim(),
    });
  }

  const idEmit = emitente.id;

  try {
    const [totalQualquer, comEstoque, amostra] = await Promise.all([
      prisma.produto.count({ where: { idEmitente: idEmit } }),
      prisma.produto.count({
        where: {
          idEmitente: idEmit,
          ativo: 1,
          estoque: { gt: 0 },
        },
      }),
      prisma.produto.findMany({
        where: { idEmitente: idEmit },
        take: 5,
        select: { id: true, codigo: true, descricao: true, ativo: true, estoque: true },
      }),
    ]);

    const amostraFormatada = amostra.map((p) => ({
      id: p.id,
      codigo: p.codigo,
      descricao: p.descricao,
      ativo: p.ativo,
      estoque: toNum(p.estoque),
    }));

    return NextResponse.json({
      ok: true,
      telefone: telefone.trim(),
      idEmitente: idEmit,
      totalProdutosParaEsteEmitente: totalQualquer,
      totalComAtivo1eEstoqueMaiorQueZero: comEstoque,
      amostraPrimeiros5: amostraFormatada,
      dica: totalQualquer === 0
        ? 'Nenhum produto com id_emitente = "' + idEmit + '". Confira na tabela Produto se id_emitente bate com o id da tabela Emitentes.'
        : comEstoque === 0
          ? 'Há produtos, mas nenhum com Ativo=1 e Estoque>0. Ajuste Ativo e Estoque na tabela Produto.'
          : 'Conexão e emitente OK. Se a busca no chat não retorna nada, o termo pode não estar na descrição ou nas dimensões.',
    });
  } catch (err) {
    console.error('[debug-busca] Erro:', err);
    return NextResponse.json({
      ok: false,
      erro: err instanceof Error ? err.message : String(err),
      idEmitente: idEmit,
    }, { status: 500 });
  }
}
