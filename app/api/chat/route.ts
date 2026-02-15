import { NextRequest, NextResponse } from 'next/server';
import { gerarRespostaChat } from '@/lib/groq';

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

    if (!message) {
      return NextResponse.json(
        { error: 'Campo message é obrigatório.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { text, produtos } = await gerarRespostaChat(message, history);

    const response: ChatResponseBody = { text };
    if (produtos && produtos.length > 0) {
      response.produtos = produtos.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        descricao: p.descricao,
        estoque: p.estoque,
        medidas: p.medidas,
      }));
    }

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
