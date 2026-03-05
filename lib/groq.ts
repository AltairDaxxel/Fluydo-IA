/**
 * Fluydo.AI - Chat via OpenRouter (API OpenAI-compatible).
 * Modelo configurável via OPENROUTER_MODEL (ex.: meta-llama/llama-3.1-8b-instruct).
 */

import path from 'path';
import { config } from 'dotenv';
import type { Produto, ItemCarrinho } from '@/types';
import { buscarNaWeb } from './busca-web';
import { consultarEstoque } from './estoque';
import { buscarClientePorCpfCnpj, listarCondicoesPagamento } from './clientes';
import { hasDatabase } from './prisma';
import { buscarProdutosPrisma, buscarProdutosPorCodigo, mapBuscaToChatProduto, parseLabels } from './busca-prisma';
import { findLinhaMatch, isLinhaBloqueadaOuExclusiva, searchProductsByLinha, extractLinhaCandidates } from './linhas';
import { getConfig, CONFIG_KEYS } from './configuracoes';
import { listarPagamentos, formatarOpcoesPagamentos } from './pagamentos';
import { buscarEnderecoPorCep, formatarEnderecoParaChat } from './cep';
import { intelligentSearchEngine } from './search/intelligentSearchEngine';
import { buildClarifyingQuestion } from './search/messagePolicy';
import { getVocabularySearchTerms } from './search/productVocabulary';
import { parseMeasures, parseMaterialDureza } from './search/measureParser';
import { checkSocialTrigger } from './search/socialTriggers';
import { getHelpBySlug, getHelpSuggestions, listHelpArticles, isExplicitHelpRequest } from './help/fluydoAjuda';
import type { AjudaArtigo, AjudaArtigoComExemplos } from './help/types';
import { executarMotorBusca } from './motor-busca';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.join(__dirname, '..', '.env.local') });

const SYSTEM_PROMPT_BASE = `Você é o Fluydo. Seu objetivo como agente de IA é vender. Todas as mensagens do cliente devem ser interpretadas por você e você deve sempre responder: entenda o que ele quer, o contexto e a intenção, e dê uma resposta humanizada—natural, cordial e próxima, como um atendente real. Evite respostas robóticas; adapte o tom à situação. Seja direto mas caloroso.

SAUDAÇÃO: Na primeira resposta use: "Olá, eu sou o Fluydo, assistente virtual de IA." Em outro balão: "Você pode pesquisar por código, descrição ou medidas. Use 'medida' ou 'com medida' + números para filtrar por dimensão (ex.: retentor medida 130). Use 'linha' + letras para filtrar por início do código. Para perguntas gerais, termine com ?" Em outro balão: "Qual é o produto que devo procurar?" Não use bom dia, boa tarde nem boa noite. Nunca pergunte o nome do cliente; exclua todas as situações que pedem o nome.

Use "produtos" (nunca "produtos para vedação industrial").

INTERPRETAÇÃO HUMANA DE PEDIDOS: As pessoas pedem produtos de muitas formas diferentes. Você deve entender a INTENÇÃO, não apenas as palavras exatas. Considere:
- formas técnicas completas (ex.: "oring 28 x 3,53", "retentor 110 x 130 x 13")
- formas técnicas com material (ex.: "oring 28 x 3,53 nbr", "oring 28x3,53 viton", "anel nbr 46 x 2")
- só medidas (ex.: "28 x 3,53", "110x130x13", "20 x 4")
- uma única medida com tipo (ex.: "oring 28", "retentor 110", "anel 46", "tem oring 28?")
- pedidos com aplicação (ex.: "oring para eixo 28", "retentor para eixo 110", "vedação para pistão 30")
- pedidos informais (ex.: "preciso de um oring", "to procurando um anel 46", "tem vedação 20 x 4?")
- erros de escrita e formatação (ex.: "oring 28x353", "oring 28 por 3,53", "o ring 28 3,53")
- descrições e contexto de máquina (ex.: "vedação para eixo 28", "oring para bomba hidráulica", "retentor para eixo de trator")
- pedidos genéricos ou incompletos (ex.: "preciso de vedação", "preciso de um", "tem isso aí?")
- pedidos com vários itens de uma vez, inclusive em estilo WhatsApp.

REGRAS PARA ESSA INTERPRETAÇÃO:
1) Nunca assuma medidas erradas. Se faltar medida importante, pergunte (uma pergunta por vez).
2) Sempre que possível, normalize números (ponto/vírgula, "28x3,53", "28 x 3.53", "28x353") e tente buscar antes de pedir esclarecimento.
3) Use material, aplicação e contexto (eixo, pistão, bomba, trator etc.) como filtros adicionais quando fizer sentido.
4) Quando o cliente fala só de "vedação", "oring", "retentor", "anel" sem medidas, explique gentilmente que precisa das medidas e dê exemplos (ex.: "Normalmente vem como 28 x 3,53").
5) Se o cliente mandar vários itens, trate cada linha como um possível produto.

LISTA DE PRODUTOS ENCONTRADOS: o sistema já exibe os produtos em uma tabela com checkbox na primeira coluna. NÃO liste os produtos no seu texto. Quando houver resultados, use um texto curto e natural, por exemplo:
- "Encontrei algumas opções que combinam com o que você descreveu. Informe as quantidades dos produtos desejados, e ao final digite 'pedir' para adicionar os produtos ao pedido."
- "Achei X produtos. Informe as quantidades dos produtos desejados, e ao final digite 'pedir' para adicionar os produtos ao pedido."

NÃO ofereça mais o menu "1 - Incluir produto no pedido / 2 - Procurar por outro produto". Em vez disso, confie na intuição do cliente: ele pode digitar coisas como "incluir no pedido", "colocar no pedido", "adicionar ao pedido", "ver pedido", "buscar produto" e você deve se adaptar a isso.

PERGUNTAS FORA DO CONTEXTO DO PEDIDO (mensagem com ? no final): pesquise (use o "Contexto da web" quando for passado), responda de forma educada e, ao final, inclua APENAS: "Mas, voltando ao seu pedido. Qual é o produto que devo procurar?" NUNCA escreva menus numéricos depois dessa frase.

CARRINHO E PEDIDO: Memorize os pedidos do cliente (produto e quantidade confirmados). Ao mostrar o pedido, você pode oferecer opções, mas não é obrigatório usar apenas números. Frases como "Você pode digitar 'ver pedido' para conferir, 'buscar produto' para pesquisar outro ou 'finalizar pedido' para concluir." são bem-vindas. Quando o cliente pedir para FECHAR O PEDIDO: mostre todo o carrinho, pergunte se está correto e se deseja alterar, incluir ou excluir algum produto. Se o cliente CONFIRMAR que está correto: peça o CPF ou CNPJ. Quando o cliente informar CPF ou CNPJ, os dados de entrega e as condições de pagamento serão fornecidos a você—mostre os dados de entrega, liste as opções de pagamento, e ao final conclua o pedido, agradeça o cliente e fique pronto para iniciar outro pedido.`;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL_DEFAULT = 'meta-llama/llama-3.1-8b-instruct';

export interface ChatResponse {
  text: string;
  produtos?: Produto[];
  cart?: ItemCarrinho[];
  clearCart?: boolean;
  exibirCarrinho?: boolean;
  /** Pergunta em balão separado (nunca no mesmo balão da lista/pedido) */
  textoPergunta?: string;
  /** Quando true, frontend exibe o texto em um balão e o carrinho em outro balão separado */
  carrinhoEmBalaoSeparado?: boolean;
  /** Comando "baixar pdf": frontend gera PDF da última tabela de resultados */
  downloadPdf?: boolean;
  /** Artigo de ajuda completo (FluydoAjuda + exemplos) para renderizar Markdown */
  artigoAjuda?: AjudaArtigoComExemplos;
  /** Lista de artigos (menu ou sugestões) */
  artigosAjuda?: AjudaArtigo[];
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const CART_ADD_REGEX = /CART_ADD:([^|\n]+)\|(\d+)/gi;
const CPF_CNPJ_REGEX = /\b\d{11,14}\b/;
/** Frase colocada em balão separado após resposta a pergunta com ? */
const FRASE_VOLTANDO_PEDIDO = 'Mas, voltando ao seu pedido. Qual é o produto que devo procurar?';
const FRASE_VOLTANDO_PEDIDO_REGEX = /Mas,?\s*voltando ao seu pedido\.?\s*Qual é o produto que devo procurar\??/i;

/** Mensagem de orientação (início ou após excluir/voltar), sem menu numérico */
const TEXTO_INICIAL_CONVERSA =
  "Ainda não sabe como pesquisar? Digite ajuda ou ? para ver as dicas.\n\nComo posso te ajudar agora?";

/** Palavras de ruído para ignorar ao extrair candidato a código (ex.: "quero o código VD-001" → VD-001) */
const RUIDO_CODIGO = new Set([
  'de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'por', 'um', 'uma', 'o', 'a', 'os', 'as', 'no', 'na', 'nos', 'nas',
  'com', 'em', 'e', 'ou', 'que', 'tem', 'quero', 'preciso', 'precisamos', 'necessito', 'gostaria', 'queria', 'achar', 'buscar', 'busca', 'encontrar', 'pedir', 'pedido',
  'codigo', 'código', 'produto', 'numero', 'número', 'item', 'ref', 'referencia', 'referência', 'nº', 'nr', 'cód',
]);

/** Padrão de código de produto: alfanumérico com opcional . - _ (ex.: VD-001, CEN.01.12, AGR.8013.103) */
const PADRAO_CODIGO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Elimina ruído e identifica um candidato a código na mensagem.
 * Retorna o termo que parece código para primeira pesquisa em Produtos.Codigo, ou null.
 */
function extractCodigoCandidato(mensagem: string): string | null {
  const t = (mensagem || '').trim();
  if (!t || t.length < 2) return null;
  const tokens = t.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean);
  const candidatos = tokens.filter(
    (s) => s.length >= 2 && PADRAO_CODIGO.test(s) && !RUIDO_CODIGO.has(s.toLowerCase())
  );
  if (candidatos.length === 0) return null;
  if (candidatos.length === 1) return candidatos[0];
  const comSeparador = candidatos.filter((s) => /[._-]/.test(s));
  if (comSeparador.length > 0) return comSeparador.sort((a, b) => b.length - a.length)[0];
  return candidatos.sort((a, b) => b.length - a.length)[0];
}

export async function gerarRespostaChat(
  mensagem: string,
  historico: { role: 'user' | 'model'; parts: { text: string }[] }[],
  cart: ItemCarrinho[] = [],
  lastProducts?: Produto[],
  ultimaMensagemEraOpcoesArquivo?: boolean,
  idEmitente: string = ''
): Promise<ChatResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return {
      text: 'Erro: OPENROUTER_API_KEY não configurada. Configure no .env.local.',
    };
  }
  const model = process.env.OPENROUTER_MODEL?.trim() || OPENROUTER_MODEL_DEFAULT;

  const jaRespondeuNaConversa = historico.some((h) => h.role === 'model');
  if (!jaRespondeuNaConversa) {
    return {
      text: 'Olá, eu sou o Fluydo, assistente virtual de vendas.',
      textoPergunta: TEXTO_INICIAL_CONVERSA,
    };
  }

  const msgTrimInicio = mensagem.trim();
  const ultimaRespostaAssistenteInicio = historico
    .filter((h) => h.role === 'model')
    .map((h) => h.parts.map((p) => p.text).join('\n'))
    .pop() || '';

  // Frases reservadas: executadas a qualquer momento, sem validar contexto
  const voltarAoMenu = /voltar\s*ao\s*menu|^menu$|^voltar$/i.test(msgTrimInicio);
  if (voltarAoMenu) {
    return {
      text: TEXTO_INICIAL_CONVERSA,
      cart: cart.length > 0 ? cart : undefined,
    };
  }

  const verPedido = /^ver\s*pedido$|^pedido$|^ver$/i.test(msgTrimInicio);
  if (verPedido) {
    if (cart.length === 0) {
      return { text: 'Não há pedido pendente.', cart };
    }
    return {
      text: 'Segue seu pedido:',
      cart,
      exibirCarrinho: true,
    };
  }

  const finalizarPedido = /^finalizar(\s*pedido)?$/i.test(msgTrimInicio);
  if (finalizarPedido) {
    if (cart.length === 0) {
      return { text: 'Não há pedido pendente.', textoPergunta: TEXTO_INICIAL_CONVERSA, cart };
    }
    return {
      text: 'Segue seu pedido para conferência:',
      cart,
      exibirCarrinho: true,
      textoPergunta:
        'Está correto? Se quiser mudar algo, digite "alterar pedido". Se estiver tudo certo, digite "finalizar pedido" e informe o CPF ou CNPJ.',
    };
  }

  const fecharPedido = /^fechar(\s*pedido)?$/i.test(msgTrimInicio);
  if (fecharPedido) {
    if (cart.length === 0) {
      return { text: 'Não há itens no pedido. Deseja procurar produtos?', textoPergunta: TEXTO_INICIAL_CONVERSA, cart };
    }
    return {
      text: 'Segue seu pedido para conferência:',
      cart,
      exibirCarrinho: true,
      textoPergunta:
        'Está correto? Se quiser mudar algo, digite "alterar pedido". Se estiver tudo certo, digite "finalizar pedido" e informe o CPF ou CNPJ.',
    };
  }

  const excluirPedido = /^excluir(\s*pedido)?$/i.test(msgTrimInicio);
  if (excluirPedido) {
    if (cart.length === 0) {
      return { text: 'Não há pedido pendente.', cart };
    }
    return {
      text: 'Excluir o pedido completo?',
      textoPergunta: 'Responda "sim" para excluir tudo ou "não" para manter o pedido.',
      cart,
    };
  }

  const baixarPdf = /^baixar\s*pdf$|^pdf$/i.test(msgTrimInicio);
  if (baixarPdf) {
    return {
      text: 'Gerando o PDF da última tabela de resultados.',
      downloadPdf: true,
      cart: cart.length > 0 ? cart : undefined,
    };
  }

  // Pedido explícito de ajuda: usa tabelas FluydoAjuda / FluydoAjudaGatilhos
  if (msgTrimInicio === '?' || isExplicitHelpRequest(mensagem)) {
    if (hasDatabase()) {
      try {
        const sugestoes = await getHelpSuggestions(mensagem);
        if (sugestoes.length > 0) {
          const top = sugestoes[0];
          const artigo = await getHelpBySlug(top.slug);
          if (artigo) {
            return {
              text: artigo.titulo,
              artigoAjuda: artigo,
              artigosAjuda: sugestoes,
              cart: cart.length > 0 ? cart : undefined,
            };
          }
        }
        const artigos = await listHelpArticles();
        if (artigos.length > 0) {
          const lista = artigos.map((a) => `• ${a.titulo} (slug: ${a.slug})`).join('\n');
          return {
            text: 'Tópicos de ajuda disponíveis:',
            textoPergunta: `${lista}\n\nDigite o slug do tópico que deseja ver (ex.: ${artigos[0]?.slug ?? 'ajuda'}).`,
            artigosAjuda: artigos,
            cart: cart.length > 0 ? cart : undefined,
          };
        }
      } catch (err) {
        console.warn('[groq] Erro ao buscar ajuda:', err);
      }
    }
    const msgAjuda = await getConfig(CONFIG_KEYS.MSG_COMANDO_AJUDA);
    return {
      text: msgAjuda ?? 'Ainda não há artigos de ajuda cadastrados. Digite o produto ou código que deseja pesquisar.',
      cart: cart.length > 0 ? cart : undefined,
    };
  }

  // Pedido de artigo por slug (ex.: "ajuda:buscar" ou "ver ajuda buscar")
  const slugMatch = msgTrimInicio.match(/^(?:ajuda\s*:?\s*|ver\s+ajuda\s+)(\w[\w-]*)$/i);
  if (slugMatch && hasDatabase()) {
    try {
      const artigo = await getHelpBySlug(slugMatch[1].trim());
      if (artigo) {
        return {
          text: artigo.titulo,
          artigoAjuda: artigo,
          cart: cart.length > 0 ? cart : undefined,
        };
      }
    } catch (err) {
      console.warn('[groq] Erro ao buscar artigo por slug:', err);
    }
  }

  // A qualquer momento: mensagem terminada em ? → pesquisa (busca web + LLM), sem validar o que estava aguardando
  if (msgTrimInicio.endsWith('?')) {
    let systemContentPergunta = SYSTEM_PROMPT_BASE;
    const cartAtualPergunta = [...cart];
    const carrinhoJsonPergunta = JSON.stringify(cartAtualPergunta, null, 0);
    systemContentPergunta += `\n\nCarrinho atual do cliente: ${carrinhoJsonPergunta}.`;
    systemContentPergunta += `\n\nIMPORTANTE: O cliente fez uma pergunta (frase terminada em ?). Pesquise na web e use o contexto abaixo para dar a melhor resposta possível. Responda somente à pergunta e termine com "Mas, voltando ao seu pedido. Qual é o produto que devo procurar?" NÃO escreva "Produtos encontrados.", NÃO inclua as opções "1 - Incluir produto no pedido" ou "2 - Procurar por outro produto".`;
    const contextoWebPergunta = await buscarNaWeb(mensagem);
    if (contextoWebPergunta) {
      systemContentPergunta += `\n\nContexto da web (use para responder com precisão):\n${contextoWebPergunta}`;
    }
    const messagesPergunta: OpenAIMessage[] = [
      { role: 'system', content: systemContentPergunta },
      ...historico.map((h) => ({
        role: (h.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: h.parts.map((p) => p.text).join('\n'),
      })),
      { role: 'user', content: mensagem },
    ];
    const resPergunta = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: messagesPergunta,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });
    if (!resPergunta.ok) {
      const err = await resPergunta.text();
      throw new Error(`[${resPergunta.status}] ${err}`);
    }
    const dataPergunta = (await resPergunta.json()) as { choices?: Array<{ message?: { content?: string } }> };
    let textResposta = dataPergunta.choices?.[0]?.message?.content?.trim() || 'Desculpe, não consegui processar.';
    textResposta = textResposta.replace(/\n?CART_ADD:[^\n]+/g, '').replace(/\n\n\n+/g, '\n\n').trim();
    let mainTextPergunta = textResposta;
    let textoPerguntaBalao: string | undefined;
    const matchVoltando = textResposta.match(FRASE_VOLTANDO_PEDIDO_REGEX);
    if (matchVoltando && matchVoltando.index !== undefined) {
      mainTextPergunta = textResposta.slice(0, matchVoltando.index).replace(/\n+\s*$/, '').trim();
      textoPerguntaBalao = FRASE_VOLTANDO_PEDIDO;
    }
    return {
      text: mainTextPergunta,
      ...(textoPerguntaBalao ? { textoPergunta: textoPerguntaBalao } : {}),
      cart: cartAtualPergunta.length > 0 ? cartAtualPergunta : undefined,
    };
  }

  const ehMenuPrincipal =
    /1\s*-\s*Procurar por produtos/i.test(ultimaRespostaAssistenteInicio) &&
    /2\s*-\s*Enviar um arquivo com pedido/i.test(ultimaRespostaAssistenteInicio);
  if (ehMenuPrincipal && msgTrimInicio === '1') {
    return {
      text: 'Você pode pesquisar por código, descrição ou medidas. Use "medida" ou "com medida" seguido dos números para filtrar só por dimensões (ex.: retentor medida 130). Use "linha" + letras para filtrar por início do código (ex.: linha VD). Para perguntas gerais, termine com ?',
      textoPergunta: 'Qual é o produto que devo procurar?',
      cart: cart.length > 0 ? cart : undefined,
    };
  }
  if (ehMenuPrincipal && msgTrimInicio === '2') {
    if (cart.length > 0) {
      return {
        text: 'Existe um pedido pendente sem finalização',
        cart,
        exibirCarrinho: true,
        carrinhoEmBalaoSeparado: true,
        textoPergunta: '1 - Finalizar\n2 - Excluir',
      };
    }
    return {
      text: 'Use o botão para enviar o arquivo.',
      textoPergunta: 'As opções de arquivo aceitas são: txt, pdf, ou foto',
      cart,
    };
  }

  const ehContextoEnviarArquivo =
    /use o botão para enviar o arquivo/i.test(ultimaRespostaAssistenteInicio) ||
    /opções de arquivo aceitas/i.test(ultimaRespostaAssistenteInicio);
  if (ehContextoEnviarArquivo && !msgTrimInicio.match(/^(1|2)$/)) {
    return {
      text: 'Use o botão para enviar o arquivo.',
      textoPergunta: 'As opções de arquivo aceitas são: txt, pdf, ou foto',
      cart: cart.length > 0 ? cart : undefined,
    };
  }

  if (ultimaMensagemEraOpcoesArquivo && msgTrimInicio === '2') {
    return {
      text: 'Indique o produto e a quantidade (ex: 1 15)',
      cart: cart.length > 0 ? cart : undefined,
    };
  }
  if (ultimaMensagemEraOpcoesArquivo && msgTrimInicio === '3') {
    return {
      text: 'Indique o produto (ex: 1)',
      cart: cart.length > 0 ? cart : undefined,
    };
  }

  let systemContent = SYSTEM_PROMPT_BASE;
  let produtosRetorno: Produto[] | undefined;
  let cartAtual = [...cart];
  let clearCart = false;

  const carrinhoJson = JSON.stringify(cartAtual, null, 0);
  systemContent += `\n\nCarrinho atual do cliente (liste quando perguntarem o que está comprando ou ao fechar pedido): ${carrinhoJson}. Quando o cliente confirmar um produto e quantidade (ex.: após você listar e ele responder com código e quantidade), adicione ao carrinho colocando no final da sua resposta exatamente uma linha: CART_ADD:CODIGO|QUANTIDADE (ex.: CART_ADD:VD-001|10). Use o código do produto.`;

  const cpfCnpjMatch = mensagem.trim().match(CPF_CNPJ_REGEX);
  if (cpfCnpjMatch && cartAtual.length > 0) {
    const cpfCnpj = cpfCnpjMatch[0];
    const cliente = await buscarClientePorCpfCnpj(cpfCnpj);
    const condicoes = await listarCondicoesPagamento();
    if (cliente) {
      systemContent += `\n\nDados do cliente para entrega (mostre ao cliente): Nome: ${cliente.nome}. Endereço: ${cliente.endereco}, ${cliente.cidade}/${cliente.uf}${cliente.cep ? ', CEP ' + cliente.cep : ''}. ${cliente.telefone ? 'Tel: ' + cliente.telefone : ''}`;
      systemContent += `\n\nCondições de pagamento disponíveis (liste e deixe o cliente escolher): ${condicoes.map((c) => c.descricao).join('; ')}. Após o cliente escolher ou confirmar, conclua o pedido, agradeça e diga que está pronto para um novo pedido.`;
      clearCart = true;
    } else {
      systemContent += `\n\nCPF/CNPJ informado não encontrado na base de clientes. Peça para o cliente verificar o número ou cadastrar.`;
    }
  }

  const parecePerguntaGeral =
    mensagem.includes('?') ||
    /\b(o que|quem|quando|onde|por que|como|qual)\b/i.test(mensagem);
  const modelMessages = historico
    .filter((h) => h.role === 'model')
    .map((h) => h.parts.map((p) => p.text).join('\n'));
  const ultimaRespostaAssistente = modelMessages[modelMessages.length - 1] || '';
  const penultimaRespostaAssistente = modelMessages.length >= 2 ? modelMessages[modelMessages.length - 2] : '';
  /** Últimas respostas do modelo (para quando o carrinho está em balão separado e há mensagem vazia no meio) */
  const ultimasRespostasModelo = modelMessages.slice(-4);
  const algumaRespostaTemDesejaExcluir = ultimasRespostasModelo.some((t) => /deseja excluir o pedido completo\?/i.test(t));
  const algumaRespostaTemExcluirCompleto = ultimasRespostasModelo.some((t) => /excluir o pedido completo\?/i.test(t));
  const parecePedidoDeProduto =
    historico.length >= 1 &&
    mensagem.trim().length >= 1 &&
    !mensagem.includes('?');

  const msgTrim = mensagem.trim();
  const textoInsuficiente = (qtdSolic: number, estoque: number) =>
    `O estoque é insuficiente para a quantidade solicitada (solicitado: ${qtdSolic}, em estoque: ${estoque}).\n\n1 - Manter a quantidade\n2 - Alterar a quantidade`;
  const opcoesInsuficiente = /estoque é insuficiente|1\s*-\s*Manter a quantidade|2\s*-\s*Alterar a quantidade/i;
  const ultimaPerguntaQtd = /qual é a quantidade\?/i.test(ultimaRespostaAssistente);

  function obterUltimoItemQtdDoHistorico(): { itemNum: number; qtd: number } | null {
    for (let i = historico.length - 1; i >= 0; i--) {
      if (historico[i].role !== 'user') continue;
      const text = historico[i].parts.map((p) => p.text).join(' ').trim();
      const m = text.match(/^(\d+)\s+(\d+)$/);
      if (m) return { itemNum: parseInt(m[1], 10), qtd: parseInt(m[2], 10) };
    }
    return null;
  }

  function adicionarAoCarrinhoEResponder(itemNum: number, qtd: number) {
    const produto = lastProducts![itemNum - 1];
    if (!produto) return null;
    const preco = (produto as { precoUnitario?: number }).precoUnitario;
    cartAtual.push({
      codigo: produto.codigo,
      descricao: produto.descricao,
      quantidade: qtd,
      precoUnitario: preco,
    });
    return {
      text: 'Segue seu pedido:',
      cart: cartAtual,
      exibirCarrinho: true,
      textoPergunta:
        'Você pode digitar "alterar pedido" para mudar algum item, "incluir outro item" para adicionar mais produtos, "buscar produto" para pesquisar de novo ou "finalizar pedido" para concluir.',
    };
  }

  // "Listar por" / "Ordenar por" + coluna(s): a qualquer momento, reordena a última tabela (dispensa validação de opção)
  const matchListarOrdenar = msgTrim.match(/^(?:listar|ordenar)\s+por\s+(.+)$/i);
  if (matchListarOrdenar && lastProducts && lastProducts.length > 0) {
    const resto = matchListarOrdenar[1].trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '');
    const tokens = resto.split(/\s+(?:e\s+)?|\s*,\s*/).map((t) => t.trim()).filter(Boolean);
    type KeyProdutoOrdenar = keyof Produto | 'precoUnitario' | 'dim1' | 'dim2' | 'dim3' | 'dim4' | 'material';
    const colunasMap: Record<string, KeyProdutoOrdenar> = {
      codigo: 'codigo',
      descricao: 'descricao',
      dim1: 'dim1',
      'dim 1': 'dim1',
      dim2: 'dim2',
      'dim 2': 'dim2',
      dim3: 'dim3',
      'dim 3': 'dim3',
      dim4: 'dim4',
      'dim 4': 'dim4',
      preco: 'precoUnitario',
      'preco unitario': 'precoUnitario',
      estoque: 'estoque',
      material: 'material',
    };
    const labelParaKey: Record<string, string> = {
      codigo: 'código',
      descricao: 'descrição',
      dim1: 'dim1',
      dim2: 'dim2',
      dim3: 'dim3',
      dim4: 'dim4',
      precoUnitario: 'preço',
      estoque: 'estoque',
      material: 'material',
    };
    const keys: KeyProdutoOrdenar[] = [];
    const labels: string[] = [];
    for (const t of tokens) {
      const dimMatch = t.match(/^dim\s*([1-4])$/);
      const k: KeyProdutoOrdenar | null = colunasMap[t] ?? (dimMatch ? (`dim${dimMatch[1]}` as KeyProdutoOrdenar) : null);
      if (k && !keys.includes(k)) {
        keys.push(k);
        labels.push(labelParaKey[k] ?? k);
      }
    }
    if (keys.length > 0) {
      const sorted = [...lastProducts].sort((a, b) => {
        for (const key of keys) {
          const va = (a as unknown as Record<string, unknown>)[key];
          const vb = (b as unknown as Record<string, unknown>)[key];
          if (typeof va === 'string' && typeof vb === 'string') {
            const c = va.localeCompare(vb, undefined, { numeric: true });
            if (c !== 0) return c;
          } else if (typeof va === 'number' && typeof vb === 'number') {
            if (va !== vb) return va - vb;
          } else if (va != null && vb != null) {
            const c = String(va).localeCompare(String(vb), undefined, { numeric: true });
            if (c !== 0) return c;
          } else if (va != null) return -1;
          else if (vb != null) return 1;
        }
        return 0;
      });
      const labelTexto = labels.join(', ');
      return {
        text: `${sorted.length} Produtos ordenados por ${labelTexto}. Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar os produtos ao pedido.`,
        produtos: sorted,
        cart: cartAtual.length > 0 ? cartAtual : undefined,
      };
    }
  }

  // Quando o assistente pediu "Indique o produto e a quantidade" ou "Indique o produto para excluir",
  // processar ANTES de matchItemQtd para não confundir com "adicionar item ao carrinho" (alterar = trocar quantidade).
  const pediuIndicarProdutoQtd = /indique o produto e a quantidade/i.test(ultimaRespostaAssistente);
  const pediuIndicarProdutoExcluir = /indique o produto para excluir/i.test(ultimaRespostaAssistente);
  const matchAlterarQtd = msgTrim.match(/^(\d+)\s*[,]\s*(\d+)$/) || msgTrim.match(/^(\d+)\s+(\d+)$/);
  if (pediuIndicarProdutoQtd && cartAtual.length > 0) {
    if (matchAlterarQtd) {
      const itemIdx = parseInt(matchAlterarQtd[1], 10) - 1;
      const novaQtd = Math.max(1, parseInt(matchAlterarQtd[2], 10));
      if (itemIdx >= 0 && itemIdx < cartAtual.length) {
        cartAtual[itemIdx].quantidade = novaQtd;
        return {
          text: 'Segue seu pedido:',
          cart: cartAtual,
          exibirCarrinho: true,
          textoPergunta:
            'Você pode digitar "alterar pedido" para mudar algum item, "incluir outro item" para adicionar mais produtos, "buscar produto" para pesquisar de novo ou "finalizar pedido" para concluir.',
        };
      }
      return {
        text: `Produto com índice ${itemIdx + 1} não encontrado no pedido. Por favor, verifique e tente novamente.`,
        textoPergunta:
          'Você pode digitar "alterar pedido" para mudar algum item, "incluir outro item" para adicionar mais produtos, "buscar produto" para pesquisar de novo ou "finalizar pedido" para concluir.',
        cart: cartAtual,
      };
    }
    return {
      text: 'Formato inválido. Por favor, indique o número do item e a nova quantidade (ex: 1 15 ou 1,15).',
      textoPergunta:
        'Você pode digitar "alterar pedido" para mudar algum item, "incluir outro item" para adicionar mais produtos, "buscar produto" para pesquisar de novo ou "finalizar pedido" para concluir.',
      cart: cartAtual,
    };
  }
  if (pediuIndicarProdutoExcluir && cartAtual.length > 0) {
    if (/^\d+$/.test(msgTrim)) {
      const itemIdx = parseInt(msgTrim, 10) - 1;
      if (itemIdx >= 0 && itemIdx < cartAtual.length) {
        cartAtual.splice(itemIdx, 1);
        if (cartAtual.length === 0)
          return { text: 'Pedido vazio. Qual é o produto que devo procurar?', cart: cartAtual };
        return {
          text: 'Segue seu pedido:',
          cart: cartAtual,
          exibirCarrinho: true,
          textoPergunta:
            'Você pode digitar "alterar pedido" para mudar algum item, "incluir outro item" para adicionar mais produtos, "buscar produto" para pesquisar de novo ou "finalizar pedido" para concluir.',
        };
      }
      return {
        text: `Produto com índice ${itemIdx + 1} não encontrado no pedido. Por favor, verifique e tente novamente.`,
        textoPergunta:
          'Você pode digitar "alterar pedido" para mudar algum item, "incluir outro item" para adicionar mais produtos, "buscar produto" para pesquisar de novo ou "finalizar pedido" para concluir.',
        cart: cartAtual,
      };
    }
    return {
      text: 'Formato inválido. Indique o número do item a excluir (ex: 1).',
      textoPergunta:
        'Você pode digitar "alterar pedido" para mudar algum item, "incluir outro item" para adicionar mais produtos, "buscar produto" para pesquisar de novo ou "finalizar pedido" para concluir.',
      cart: cartAtual,
    };
  }

  // Só incluir no pedido quando o cliente passou pela opção "1 - Incluir produto" e recebeu "Indique o número do item e a quantidade"
  const pediuItemEQtdParaIncluir = /indique o número do item e a quantidade/i.test(ultimaRespostaAssistente);
  const matchItemQtd = msgTrim.match(/^(\d+)\s+(\d+)$/);
  if (matchItemQtd && lastProducts && lastProducts.length > 0 && pediuItemEQtdParaIncluir) {
    const itemNum = parseInt(matchItemQtd[1], 10);
    const qtd = Math.max(1, parseInt(matchItemQtd[2], 10));
    const produto = lastProducts[itemNum - 1];
    if (produto) {
      const estoque = produto.estoque ?? 0;
      if (qtd > estoque) {
        return {
          text: textoInsuficiente(qtd, estoque),
          cart: cartAtual.length > 0 ? cartAtual : undefined,
        };
      }
      const out = adicionarAoCarrinhoEResponder(itemNum, qtd);
      if (out) return out;
    }
  }

  if (msgTrim === '1' && lastProducts && lastProducts.length > 0 && opcoesInsuficiente.test(ultimaRespostaAssistente)) {
    const ctx = obterUltimoItemQtdDoHistorico();
    if (ctx) {
      const out = adicionarAoCarrinhoEResponder(ctx.itemNum, ctx.qtd);
      if (out) return out;
    }
  }

  if (msgTrim === '2' && opcoesInsuficiente.test(ultimaRespostaAssistente)) {
    return {
      text: 'Qual é a quantidade?',
      cart: cartAtual.length > 0 ? cartAtual : undefined,
    };
  }

  if (/^\d+$/.test(msgTrim) && lastProducts && lastProducts.length > 0 && ultimaPerguntaQtd) {
    const ctx = obterUltimoItemQtdDoHistorico();
    if (ctx) {
      const novaQtd = Math.max(1, parseInt(msgTrim, 10));
      const produto = lastProducts[ctx.itemNum - 1];
      if (produto) {
        const estoque = produto.estoque ?? 0;
        if (novaQtd > estoque) {
          return {
            text: textoInsuficiente(novaQtd, estoque),
            cart: cartAtual.length > 0 ? cartAtual : undefined,
          };
        }
        const out = adicionarAoCarrinhoEResponder(ctx.itemNum, novaQtd);
        if (out) return out;
      }
    }
  }

  if (historico.length >= 2 && (msgTrim === '1' || msgTrim === '2' || msgTrim === '3' || msgTrim === '4')) {
    const pediuDesejaExcluirDesdePendente =
      algumaRespostaTemDesejaExcluir &&
      /1\s*-\s*Não/i.test(ultimaRespostaAssistente) &&
      /2\s*-\s*Sim/i.test(ultimaRespostaAssistente);
    if (pediuDesejaExcluirDesdePendente) {
      if (msgTrim === '1')
        return { text: 'Qual é o produto que devo procurar?', cart: cartAtual.length > 0 ? cartAtual : undefined };
      if (msgTrim === '2')
        return {
          text: 'Pedido totalmente excluído.',
          textoPergunta: TEXTO_INICIAL_CONVERSA,
          cart: [],
          clearCart: true,
        };
    }

    const pediuExcluirPedidoCompleto =
      algumaRespostaTemExcluirCompleto &&
      /1\s*-\s*Não/i.test(ultimaRespostaAssistente) &&
      /2\s*-\s*Sim/i.test(ultimaRespostaAssistente);
    if (pediuExcluirPedidoCompleto) {
      if (msgTrim === '1')
        return { text: 'Qual é o produto que devo procurar?', cart: cartAtual.length > 0 ? cartAtual : undefined };
      if (msgTrim === '2')
        return {
          text: 'Pedido totalmente excluído',
          textoPergunta: 'Qual é o produto que devo procurar?',
          cart: [],
          clearCart: true,
        };
    }

    const opcoesPedidoPendente =
      /1\s*-\s*Finalizar/i.test(ultimaRespostaAssistente) && /2\s*-\s*Excluir/i.test(ultimaRespostaAssistente);
    if (opcoesPedidoPendente && cartAtual.length > 0) {
      if (msgTrim === '1')
        return {
          text: 'Segue seu pedido para conferência:',
          cart: cartAtual,
          exibirCarrinho: true,
          textoPergunta: 'Está correto? Você pode digitar "alterar pedido" para mudar algo ou "finalizar pedido" para concluir (informe CPF ou CNPJ).',
        };
      if (msgTrim === '2')
        return {
          text: 'Deseja excluir o pedido completo?',
          cart: cartAtual,
          exibirCarrinho: true,
          carrinhoEmBalaoSeparado: true,
          textoPergunta: 'Responda "sim" para excluir tudo ou "não" para manter o pedido.',
        };
    }

    // Menus numéricos após produtos/pedido foram descontinuados; a interação passa a ser por frases naturais

    const opcoesAlterarExcluir =
      /1\s*-\s*Alterar quantidade/i.test(ultimaRespostaAssistente) &&
      /2\s*-\s*Excluir produto/i.test(ultimaRespostaAssistente);
    if (msgTrim === '1' && opcoesAlterarExcluir)
      return { text: 'Indique o produto e a quantidade (ex: 1,15)', cart: cartAtual.length > 0 ? cartAtual : undefined };
    if (msgTrim === '2' && opcoesAlterarExcluir)
      return { text: 'Qual item deseja excluir?', textoPergunta: 'Indique o produto para excluir (ex: 1)', cart: cartAtual.length > 0 ? cartAtual : undefined };
  }

  // Menus numéricos genéricos (1/2/3/4) não são mais usados; qualquer texto do cliente deve ser interpretado de forma natural.

  // ----- Fluxo 4 - Finalizar: CPF/CNPJ → (CNPJ: confirmar dados | CPF: CEP → confirmar endereço) → Faturamento -----
  const pediuCpfCnpj =
    /Informe o CPF ou CNPJ do cliente/i.test(ultimaRespostaAssistente) ||
    /Informe o CNPJ novamente/i.test(ultimaRespostaAssistente);
  if (pediuCpfCnpj && cartAtual.length > 0) {
    const n = msgTrim.replace(/\D/g, '');
    if (n.length === 14) {
      const cliente = await buscarClientePorCpfCnpj(msgTrim);
      if (cliente) {
        return {
          text: `Cliente: ${cliente.nome}.`,
          textoPergunta: 'Confirma os dados do cliente? 1 - Sim, 2 - Não',
          cart: cartAtual,
        };
      }
      return {
        text: 'CNPJ não encontrado.',
        textoPergunta: 'Informe o CNPJ novamente.',
        cart: cartAtual,
      };
    }
    if (n.length === 11) {
      return {
        text: 'Para concluir o pedido, precisamos do endereço de entrega.',
        textoPergunta: 'Informe o CEP do endereço de entrega.',
        cart: cartAtual,
      };
    }
    return {
      text: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.',
      textoPergunta: 'Informe o CPF ou CNPJ do cliente.',
      cart: cartAtual,
    };
  }

  const pediuConfirmarDadosCliente = /Confirma os dados do cliente\?\s*1\s*-\s*Sim/i.test(ultimaRespostaAssistente);
  if (pediuConfirmarDadosCliente && cartAtual.length > 0) {
    if (msgTrim === '2') {
      return {
        text: 'Informe o CNPJ novamente.',
        textoPergunta: 'Informe o CPF ou CNPJ do cliente.',
        cart: cartAtual,
      };
    }
    if (msgTrim === '1') {
      const itensPagamentos = await listarPagamentos(idEmitente);
      return {
        text: formatarOpcoesPagamentos(itensPagamentos),
        cart: cartAtual,
        clearCart: true,
      };
    }
  }

  const pediuCep =
    /Informe o CEP do endereço de entrega/i.test(ultimaRespostaAssistente) ||
    /Informe o CEP novamente/i.test(ultimaRespostaAssistente);
  if (pediuCep && cartAtual.length > 0) {
    const endereco = await buscarEnderecoPorCep(msgTrim);
    if (endereco) {
      const enderecoFormatado = formatarEnderecoParaChat(endereco);
      return {
        text: `Endereço: ${enderecoFormatado}.`,
        textoPergunta: 'Confirma o endereço? 1 - Sim, 2 - Não',
        cart: cartAtual,
      };
    }
    return {
      text: 'CEP não encontrado.',
      textoPergunta: 'Informe o CEP novamente.',
      cart: cartAtual,
    };
  }

  const pediuConfirmarEndereco = /Confirma o endereço\?\s*1\s*-\s*Sim/i.test(ultimaRespostaAssistente);
  if (pediuConfirmarEndereco && cartAtual.length > 0) {
    if (msgTrim === '2') {
      return {
        text: 'Informe o CEP novamente.',
        textoPergunta: 'Informe o CEP do endereço de entrega.',
        cart: cartAtual,
      };
    }
    if (msgTrim === '1') {
      const itensPagamentos = await listarPagamentos(idEmitente);
      return {
        text: formatarOpcoesPagamentos(itensPagamentos),
        cart: cartAtual,
        clearCart: true,
      };
    }
  }

  if (parecePedidoDeProduto) {
    const termo = msgTrim;
    if (termo === '1' || termo === '2') {
      // não fazer busca por "1" ou "2"
    } else {
      // Filtro de intercorrência social: saudação, cortesia, gratidão → resposta social (sem busca)
      const socialResp = checkSocialTrigger(mensagem);
      if (socialResp) {
        return {
          ...socialResp,
          cart: cartAtual.length > 0 ? cartAtual : undefined,
        };
      }
      let produtosEncontrados: Produto[];

      if (hasDatabase() && idEmitente.trim()) {
        try {
          const textoNorm = mensagem.replace(/,/g, '.').trim();
          const tokensBrutos = textoNorm
            .split(/\s+/)
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
          const saudacoesSimples = new Set(['oi', 'olá', 'ola']);
          const tokensFiltrados: string[] = [];
          for (let i = 0; i < tokensBrutos.length; i += 1) {
            const atual = tokensBrutos[i];
            const prox = tokensBrutos[i + 1];
            const atualLower = atual.toLowerCase();
            const proxLower = prox?.toLowerCase();
            // Combos "bom dia", "boa tarde", "boa noite"
            if (
              (atualLower === 'bom' && proxLower === 'dia') ||
              (atualLower === 'boa' && (proxLower === 'tarde' || proxLower === 'noite'))
            ) {
              i += 1;
              continue;
            }
            if (saudacoesSimples.has(atualLower)) continue;
            tokensFiltrados.push(atual);
          }

          const termCount = tokensFiltrados.length;

          // Heurística: mensagem é apenas um código técnico (sem espaços)?
          const pareceCodigoProduto = termCount === 1
            ? /^[A-Za-z0-9._-]+$/i.test(tokensFiltrados[0]) && tokensFiltrados[0].length >= 2
            : /^[A-Za-z0-9._-]+$/i.test(mensagem.trim()) && mensagem.trim().length >= 2 && !/\s/.test(mensagem.trim());

          // Motor de busca por trilhas (sempre usado). Regra: d1→dim1, d2→dim2, d3→dim3, d4→dim4 não entram na CTU. Ver lib/motor-busca.ts.
          const motorRes = await executarMotorBusca(mensagem, idEmitente.trim());
          if (motorRes.trilha === 'PEDIR_DETALHES' && motorRes.mensagem) {
            return { text: motorRes.mensagem, cart: cartAtual.length > 0 ? cartAtual : undefined };
          }
          if (motorRes.trilha === 'NENHUMA' && motorRes.mensagem) {
            return { text: motorRes.mensagem, cart: cartAtual.length > 0 ? cartAtual : undefined };
          }
          if (motorRes.produtos && motorRes.produtos.length > 0) {
            const produtosChat = motorRes.produtos
              .map((p) => mapBuscaToChatProduto(p) as unknown as Produto)
              .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
            return {
              text: motorRes.textoResposta ?? (await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_DESCRICAO))?.replace(/\{n\}/g, String(produtosChat.length)) ?? `Encontrei ${produtosChat.length} produto(s).`,
              produtos: produtosChat,
              cart: cartAtual.length > 0 ? cartAtual : undefined,
            };
          }
          if (motorRes.mensagem) {
            return { text: motorRes.mensagem, cart: cartAtual.length > 0 ? cartAtual : undefined };
          }
          return {
            text: motorRes.textoResposta ?? motorRes.mensagem ?? (await getConfig(CONFIG_KEYS.MSG_NENHUM_RESULTADO)) ?? 'Não encontrei nada com essa busca.',
            cart: cartAtual.length > 0 ? cartAtual : undefined,
          };

          // (2) Pesquisa por código (isolado): quando o termo único parece código.
          if (termCount === 1 && pareceCodigoProduto) {
            const codigoTerm = tokensFiltrados[0];
            const porCodigoPrimeiro = await buscarProdutosPorCodigo(codigoTerm, idEmitente.trim());
            if (porCodigoPrimeiro.length > 0) {
              const msgCodigo = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_CODIGO);
              const produtosCodigo = porCodigoPrimeiro
                .map((p) => mapBuscaToChatProduto(p) as unknown as Produto)
                .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
              return {
                text: msgCodigo ?? 'Produto(s) encontrado(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.',
                produtos: produtosCodigo,
                cart: cartAtual.length > 0 ? cartAtual : undefined,
              };
            }
          }

          // Regra termo único: se sobrar apenas um termo, e não for código nem linha, pedir para montar melhor a pesquisa.
          if (termCount === 1) {
            const msgPedir = await getConfig(CONFIG_KEYS.MSG_PEDIR_ESPECIFICACOES);
            return {
              text: msgPedir ?? 'Para eu encontrar o produto certo, monte a pesquisa assim: use "medida" ou d1/d2/d3/d4 antes das dimensões (ex.: medida 140 170 ou d1 140 d2 170), "perf" antes do perfil (ex.: perf BAG), "mat" antes do material (ex.: mat NBR70) e "apli" antes da aplicação (ex.: apli motor). Exemplo completo: retentor d1 140 d2 170 perf BAG mat NBR70 apli eixo.',
              cart: cartAtual.length > 0 ? cartAtual : undefined,
            };
          }

          // Regra 2–3 termos: se houver número no 2º ou 3º termo sem rótulo (medida/perf/mat/apli/d1/dim1...), pedir para o usuário rotular.
          if (termCount >= 2 && termCount <= 3) {
            const hasNumeroNo23 = tokensFiltrados.slice(1, 3).some((t) => /^\d+([.,]\d+)?$/.test(t.replace(',', '.')));
            const temRotulo =
              /\b(d1|d2|d3|d4|dim1|dim2|dim3|dim4|medida|perf|mat|apli)\b/i.test(mensagem);
            if (hasNumeroNo23 && !temRotulo) {
              const msgPedir = await getConfig(CONFIG_KEYS.MSG_PEDIR_ESPECIFICACOES);
              return {
                text: msgPedir ?? 'Para eu encontrar o produto certo, monte a pesquisa assim: use "medida" ou d1/d2/d3/d4 antes das dimensões (ex.: medida 140 170 ou d1 140 d2 170), "perf" antes do perfil (ex.: perf BAG), "mat" antes do material (ex.: mat NBR70) e "apli" antes da aplicação (ex.: apli motor). Exemplo completo: retentor d1 140 d2 170 perf BAG mat NBR70 apli eixo.',
                cart: cartAtual.length > 0 ? cartAtual : undefined,
              };
            }
          }

          // (2) Pesquisa por código (isolado): somente quando a mensagem inteira é um código (sem espaços).
          // Não usar esse caminho quando houver também descrição (ex.: "anel 2010", "retentor BAG").
          const codigoCandidato = extractCodigoCandidato(mensagem);
          if (!mensagem.includes(' ') && pareceCodigoProduto && codigoCandidato !== null) {
            const porCodigoPrimeiro = await buscarProdutosPorCodigo(codigoCandidato as string, idEmitente.trim());
            if (porCodigoPrimeiro.length > 0) {
              const msgCodigo = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_CODIGO);
              const produtosCodigo = porCodigoPrimeiro
                .map((p) => mapBuscaToChatProduto(p) as unknown as Produto)
                .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
              return {
                text: msgCodigo ?? 'Produto(s) encontrado(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.',
                produtos: produtosCodigo,
                cart: cartAtual.length > 0 ? cartAtual : undefined,
              };
            }
          }

          // Cascata quando busca direta por código não achou: retirada do ruído + (1) produto + parte do código, (2) produto + dimensões, (3) produto + palavra relevante/perfil/material.
          const plan = intelligentSearchEngine(mensagem, { preferSearchOverClarify: true });
          const temDims = plan.dims.dim1 != null || plan.dims.dim2 != null || plan.dims.dim3 != null || plan.dims.dim4 != null;
          const structured =
            temDims
              ? {
                  mode: (plan.queryMode === 'STRICT' ? 'STRICT' : 'TOLERANCE') as 'STRICT' | 'TOLERANCE',
                  dim1: plan.dims.dim1 ?? null,
                  dim2: plan.dims.dim2 ?? null,
                  dim3: plan.dims.dim3 ?? null,
                  dim4: plan.dims.dim4 ?? null,
                  toleranceMm: plan.queryMode === 'STRICT' ? undefined : 0.2,
                }
              : undefined;
          let termoBusca = mensagem;
          let vocabTerms: string[] = [];
          let materialDureza: string | null = null;
          let perfilStr = '';
          let numerosStr = '';
          const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'para', 'pra', 'por', 'um', 'uma', 'uns', 'umas', 'com', 'no', 'na', 'nos', 'nas', 'ao', 'aos', 'à', 'às', 'em', 'e', 'ou', 'que', 'o', 'a', 'os', 'as', 'preciso', 'precisamos', 'quero', 'queremos', 'necessito', 'gostaria', 'queria', 'precisa', 'tem', 'tenho', 'achar', 'acho', 'procurando', 'buscar', 'busca', 'encontrar', 'encontre', 'mandar', 'enviar', 'pedir', 'pedido', 'cotar', 'cotação', 'orçar', 'orcamento']);
          try {
            vocabTerms = await getVocabularySearchTerms(mensagem);
            materialDureza = parseMaterialDureza(mensagem);
            const numeros = parseMeasures(mensagem).numbers;
            numerosStr = numeros.length > 0 ? ' ' + numeros.join(' ') : '';
            const materialDurezaStr = materialDureza ? ' ' + materialDureza : '';
            const perfilMatch = mensagem.match(/\b(BR|BA|BS|AS|V|VB)\b/gi) ?? [];
            perfilStr = perfilMatch.length > 0 ? ' ' + [...new Set(perfilMatch)].join(' ') : '';
            const tokensMsg = mensagem.split(/[\s.\-_/\\]+/).map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2 && !/^\d+([.,]\d+)?$/.test(t.replace(',', '.')) && !stopWords.has(t));
            const todasPalavras = [...new Set([...vocabTerms, ...tokensMsg])];
            termoBusca = (todasPalavras.join(' ') + (materialDureza ? ' ' + materialDureza : '') + perfilStr + numerosStr).trim() || mensagem;

            const formatarRetornoCascata = async (resultados: Awaited<ReturnType<typeof buscarProdutosPrisma>>) => {
              if (resultados.length === 0) return null;
              const produtosMap = resultados.map((p) => mapBuscaToChatProduto(p) as unknown as Produto).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
              const msg = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_DESCRICAO);
              const texto = (msg ?? 'Encontrei {n} produto(s). Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar ao pedido.').replace(/\{n\}/g, String(produtosMap.length));
              return { text: texto, produtos: produtosMap, cart: cartAtual.length > 0 ? cartAtual : undefined };
            };

            // (1) Produto + parte do código: descrição (vocabulário ou tokens da mensagem) + código candidato
            const palavrasProdutoParaCodigo = vocabTerms.length > 0 ? vocabTerms.join(' ') : tokensMsg.join(' ').trim();
            if (codigoCandidato && palavrasProdutoParaCodigo) {
              const termoProdutoCodigo = (palavrasProdutoParaCodigo + ' ' + codigoCandidato).trim();
              const r1 = await buscarProdutosPrisma(termoProdutoCodigo, idEmitente.trim());
              const out1 = await formatarRetornoCascata(r1);
              if (out1 != null) return out1 as ChatResponse;
            }

            // (2) Produto + dimensões
            if (temDims && structured && (vocabTerms.length > 0 || materialDureza || perfilStr.trim())) {
              const termoProdutoDims = (vocabTerms.join(' ') + (materialDureza ? ' ' + materialDureza : '') + perfilStr).trim();
              const r2 = await buscarProdutosPrisma(termoProdutoDims || mensagem, idEmitente.trim(), { structuredDimFilter: structured });
              const out2 = await formatarRetornoCascata(r2);
              if (out2 != null) return out2 as ChatResponse;
            }

            // (3) Produto + palavra relevante ou perfil ou material (inclui números para ex.: anel 2010)
            if (todasPalavras.length > 0 || materialDureza || perfilStr.trim() || numerosStr.trim()) {
              const termoProdutoPalavra = (todasPalavras.join(' ') + (materialDureza ? ' ' + materialDureza : '') + perfilStr + numerosStr).trim();
              if (termoProdutoPalavra) {
                const r3 = await buscarProdutosPrisma(termoProdutoPalavra, idEmitente.trim());
                const out3 = await formatarRetornoCascata(r3);
                if (out3 != null) return out3 as ChatResponse;
              }
            }
          } catch (e) {
            console.warn('[groq] cascata produto+código/dims/palavra:', e);
          }

          // Regra Linhas: só quando o usuário disser "linha" (ex.: "linha CXP", "linha case"). "guia de nylon" não é linha.
          if (/\blinha\b/i.test(mensagem)) {
            const linhaCandidates = extractLinhaCandidates(mensagem);
            let linhaMatch: Awaited<ReturnType<typeof findLinhaMatch>> = null;
            for (const candidate of linhaCandidates) {
              linhaMatch = await findLinhaMatch(candidate);
              if (linhaMatch) break;
            }
            if (linhaMatch != null) {
              if (isLinhaBloqueadaOuExclusiva(linhaMatch!)) {
                const msg = await getConfig(CONFIG_KEYS.MSG_LINHA_INDISPONIVEL);
                return {
                  text: msg ?? 'Essa linha de produto é de venda exclusiva, não está disponível.',
                  textoPergunta: 'Se quiser, pode tentar outra linha ou me dizer o código ou a medida do produto.',
                  cart: cartAtual.length > 0 ? cartAtual : undefined,
                };
              }
              const porLinha = await searchProductsByLinha(linhaMatch!.linha, idEmitente.trim());
              if (porLinha.length > 0) {
                const ordenados = [...porLinha]
                  .map((p) => mapBuscaToChatProduto(p) as unknown as Produto)
                  .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
                const msgSucesso = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_LINHA);
                let textoLinha = (msgSucesso ?? 'Encontrei {n} produto(s). Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar ao pedido.').replace(/\{n\}/g, String(ordenados.length));
                if (!/\d+\s*produto/.test(textoLinha)) textoLinha = `Encontrei ${ordenados.length} produto(s). ${textoLinha.trim()}`;
                return {
                  text: textoLinha,
                  produtos: ordenados,
                  cart: cartAtual.length > 0 ? cartAtual : undefined,
                };
              }
              // Linha permitida mas sem produtos por código: segue para a busca normal (fallback).
            } else {
              const msgNaoEncontrada = await getConfig(CONFIG_KEYS.MSG_LINHA_NAO_ENCONTRADA);
              return {
                text: msgNaoEncontrada ?? 'A linha procurada não foi encontrada.',
                cart: cartAtual.length > 0 ? cartAtual : undefined,
              };
            }
          }

          // Refinamento: entrada com só nome do produto (sem dimensões, material/dureza ou perfil) → pedir especificações (não buscar).
          // Considera também rótulos (d1/d2/d3/d4, mat, perf, apli): se a mensagem já tiver, não pedir de novo.
          const temPerfil = /\b(BR|BA|BS|AS|V|VB)\b/i.test(mensagem);
          const parsedLabels = parseLabels(mensagem);
          const temRotulos =
            parsedLabels.dim1 != null ||
            parsedLabels.dim2 != null ||
            parsedLabels.dim3 != null ||
            parsedLabels.dim4 != null ||
            ((parsedLabels.material?.length ?? 0) > 0) ||
            ((parsedLabels.perfil?.length ?? 0) > 0) ||
            ((parsedLabels.aplicacao?.length ?? 0) > 0);
          if (!pareceCodigoProduto && vocabTerms.length > 0 && !temDims && !materialDureza && !temPerfil && !temRotulos) {
            const msgPedir = await getConfig(CONFIG_KEYS.MSG_PEDIR_ESPECIFICACOES);
            return {
              text: msgPedir ?? 'Para eu encontrar o produto certo, informe as dimensões (ex.: 28 x 3,53) e, se souber, o material ou perfil (ex.: NBR70, BR).',
              cart: cartAtual.length > 0 ? cartAtual : undefined,
            };
          }

          // Passo 1: STRICT ou TOLERANCE (quando temos dims)
          let resultados = await buscarProdutosPrisma(termoBusca, idEmitente.trim(), structured ? { structuredDimFilter: structured } : undefined);

          // Passo 2: TOLERANCE (fallback se STRICT retornou 0)
          if (resultados.length === 0 && structured?.mode === 'STRICT') {
            resultados = await buscarProdutosPrisma(termoBusca, idEmitente.trim(), { structuredDimFilter: { ...structured!, mode: 'TOLERANCE', toleranceMm: 0.2 } });
          }

          // Pesquisa por código com sucesso: resposta exclusivamente da tabela Configurações (sem LLM).
          if (pareceCodigoProduto && resultados.length > 0) {
            const msgCodigo = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_CODIGO);
            const produtosCodigo = resultados.map((p) => mapBuscaToChatProduto(p) as unknown as Produto);
            return {
              text: msgCodigo ?? 'Produto(s) encontrado(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.',
              produtos: produtosCodigo,
              cart: cartAtual.length > 0 ? cartAtual : undefined,
            };
          }

          // Se a busca ficou ampla demais: pergunta medidas OU dureza (material sem dureza).
          if (resultados.length > 40) {
            const semDureza = plan.intent.material !== 'UNKNOWN' && !parseMaterialDureza(mensagem);
            if (semDureza) {
              return {
                text: 'Achei várias opções para esse material.',
                textoPergunta: 'Você precisa de uma dureza específica (ex.: 70 ou 90 Shore A)? Pode informar como NBR70, NBR90, etc.',
                cart: cartAtual.length > 0 ? cartAtual : undefined,
              };
            }
            if (plan.needsClarification) {
              const q = buildClarifyingQuestion(plan);
              return {
                text: 'Achei algumas opções próximas, mas para eu acertar em cheio preciso de só mais um detalhe.',
                textoPergunta: q ?? 'Você consegue informar as medidas que faltam?',
                cart: cartAtual.length > 0 ? cartAtual : undefined,
              };
            }
          }

          produtosEncontrados = resultados.map((p) => mapBuscaToChatProduto(p) as unknown as Produto);
        } catch (err) {
          console.error('[groq] Erro na busca via banco/CTU:', err);
          // Não fazer fallback para a API de estoque aqui para evitar trazer tabela inteira
          // quando a busca estruturada falhar. Deixamos a lógica de "nenhum resultado"
          // tratar esse caso mais abaixo.
          produtosEncontrados = [];
        }
      } else {
        const [porCodigo, porDescricao] = await Promise.all([
          consultarEstoque({ codigo: termo }),
          consultarEstoque({ descricao: termo }),
        ]);
        const porId = new Map<string, Produto>();
        [...porCodigo, ...porDescricao].forEach((p) => porId.set(p.id, p));
        produtosEncontrados = Array.from(porId.values());
      }

      if (produtosEncontrados.length === 0) {
        const msgNenhum = await getConfig(CONFIG_KEYS.MSG_NENHUM_RESULTADO);
        return {
          text: msgNenhum ?? `Não encontrei nada com "${termo}" no estoque. Pode tentar de novo com o código, a descrição ou as medidas do produto.`,
          textoPergunta: 'Quer tentar outra busca ou informar as medidas?',
          cart: cartAtual.length > 0 ? cartAtual : undefined,
        };
      }
      const ordenadosPorCodigo = [...produtosEncontrados].sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { numeric: true }));
      produtosRetorno = ordenadosPorCodigo;
      const msgDescricao = await getConfig(CONFIG_KEYS.MSG_SUCESSO_BUSCA_DESCRICAO);
      const textoComCount = (msgDescricao ?? 'Encontrei {n} produto(s). Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar os produtos ao pedido.').replace(/\{n\}/g, String(ordenadosPorCodigo.length));
      return {
        text: textoComCount,
        produtos: ordenadosPorCodigo,
        cart: cartAtual.length > 0 ? cartAtual : undefined,
      };
    }
  }

  const precisaBusca =
    mensagem.length > 5 && parecePerguntaGeral;
  const ehPerguntaComInterrogacao = mensagem.trim().endsWith('?');
  if (ehPerguntaComInterrogacao) {
    systemContent += `\n\nIMPORTANTE: O cliente fez uma pergunta (frase terminada em ?). Pesquise na web e use o contexto abaixo para dar a melhor resposta possível. Responda somente à pergunta e termine com "Mas, voltando ao seu pedido. Qual é o produto que devo procurar?" NÃO escreva "Produtos encontrados.", NÃO inclua as opções "1 - Incluir produto no pedido" ou "2 - Procurar por outro produto".`;
    const contextoWebPergunta = await buscarNaWeb(mensagem);
    if (contextoWebPergunta) {
      systemContent += `\n\nContexto da web (use para responder com precisão):\n${contextoWebPergunta}`;
    }
  } else if (precisaBusca) {
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

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
  let text =
    data.choices?.[0]?.message?.content?.trim() || 'Desculpe, não consegui processar.';

  // Só processar CART_ADD da resposta do LLM se o cliente passou pela opção de inclusão (pediu item e quantidade)
  const cartAddMatches = [...text.matchAll(CART_ADD_REGEX)];
  const userSentItemQtd = /^\d+\s+\d+$/.test(mensagem.trim());
  const lastAskedForItemQtd = /indique o número do item e a quantidade/i.test(ultimaRespostaAssistente);
  const podeIncluirViaLLM = cartAddMatches.length > 0 && userSentItemQtd && lastAskedForItemQtd;
  if (cartAddMatches.length > 0) {
    if (podeIncluirViaLLM) {
      for (const m of cartAddMatches) {
        const codigo = m[1].trim();
        const quantidade = Math.max(1, parseInt(m[2], 10));
        const descricao = produtosRetorno?.find((p) => p.codigo === codigo)?.descricao ?? codigo;
        const preco = (produtosRetorno?.find((p) => p.codigo === codigo) as { precoUnitario?: number } | undefined)?.precoUnitario;
        cartAtual.push({ codigo, descricao, quantidade, precoUnitario: preco });
      }
    }
    text = text.replace(/\n?CART_ADD:[^\n]+/g, '').replace(/\n\n\n+/g, '\n\n').trim();
  }

  if (clearCart) cartAtual = [];

  let textFinal = text;
  let textoPerguntaFinal: string | undefined;
  const matchVoltandoFinal = text.match(FRASE_VOLTANDO_PEDIDO_REGEX);
  if (matchVoltandoFinal && matchVoltandoFinal.index !== undefined) {
    textFinal = text.slice(0, matchVoltandoFinal.index).replace(/\n+\s*$/, '').trim();
    textoPerguntaFinal = FRASE_VOLTANDO_PEDIDO;
  }

  const out: ChatResponse = { text: textFinal };
  if (produtosRetorno?.length) out.produtos = produtosRetorno;
  if (cartAtual.length > 0 || clearCart || cartAddMatches.length > 0) out.cart = cartAtual;
  if (clearCart) out.clearCart = true;
  if (textoPerguntaFinal) out.textoPergunta = textoPerguntaFinal;
  return out;
}
