/**
 * Fluydo.AI - Chat com Gemini (apenas conversa por enquanto).
 * Usa a API REST direta para evitar 404 do SDK com nomes de modelo.
 */

import path from 'path';
import { config } from 'dotenv';
import type { Produto } from '@/types';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.join(__dirname, '..', '.env.local') });

const SYSTEM_PROMPT = `Você é o Fluydo, um assistente especializado em vedações industriais. Seja educado e prestativo. Pergunte o nome do cliente no início da conversa. Por enquanto você só conversa; ainda não consulta estoque nem busca produtos.`;

const MODELOS_TENTAR = [
  'gemini-1.5-flash-8b',
  'gemini-1.5-flash',
  'gemini-1.0-pro',
  'gemini-pro',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
];

const API_BASES = ['v1beta', 'v1'];

export interface ChatResponse {
  text: string;
  produtos?: Produto[];
}

interface GeminiContentPart {
  role: string;
  parts: { text: string }[];
}

async function chamarGeminiREST(
  apiKey: string,
  contents: GeminiContentPart[],
  model: string,
  apiVersion: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[${res.status}] ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
    'Desculpe, não consegui processar.';

  return text;
}

export async function gerarRespostaChat(
  mensagem: string,
  historico: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<ChatResponse> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return {
      text: 'Erro: GEMINI_API_KEY não configurada. Configure no .env.local.',
    };
  }

  const contents: GeminiContentPart[] = [
    { role: 'user', parts: [{ text: `[Instrução do sistema: ${SYSTEM_PROMPT}]` }] },
    { role: 'model', parts: [{ text: 'Entendido. Sou o Fluydo e seguirei essas orientações.' }] },
    ...historico.map((h) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: h.parts,
    })),
    { role: 'user', parts: [{ text: mensagem }] },
  ];

  let lastError: Error | null = null;
  let isQuotaExceeded = false;
  for (const apiVersion of API_BASES) {
    for (const model of MODELOS_TENTAR) {
      try {
        const text = await chamarGeminiREST(apiKey, contents, model, apiVersion);
        return { text };
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        const msg = String(lastError.message);
        if (msg.includes('404') || msg.includes('not found')) continue;
        if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
          isQuotaExceeded = true;
          continue;
        }
        throw lastError;
      }
    }
  }

  if (isQuotaExceeded) {
    throw new Error(
      'Limite de uso da cota gratuita do Gemini foi atingido. Aguarde cerca de 1 minuto e tente novamente. Ou confira seu uso em https://ai.google.dev/gemini-api/docs/rate-limits'
    );
  }

  throw new Error(
    'Nenhum modelo Gemini disponível para sua chave. Tente outra chave em https://aistudio.google.com/apikey ou verifique a região. Detalhe: ' +
      (lastError?.message ?? '')
  );
}
