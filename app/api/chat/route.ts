import { NextRequest, NextResponse } from 'next/server';
import { gerarRespostaChat } from '@/lib/groq';
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
    const lastProducts = body.lastProducts as Produto[] | undefined;
    const ultimaMensagemEraOpcoesArquivo = body.ultimaMensagemEraOpcoesArquivo === true;

    if (!message) {
      return NextResponse.json(
        { error: 'Campo message é obrigatório.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { text, produtos, cart: newCart, clearCart, exibirCarrinho: exibirCarrinhoResposta, textoPergunta, carrinhoEmBalaoSeparado } = await gerarRespostaChat(message, history, cart, lastProducts, ultimaMensagemEraOpcoesArquivo);

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
        medidas: p.medidas,
      }));
    }
    if (newCart) response.cart = newCart;
    if (clearCart) response.clearCart = true;
    const ehMostrarPedido = message.trim() === '2' && newCart && newCart.length > 0;
    const soPerguntaProduto = mainText.trim() === 'Qual é o produto que devo procurar?';
    if ((ehMostrarPedido || exibirCarrinhoResposta) && !soPerguntaProduto) response.exibirCarrinho = true;
    if (perguntaText) response.textoPergunta = perguntaText;
    if (carrinhoEmBalaoSeparado) response.carrinhoEmBalaoSeparado = true;

    return NextResponse.json(response, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[api/chat]', err);
    const msg = err instanceof Error ? err.message : '';
    const erroAmigavel =
      !msg ? 'Erro ao processar a mensagem. Tente novamente.' :
      /429|quota|Limite de uso/i.test(msg) ? 'Limite de uso da cota gratuita atingido. Aguarde cerca de 1 minuto e tente novamente.' :
      /API key|invalid.*key|GEMINI|GROQ|403|401/i.test(msg) ? 'Chave da API inválida ou não configurada. Verifique o arquivo .env.local (variável GROQ_API_KEY).' :
      /404|not found/i.test(msg) ? 'Modelo ou recurso não encontrado. Verifique a documentação do Gemini.' :
      msg.length > 120 ? 'Erro ao processar a mensagem. Tente novamente.' : msg;
    const status = /429|quota|Limite de uso/i.test(msg) ? 429 : 500;
    return NextResponse.json(
      { error: erroAmigavel },
      { status, headers: CORS_HEADERS }
    );
  }
}
