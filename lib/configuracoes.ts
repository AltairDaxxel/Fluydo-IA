/**
 * Fluydo.IA - Leitura de mensagens e textos na tabela Configurações.
 * Zero hardcoding: todas as respostas de texto do motor de busca devem vir daqui.
 */

import { prisma } from './prisma';

/** Chaves conhecidas (usadas pelo motor de busca e comandos) */
export const CONFIG_KEYS = {
  /** Mensagem quando comando é ajuda ou ? (sem artigo cadastrado) */
  MSG_COMANDO_AJUDA: 'msg_comando_ajuda',
  /** Texto inicial / voltar ao menu */
  MSG_TEXTO_INICIAL: 'msg_texto_inicial',
  /** Linha não encontrada na tabela Linhas */
  MSG_LINHA_NAO_ENCONTRADA: 'msg_linha_nao_encontrada',
  /** Linha bloqueada/exclusiva */
  MSG_LINHA_INDISPONIVEL: 'msg_linha_indisponivel',
  /** Sucesso ao listar produtos por linha */
  MSG_SUCESSO_BUSCA_LINHA: 'msg_sucesso_busca_linha',
  /** Sucesso ao encontrar produto(s) por código */
  MSG_SUCESSO_BUSCA_CODIGO: 'msg_sucesso_busca_codigo',
  /** Pedir especificações (só nome do produto, sem dimensões/material) */
  MSG_PEDIR_ESPECIFICACOES: 'msg_pedir_especificacoes',
  /** Sucesso na busca por descrição */
  MSG_SUCESSO_BUSCA_DESCRICAO: 'msg_sucesso_busca_descricao',
  /** Nenhum resultado encontrado */
  MSG_NENHUM_RESULTADO: 'msg_nenhum_resultado',
} as const;

const FALLBACKS: Record<string, string> = {
  [CONFIG_KEYS.MSG_COMANDO_AJUDA]: 'Ainda não há artigos de ajuda cadastrados. Digite o produto ou código que deseja pesquisar.',
  [CONFIG_KEYS.MSG_TEXTO_INICIAL]: 'Ainda não sabe como pesquisar? Digite ajuda ou ? para ver as dicas.\n\nComo posso te ajudar agora?',
  [CONFIG_KEYS.MSG_LINHA_INDISPONIVEL]: 'Essa linha de produto é de venda exclusiva, não está disponível.',
  [CONFIG_KEYS.MSG_LINHA_NAO_ENCONTRADA]: 'A linha procurada não foi encontrada. Verifique o código ou a descrição da linha na tabela Linhas.',
  [CONFIG_KEYS.MSG_SUCESSO_BUSCA_LINHA]: 'Encontrei {n} produto(s). Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar os produtos ao pedido.',
  [CONFIG_KEYS.MSG_SUCESSO_BUSCA_CODIGO]: 'Produto(s) encontrado(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.',
  [CONFIG_KEYS.MSG_PEDIR_ESPECIFICACOES]: 'Para eu encontrar o produto certo, monte a pesquisa assim: use "medida" antes das dimensões (ex.: medida 140 170), "perf" antes do perfil (ex.: perf BAG) e "mat" antes do material ou dureza (ex.: mat NBR70). Você pode combinar com o nome do produto, por exemplo: retentor medida 140 170 perf BAG mat NBR70.',
  [CONFIG_KEYS.MSG_SUCESSO_BUSCA_DESCRICAO]: 'Encontrei {n} produto(s). Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar os produtos ao pedido.',
  [CONFIG_KEYS.MSG_NENHUM_RESULTADO]: 'Não encontrei nada com essa busca. Pode tentar com o código, a descrição ou as medidas do produto.',
};

/**
 * Retorna o valor da configuração pela chave.
 * Se a tabela não existir ou a chave não estiver cadastrada, retorna fallback (para não quebrar o fluxo).
 */
export async function getConfig(chave: string): Promise<string | null> {
  try {
    const row = await prisma.configuracao.findUnique({
      where: { id: chave },
      select: { valor: true },
    });
    if (row && row.valor != null && String(row.valor).trim()) return String(row.valor).trim();
  } catch (err) {
    console.warn('[configuracoes] getConfig:', chave, err);
  }
  return FALLBACKS[chave] ?? null;
}
