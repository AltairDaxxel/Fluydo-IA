/**
 * Fluydo.AI - Chat com Groq (API OpenAI-compatible).
 * Modelo rápido para conversa.
 */

import path from 'path';
import { config } from 'dotenv';
import type { Produto, ItemCarrinho } from '@/types';
import { buscarNaWeb } from './busca-web';
import { consultarEstoque } from './estoque';
import { buscarClientePorCpfCnpj, listarCondicoesPagamento } from './clientes';

config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.join(__dirname, '..', '.env.local') });

const SYSTEM_PROMPT_BASE = `Você é o Fluydo. Seu objetivo como agente de IA é vender. Todas as mensagens do cliente devem ser interpretadas por você e você deve sempre responder: entenda o que ele quer, o contexto e a intenção, e dê uma resposta humanizada—natural, cordial e próxima, como um atendente real. Evite respostas robóticas; adapte o tom à situação. Seja direto mas caloroso.

SAUDAÇÃO: Na primeira resposta use: "Olá, eu sou o Fluydo. Vou ajudá-lo com o seu pedido." Em outro balão: "Você pode pesquisar produtos por código, descrição ou medidas. Mas se quiser fazer uma pergunta específica, como por exemplo, como funciona uma vedação? use sempre o sinal de interrogação no final da frase." Em outro balão: "Qual é o produto que devo procurar?" Não use bom dia, boa tarde nem boa noite. Nunca pergunte o nome do cliente; exclua todas as situações que pedem o nome.

Use "produtos" (nunca "produtos para vedação industrial").

PADRÃO DE OPÇÕES: Em todas as interações em que você oferecer escolhas ao cliente, use sempre o formato enumerado, uma opção por linha, e aguarde o código (número). Exemplo: "1 - [opção A]\n2 - [opção B]\n\nAguardo o código 1 ou 2."

Produtos encontrados: o sistema já exibe os produtos em uma tabela. NÃO liste os produtos no seu texto. Em outro balão pergunte, uma opção por linha: "1 - Incluir produto no pedido" (linha 1) e "2 - Procurar por outro produto" (linha 2). Se o cliente responder 1: pergunte "Indique o número do item e a quantidade. (ex.: 1 15)". Quando o cliente responder com item e quantidade (ex.: 1 15): se a quantidade for maior que o estoque, diga que o estoque é insuficiente e ofereça "1 - Manter a quantidade" e "2 - Alterar a quantidade". Se responder 1 (manter), inclua no pedido com a quantidade solicitada. Se responder 2 (alterar), pergunte "Qual é a quantidade?" e repita a verificação de estoque. Se o cliente responder 2 (pesquisar outro): pergunte "Qual é o produto que devo procurar?" Busca é feita no banco. Se não encontrar, use a mensagem padrão do sistema.

Perguntas fora do contexto do pedido (mensagem com ? no final): pesquise (use o "Contexto da web" quando for passado), responda de forma educada e, ao final, inclua APENAS: "Mas, voltando ao seu pedido. Qual é o produto que devo procurar?" NUNCA mostre "Produtos encontrados." nem as opções "1 - Incluir produto no pedido" ou "2 - Procurar por outro produto" nesse tipo de resposta.

CARRINHO E PEDIDO: Memorize os pedidos do cliente (produto e quantidade confirmados). Ao mostrar o pedido, ofereça "1 - Alterar o pedido" e "2 - Procurar por outro produto". Se 1: ofereça "1 - Alterar quantidade" e "2 - Excluir produto". Se alterar quantidade: peça "Indique o produto e a quantidade (ex: 1,15)". Se excluir: peça "Indique o produto para excluir". Quando o cliente pedir para FECHAR O PEDIDO: mostre todo o carrinho, pergunte se está correto e se deseja alterar, incluir ou excluir algum produto. Se o cliente CONFIRMAR que está correto: peça o CPF ou CNPJ. Quando o cliente informar CPF ou CNPJ, os dados de entrega e as condições de pagamento serão fornecidos a você—mostre os dados de entrega, liste as opções de pagamento, e ao final conclua o pedido, agradeça o cliente e fique pronto para iniciar outro pedido.`;

const GROQ_MODEL = 'llama-3.1-8b-instant';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

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
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const CART_ADD_REGEX = /CART_ADD:([^|\n]+)\|(\d+)/gi;
const CPF_CNPJ_REGEX = /\b\d{11,14}\b/;

export async function gerarRespostaChat(
  mensagem: string,
  historico: { role: 'user' | 'model'; parts: { text: string }[] }[],
  cart: ItemCarrinho[] = [],
  lastProducts?: Produto[],
  ultimaMensagemEraOpcoesArquivo?: boolean
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
      text: 'Olá, eu sou o Fluydo.',
      textoPergunta: 'O que você deseja?\n1 - Procurar por produtos\n2 - Enviar um arquivo com pedido',
    };
  }

  const msgTrimInicio = mensagem.trim();
  const ultimaRespostaAssistenteInicio = historico
    .filter((h) => h.role === 'model')
    .map((h) => h.parts.map((p) => p.text).join('\n'))
    .pop() || '';

  const voltarAoMenu = /voltar ao menu|^menu$/i.test(msgTrimInicio);
  if (voltarAoMenu) {
    return {
      text: 'O que você deseja?\n1 - Procurar por produtos\n2 - Enviar um arquivo com pedido',
      cart: cart.length > 0 ? cart : undefined,
    };
  }

  const verPedido = /ver pedido|^pedido$/i.test(msgTrimInicio);
  if (verPedido) {
    if (cart.length === 0) {
      return { text: 'Não há pedido cadastrado.', cart };
    }
    return {
      text: 'Segue seu pedido:',
      cart,
      exibirCarrinho: true,
      textoPergunta: '1 - Alterar o pedido\n2 - Procurar por outro produto',
    };
  }

  const fecharPedido = /^fechar(\s*pedido)?$/i.test(msgTrimInicio);
  if (fecharPedido) {
    if (cart.length === 0) {
      return { text: 'Não há itens no pedido. Deseja procurar produtos?', textoPergunta: 'O que você deseja?\n1 - Procurar por produtos\n2 - Enviar um arquivo com pedido', cart };
    }
    return {
      text: 'Segue seu pedido para conferência:',
      cart,
      exibirCarrinho: true,
      textoPergunta: 'Está correto?\n1 - Alterar o pedido\n2 - Está correto, finalizar (informe CPF ou CNPJ)',
    };
  }

  const excluirPedido = /^excluir(\s*pedido)?$|excluir\s*pedido/i.test(msgTrimInicio);
  if (excluirPedido) {
    return {
      text: 'Excluir o pedido completo?',
      textoPergunta: '1 - Não\n2 - Sim',
      cart: cart.length > 0 ? cart : undefined,
    };
  }

  const ehMenuPrincipal =
    /1\s*-\s*Procurar por produtos/i.test(ultimaRespostaAssistenteInicio) &&
    /2\s*-\s*Enviar um arquivo com pedido/i.test(ultimaRespostaAssistenteInicio);
  if (ehMenuPrincipal && msgTrimInicio === '1') {
    return {
      text: 'Você pode pesquisar produtos por código, descrição ou medidas. Mas se quiser fazer uma pergunta específica, como por exemplo, como funciona uma vedação? use sempre o sinal de interrogação no final da frase.',
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
      textoPergunta: '1 - Alterar o pedido\n2 - Procurar por outro produto',
    };
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
          textoPergunta: '1 - Alterar o pedido\n2 - Procurar por outro produto',
        };
      }
      return {
        text: `Produto com índice ${itemIdx + 1} não encontrado no pedido. Por favor, verifique e tente novamente.`,
        textoPergunta: '1 - Alterar o pedido\n2 - Procurar por outro produto',
        cart: cartAtual,
      };
    }
    return {
      text: 'Formato inválido. Por favor, indique o número do item e a nova quantidade (ex: 1 15 ou 1,15).',
      textoPergunta: '1 - Alterar o pedido\n2 - Procurar por outro produto',
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
          textoPergunta: '1 - Alterar o pedido\n2 - Procurar por outro produto',
        };
      }
      return {
        text: `Produto com índice ${itemIdx + 1} não encontrado no pedido. Por favor, verifique e tente novamente.`,
        textoPergunta: '1 - Alterar o pedido\n2 - Procurar por outro produto',
        cart: cartAtual,
      };
    }
    return {
      text: 'Formato inválido. Indique o número do item a excluir (ex: 1).',
      textoPergunta: '1 - Alterar o pedido\n2 - Procurar por outro produto',
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

  if (historico.length >= 2 && (msgTrim === '1' || msgTrim === '2')) {
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
          textoPergunta: 'O que você deseja?\n1 - Procurar por produtos\n2 - Enviar um arquivo com pedido',
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
          textoPergunta: 'Está correto?\n1 - Alterar o pedido\n2 - Está correto, finalizar (informe CPF ou CNPJ)',
        };
      if (msgTrim === '2')
        return {
          text: 'Deseja excluir o pedido completo?',
          cart: cartAtual,
          exibirCarrinho: true,
          carrinhoEmBalaoSeparado: true,
          textoPergunta: '1 - Não\n2 - Sim',
        };
    }

    const opcoesAposProdutos =
      (/\b1\s*-\s*.*(incluir produto no pedido|indicar o produto escolhido|qual produto|produto deseja)/i.test(ultimaRespostaAssistente) ||
       /Produtos encontrados\./i.test(ultimaRespostaAssistente)) &&
      /\b2\s*-\s*.*(procurar por outro|pesquisar|outro produto)/i.test(ultimaRespostaAssistente);
    if (opcoesAposProdutos) {
      if (msgTrim === '1')
        return { text: 'Indique o número do item e a quantidade. (ex.: 1 15)', cart: cartAtual.length > 0 ? cartAtual : undefined };
      if (msgTrim === '2')
        return { text: 'Qual é o produto que devo procurar?', cart: cartAtual.length > 0 ? cartAtual : undefined };
    }
    const opcoesAposPedido =
      /1\s*-\s*Alterar o pedido/i.test(ultimaRespostaAssistente) &&
      /2\s*-\s*Procurar por outro produto/i.test(ultimaRespostaAssistente);
    if (msgTrim === '2' && opcoesAposPedido)
      return { text: 'Qual é o produto que devo procurar?', cart: cartAtual.length > 0 ? cartAtual : undefined };
    if (msgTrim === '1' && opcoesAposPedido && cartAtual.length > 0)
      return {
        text: '1 - Alterar quantidade\n2 - Excluir produto',
        cart: cartAtual,
      };

    const opcoesAlterarExcluir =
      /1\s*-\s*Alterar quantidade/i.test(ultimaRespostaAssistente) &&
      /2\s*-\s*Excluir produto/i.test(ultimaRespostaAssistente);
    if (msgTrim === '1' && opcoesAlterarExcluir)
      return { text: 'Indique o produto e a quantidade (ex: 1,15)', cart: cartAtual.length > 0 ? cartAtual : undefined };
    if (msgTrim === '2' && opcoesAlterarExcluir)
      return { text: 'Indique o produto para excluir (ex: 1)', cart: cartAtual.length > 0 ? cartAtual : undefined };
  }

  const ultimaTinhaOpcoes1e2 =
    historico.length >= 2 &&
    /\b1\s*-\s*/.test(ultimaRespostaAssistente) &&
    /\b2\s*-\s*/.test(ultimaRespostaAssistente);
  if (ultimaTinhaOpcoes1e2 && msgTrim !== '1' && msgTrim !== '2') {
    const idxOpcoes = ultimaRespostaAssistente.search(/\n?\s*1\s*-\s*/i);
    const opcoesNovamente = idxOpcoes >= 0 ? ultimaRespostaAssistente.slice(idxOpcoes).trim() : ultimaRespostaAssistente;
    return {
      text: 'Não é uma opção válida. Por favor, escolha novamente.',
      textoPergunta: opcoesNovamente,
      cart: cartAtual.length > 0 ? cartAtual : undefined,
    };
  }

  if (parecePedidoDeProduto) {
    const termo = msgTrim;
    if (termo === '1' || termo === '2') {
      // não fazer busca por "1" ou "2"
    } else {
    const [porCodigo, porDescricao] = await Promise.all([
      consultarEstoque({ codigo: termo }),
      consultarEstoque({ descricao: termo }),
    ]);
    const porId = new Map<string, Produto>();
    [...porCodigo, ...porDescricao].forEach((p) => porId.set(p.id, p));
    const produtosEncontrados = Array.from(porId.values());
    if (produtosEncontrados.length === 0) {
      const textoSemResultado = `Pesquisando por "${termo}" não encontramos nenhum resultado no nosso estoque. É possível que você tenha digitado o código ou descrição incorretamente.`;
      return {
        text: textoSemResultado,
        textoPergunta: 'Qual é o produto que devo procurar?',
        cart: cartAtual.length > 0 ? cartAtual : undefined,
      };
    } else {
      produtosRetorno = produtosEncontrados;
      return {
        text: 'Produtos encontrados.',
        textoPergunta: '1 - Incluir produto no pedido\n2 - Procurar por outro produto',
        produtos: produtosEncontrados,
        cart: cartAtual.length > 0 ? cartAtual : undefined,
      };
    }
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

  const out: ChatResponse = { text };
  if (produtosRetorno?.length) out.produtos = produtosRetorno;
  if (cartAtual.length > 0 || clearCart || cartAddMatches.length > 0) out.cart = cartAtual;
  if (clearCart) out.clearCart = true;
  return out;
}
