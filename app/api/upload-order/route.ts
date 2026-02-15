import { NextRequest, NextResponse } from 'next/server';
import { interpretarListaProdutos } from '@/lib/interpretar-pedido';
import { extrairTextoDeImagem } from '@/lib/vision';
import type { Produto } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Envie um arquivo (documento ou imagem).' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo 10MB.' },
        { status: 400 }
      );
    }
    const type = file.type?.toLowerCase() || '';
    const allowed =
      type === 'text/plain' ||
      type === 'application/pdf' ||
      /^image\/(jpeg|png|webp|gif)$/i.test(type);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Formato não suportado. Use .txt, .pdf ou imagem (jpg, png, webp, gif).' },
        { status: 400 }
      );
    }

    let textoExtraido = '';

    if (type.startsWith('image/')) {
      const buf = Buffer.from(await file.arrayBuffer());
      const base64 = buf.toString('base64');
      textoExtraido = await extrairTextoDeImagem(base64, type);
      if (!textoExtraido) {
        return NextResponse.json(
          { error: 'Não foi possível ler o texto da imagem. Tente uma foto mais nítida.' },
          { status: 422 }
        );
      }
    } else if (type === 'text/plain') {
      textoExtraido = await file.text();
    } else if (type === 'application/pdf') {
      return NextResponse.json(
        { error: 'PDF não está disponível no momento. Envie um arquivo .txt ou uma foto da lista de produtos.' },
        { status: 422 }
      );
    } else {
      return NextResponse.json(
        { error: 'Formato não suportado.' },
        { status: 400 }
      );
    }

    const texto = textoExtraido.trim();
    if (!texto) {
      return NextResponse.json(
        { error: 'O arquivo está vazio ou não contém texto legível.' },
        { status: 422 }
      );
    }

    const resultado = await interpretarListaProdutos(texto);
    const produtosParaResposta: Produto[] = resultado.itens.map((i) => i.produto);

    return NextResponse.json({
      text: resultado.textoResposta,
      produtos: produtosParaResposta.length > 0 ? produtosParaResposta : undefined,
      isLista: resultado.isLista,
    });
  } catch (err) {
    console.error('[upload-order]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar o arquivo.' },
      { status: 500 }
    );
  }
}
