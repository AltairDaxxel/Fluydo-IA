/**
 * Fluydo.AI - Chat com Groq (API OpenAI-compatible).
 * Modelo rápido para conversa.
 */

import path from 'path';
import { config } from 'dotenv';
import type { Produto } from '@/types';
import { buscarNaWeb } from './busca-web';
import { consultarEstoque } from './estoque';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.join(__dirname, '..', '.env.local') });

const SYSTEM_PROMPT_BASE = `Você é o Fluydo. Seu objetivo como agente de IA é vender. Seja cordial e muito direto: respostas curtas.

SAUDAÇÃO OBRIGATÓRIA: Na primeira vez que você responder na conversa (quando ainda não tiver escrito nada como assistente), responda SEMPRE as 3 linhas completas, nesta ordem: linha 1 "Olá." linha 2 "Eu sou Fluydo, agente de IA, e vou te ajudar com o seu pedido." linha 3 "Qual é o seu nome?" Não pule nenhuma linha. Só depois de já ter escrito essas 3 linhas, se o cliente responder com "oi", pergunta ou qualquer coisa que não seja o nome, aí sim responda apenas "Qual é o seu nome?" Não use bom dia, boa tarde nem boa noite. REGRA CRÍTICA—NOME: não prossiga para pedido até o cliente informar o nome (uma ou duas palavras, ex.: João, Maria Silva). Seja persistente. Só depois que ele disser o nome você responde "Olá [nome do cliente], em que posso te ajudar?"

Use "produtos" (nunca "produtos para vedação industrial").

Ao listar ou mostrar produto(s): cada informação do produto em uma linha (Código, depois Descrição, depois Material, Unidade, Estoque, Preço unitário). Não coloque linha em branco entre essas informações—apenas quebre para a linha seguinte. Só pule uma linha em branco quando for mostrar o próximo produto. As dimensões já vêm na descrição; não liste à parte. Se for mais de um, enumere pelo código do produto (ex.: comece cada produto com o código: [CÓDIGO]: Código ... Descrição ...). Pergunte: qual o produto (pelo código) e qual a quantidade. O cliente pode responder junto, ex.: "[código] 10" = aquele produto, 10 unidades. Se responder só o código, pergunte a quantidade. Só diga que não entendeu se o cliente responder algo errado (ex.: produto que não está na lista ou resposta incompreensível); não repita "não entendi" sem motivo. Depois de produto e quantidade informados: mostre o produto com quantidade e preço total e passe para o próximo. Quando o cliente pedir um produto sem informar dimensões: procure o produto (código ou descrição). Se não encontrar nenhum, responda exatamente: "Não encontrei. Ajudo em algo mais?"

Perguntas fora do contexto do pedido: pesquise (use o "Contexto da web" quando for passado), responda de forma educada e, ao final, inclua sempre: "Mas, voltando ao seu pedido. Em que posso te ajudar?"`;

const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface ChatResponse {
  text: string;
  produtos?: Produto[];
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function gerarRespostaChat(
  mensagem: string,
  historico: { role: 'user' | 'model'; parts: { text: string }[] }[]
): Promise<ChatResponse> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    return {
      text: 'Erro: GROQ_API_KEY não configurada. Configure no .env.local.',
    };
  }

  const jaRespondeuNaConversa = historico.some((h) => h.role === 'model');
  if (!jaRespondeuNaConversa) {
    return {
      text: 'Olá.\nEu sou Fluydo, agente de IA, e vou te ajudar com o seu pedido.\nQual é o seu nome?',
    };
  }

  let systemContent = SYSTEM_PROMPT_BASE;
  let produtosRetorno: Produto[] | undefined;

  const parecePerguntaGeral =
    mensagem.includes('?') ||
    /\b(o que|quem|quando|onde|por que|como|qual)\b/i.test(mensagem);
  const ultimaRespostaAssistente = historico
    .filter((h) => h.role === 'model')
    .map((h) => h.parts.map((p) => p.text).join('\n'))
    .pop() || '';
  const assistentePerguntouNome = /qual\s+é\s+o\s+seu\s+nome/i.test(ultimaRespostaAssistente);
  const parecePedidoDeProduto =
    historico.length >= 1 &&
    mensagem.trim().length >= 2 &&
    !mensagem.includes('?') &&
    !assistentePerguntouNome;

  if (parecePedidoDeProduto) {
    const termo = mensagem.trim();
    const [porCodigo, porDescricao] = await Promise.all([
      consultarEstoque({ codigo: termo }),
      consultarEstoque({ descricao: termo }),
    ]);
    const porId = new Map<string, Produto>();
    [...porCodigo, ...porDescricao].forEach((p) => porId.set(p.id, p));
    const produtosEncontrados = Array.from(porId.values());
    if (produtosEncontrados.length === 0) {
      return { text: 'Não encontrei. Ajudo em algo mais?' };
    }
    produtosRetorno = produtosEncontrados;
    const listaProdutos = produtosEncontrados
      .map(
        (p) =>
          `Código: ${p.codigo}\nDescrição: ${p.descricao}\nEstoque: ${p.estoque}\nMedidas: ${(p.medidas || []).map((m) => `${m.tipo_medida} ${m.valor_mm}${m.unidade || 'mm'}`).join(', ')}`
      )
      .join('\n\n');
    systemContent += `\n\nProdutos encontrados na busca (sem dimensões). Formate cada um conforme as regras (uma informação por linha, linha em branco só entre produtos) e pergunte qual o produto (código) e qual a quantidade:\n${listaProdutos}`;
  }

  const precisaBusca =
    mensagem.length > 5 && parecePerguntaGeral;
  if (precisaBusca) {
    const contextoWeb = await buscarNaWeb(mensagem);
    if (contextoWeb) {
      systemContent += `\n\nContexto da web (use para responder com precisão):\n${contextoWeb}`;
    }
  }

  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemContent },
    ...historico.map((h) => ({
      role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: h.parts.map((p) => p.text).join('\n'),
    })),
    { role: 'user', content: mensagem },
  ];

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[${res.status}] ${err}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text =
    data.choices?.[0]?.message?.content?.trim() || 'Desculpe, não consegui processar.';

  return produtosRetorno ? { text, produtos: produtosRetorno } : { text };
}
