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
        { error: 'Tipo de arquivo inválido', code: 'TIPO_INVALIDO' },
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
    const itensArquivo: Array<{
      codigo: string;
      descricao: string;
      unidade: string;
      quantidade: number;
      estoque: number | '';
      precoUnitario: number | null;
      precoTotal: number | null;
    }> = [];
    let total = 0;
    resultado.itens.forEach((item, idx) => {
      const p = item.produto as Produto & { precoUnitario?: number };
      const preco = p.precoUnitario ?? 0;
      const precoTotal = item.quantidade * preco;
      total += precoTotal;
      itensArquivo.push({
        codigo: p.codigo,
        descricao: p.descricao,
        unidade: 'Un',
        quantidade: item.quantidade,
        estoque: p.estoque ?? 0,
        precoUnitario: preco > 0 ? preco : null,
        precoTotal: precoTotal > 0 ? precoTotal : null,
      });
    });
    resultado.naoEncontrados.forEach((n) => {
      itensArquivo.push({
        codigo: n.termo,
        descricao: '',
        unidade: 'Un',
        quantidade: n.quantidade,
        estoque: '',
        precoUnitario: null,
        precoTotal: null,
      });
    });

    return NextResponse.json({
      tipoResposta: 'pedidoArquivo',
      text: '',
      itensArquivo,
      total,
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
