import { NextRequest, NextResponse } from 'next/server';
import { gerarRespostaChat } from '@/lib/groq';
import { hasDatabase } from '@/lib/prisma';
import { enrichCartWithProducts } from '@/lib/enrich-cart';
import type { ItemCarrinho, Produto } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export interface ChatRequestBody {
  message: string;
  history?: { role: 'user' | 'model'; parts: { text: string }[] }[];
  cart?: ItemCarrinho[];
  /** ID do emitente da sessão (obrigatório para consultas com Prisma; isolamento por ID_Emitente) */
  idEmitente?: string;
  /** Última lista de produtos exibida (para resolver "1 15" ao escolher item e quantidade) */
  lastProducts?: Array<{ id: string; codigo: string; descricao: string; estoque: number; medidas?: { tipo_medida: string; valor_mm: number; unidade?: string }[]; precoUnitario?: number }>;
  /** Última mensagem do modelo foi as opções do pedido por arquivo (1 Salvar, 2 Alterar, 3 Excluir) */
  ultimaMensagemEraOpcoesArquivo?: boolean;
}

export interface ChatResponseBody {
  text: string;
  produtos?: Array<{
    id: string;
    codigo: string;
    descricao: string;
    estoque: number;
    unidade?: string | null;
    material?: string | null;
    precoUnitario?: number | null;
    ipi?: number | null;
    dim1?: number | null;
    dim2?: number | null;
    dim3?: number | null;
    dim4?: number | null;
    medidas: { tipo_medida: string; valor_mm: number; unidade?: string }[];
  }>;
  cart?: ItemCarrinho[];
  clearCart?: boolean;
  /** Quando true, o frontend exibe o carrinho em tabela (mostrar pedido) com coluna Preço Total */
  exibirCarrinho?: boolean;
  /** Pergunta em balão separado (nunca no mesmo balão da lista/pedido) */
  textoPergunta?: string;
  /** Quando true, frontend exibe o texto em um balão e o carrinho em outro balão separado */
  carrinhoEmBalaoSeparado?: boolean;
  /** Comando "baixar pdf": frontend gera PDF da última tabela de resultados */
  downloadPdf?: boolean;
  /** Artigo de ajuda (FluydoAjuda + exemplos) para renderizar Markdown */
  artigoAjuda?: {
    id: number;
    slug: string;
    titulo: string;
    resumo?: string | null;
    conteudoMd: string;
    exemplos: Array<{ id: number; exemplo: string; observacao?: string | null }>;
  };
  /** Lista de artigos (menu ou sugestões) */
  artigosAjuda?: Array<{ id: number; slug: string; titulo: string }>;
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const rawMessage = body.message;
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    const history = body.history ?? [];
    const cart = body.cart ?? [];
    const idEmitente = typeof body.idEmitente === 'string' ? body.idEmitente.trim() : '';
    const lastProducts = body.lastProducts as Produto[] | undefined;
    const ultimaMensagemEraOpcoesArquivo = body.ultimaMensagemEraOpcoesArquivo === true;

    if (!message) {
      return NextResponse.json(
        { error: 'Campo message é obrigatório.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const out = await gerarRespostaChat(message, history, cart, lastProducts, ultimaMensagemEraOpcoesArquivo, idEmitente);
    const text = typeof out?.text === 'string' ? out.text : 'Desculpe, não consegui processar.';
    const produtos = out?.produtos;
    const newCart = out?.cart;
    const clearCart = out?.clearCart;
    const exibirCarrinhoResposta = out?.exibirCarrinho;
    const textoPergunta = out?.textoPergunta;
    const carrinhoEmBalaoSeparado = out?.carrinhoEmBalaoSeparado;

    let mainText = text;
    let perguntaText = textoPergunta;
    if (produtos && produtos.length > 0 && text && !perguntaText) {
      const idx = text.search(/\n\s*1\s*-\s*/);
      if (idx >= 0) {
        perguntaText = text.slice(idx).trim();
        mainText = text.slice(0, idx).trim();
      }
    }

    const response: ChatResponseBody = { text: mainText };
    if (produtos && produtos.length > 0) {
      response.produtos = produtos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        descricao: p.descricao,
        estoque: p.estoque,
        unidade: (p as { unidade?: string | null }).unidade ?? null,
        material: (p as { material?: string | null }).material ?? null,
        precoUnitario: (p as { precoUnitario?: number | null }).precoUnitario ?? null,
        ipi: (p as { ipi?: number | null }).ipi ?? null,
        dim1: (p as { dim1?: number | null }).dim1 ?? null,
        dim2: (p as { dim2?: number | null }).dim2 ?? null,
        dim3: (p as { dim3?: number | null }).dim3 ?? null,
        dim4: (p as { dim4?: number | null }).dim4 ?? null,
        medidas: p.medidas,
      }));
    }
    let cartToSend = newCart;
    if (exibirCarrinhoResposta && newCart && newCart.length > 0 && idEmitente && hasDatabase()) {
      cartToSend = await enrichCartWithProducts(newCart, idEmitente);
    }
    if (cartToSend) response.cart = cartToSend;
    if (clearCart) response.clearCart = true;
    const soPerguntaProduto = mainText.trim() === 'Qual é o produto que devo procurar?';
    if (exibirCarrinhoResposta && !soPerguntaProduto) response.exibirCarrinho = true;
    if (perguntaText) response.textoPergunta = perguntaText;
    if (carrinhoEmBalaoSeparado) response.carrinhoEmBalaoSeparado = true;
    if (out?.downloadPdf) response.downloadPdf = true;
    if (out?.artigoAjuda) response.artigoAjuda = out.artigoAjuda;
    if (out?.artigosAjuda && out.artigosAjuda.length > 0) {
      response.artigosAjuda = out.artigosAjuda.map((a) => ({ id: a.id, slug: a.slug, titulo: a.titulo }));
    }

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[api/chat]', err);
    const msg = err instanceof Error ? err.message : '';
    const erroAmigavel =
      !msg ? 'Erro ao processar a mensagem. Tente novamente.' :
      /402|Insufficient Balance|saldo insuficiente/i.test(msg) ? 'Saldo insuficiente. Adicione créditos na sua conta OpenRouter (openrouter.ai) para continuar.' :
      /429|quota|Limite de uso/i.test(msg) ? 'Limite de uso atingido. Aguarde cerca de 1 minuto e tente novamente.' :
      /API key|invalid.*key|OPENROUTER|403|401/i.test(msg) ? 'Chave da API inválida ou não configurada. Verifique o .env.local (OPENROUTER_API_KEY).' :
      /404|not found/i.test(msg) ? 'Modelo não encontrado. Verifique OPENROUTER_MODEL no .env.local ou use o padrão.' :
      msg.length > 120 ? 'Erro ao processar a mensagem. Tente novamente.' : msg;
    const status = /402|Insufficient Balance/i.test(msg) ? 402 : /429|quota|Limite de uso/i.test(msg) ? 429 : 500;
    return NextResponse.json(
      { error: erroAmigavel },
      { status, headers: CORS_HEADERS }
    );
  }
}
