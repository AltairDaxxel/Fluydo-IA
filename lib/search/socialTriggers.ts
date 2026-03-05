/**
 * Fluydo.IA - Filtro de Intercorrência Social (Gatilhos Sociais).
 * Antes de buscar produtos, verifica se a mensagem é saudação, cortesia ou gratidão.
 * Se for, retorna resposta social em vez de buscar no estoque.
 * Manutenção: edite a lista GATILHOS_PADRAO abaixo.
 */

export type CategoriaGatilho = 'saudacao' | 'cortesia' | 'gratidao' | 'busca';

export interface GatilhoSocial {
  termo: string;
  categoria: CategoriaGatilho;
}

/** Lista de gatilhos sociais – edite aqui para incluir ou alterar termos */
const GATILHOS_PADRAO: GatilhoSocial[] = [
  { termo: 'oi', categoria: 'saudacao' },
  { termo: 'olá', categoria: 'saudacao' },
  { termo: 'ola', categoria: 'saudacao' },
  { termo: 'bom dia', categoria: 'saudacao' },
  { termo: 'boa tarde', categoria: 'saudacao' },
  { termo: 'boa noite', categoria: 'saudacao' },
  { termo: 'e aí', categoria: 'saudacao' },
  { termo: 'eai', categoria: 'saudacao' },
  { termo: 'opa', categoria: 'saudacao' },
  { termo: 'hey', categoria: 'saudacao' },
  { termo: 'oii', categoria: 'saudacao' },
  { termo: 'oie', categoria: 'saudacao' },
  { termo: 'tudo bem', categoria: 'cortesia' },
  { termo: 'tudo bom', categoria: 'cortesia' },
  { termo: 'como vai', categoria: 'cortesia' },
  { termo: 'como está', categoria: 'cortesia' },
  { termo: 'tudo certo', categoria: 'cortesia' },
  { termo: 'blz', categoria: 'cortesia' },
  { termo: 'beleza', categoria: 'cortesia' },
  { termo: 'obrigado', categoria: 'gratidao' },
  { termo: 'obrigada', categoria: 'gratidao' },
  { termo: 'valeu', categoria: 'gratidao' },
  { termo: 'obrigadão', categoria: 'gratidao' },
  { termo: 'obrigadao', categoria: 'gratidao' },
  { termo: 'valeu mesmo', categoria: 'gratidao' },
  // Busca: usuário quer procurar outro produto → pergunta o que procurar (sem buscar no estoque)
  { termo: 'outro produto', categoria: 'busca' },
  { termo: 'outros produtos', categoria: 'busca' },
  { termo: 'buscar produto', categoria: 'busca' },
  { termo: 'buscar produtos', categoria: 'busca' },
  { termo: 'procurar produto', categoria: 'busca' },
  { termo: 'procurar produtos', categoria: 'busca' },
  { termo: 'procurar outro', categoria: 'busca' },
  { termo: 'quero outro produto', categoria: 'busca' },
  { termo: 'quero outro', categoria: 'busca' },
  { termo: 'outro item', categoria: 'busca' },
  { termo: 'outros itens', categoria: 'busca' },
  { termo: 'adicionar outro', categoria: 'busca' },
  { termo: 'incluir outro', categoria: 'busca' },
];

function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\u0300-\u036f/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export interface SocialResponse {
  text: string;
  textoPergunta?: string;
}

/**
 * Verifica se a mensagem corresponde a um gatilho social.
 * Retorna a resposta social ou null se não for social.
 */
export function checkSocialTrigger(mensagem: string): SocialResponse | null {
  const t = normalizar(mensagem);
  if (!t) return null;

  for (const g of GATILHOS_PADRAO) {
    const termoNorm = normalizar(g.termo);
    const matchExato = t === termoNorm || t.startsWith(termoNorm + ' ') || t.startsWith(termoNorm + ',');
    const matchInclusao = t.length > termoNorm.length && t.includes(termoNorm);
    if (matchExato || matchInclusao) {
      return buildSocialResponse(g.categoria, g.termo);
    }
  }
  return null;
}

function buildSocialResponse(categoria: CategoriaGatilho, termo?: string): SocialResponse {
  const perguntaPadrao = 'Em que posso te ajudar?';
  switch (categoria) {
    case 'saudacao': {
      const texto = getRespostaSaudacao(termo || '');
      return {
        text: texto,
        textoPergunta: perguntaPadrao,
      };
    }
    case 'cortesia':
      return {
        text: getRespostaAleatoriaCortesia(),
        textoPergunta: perguntaPadrao,
      };
    case 'gratidao':
      return {
        text: 'Disponha! Precisa de mais alguma coisa?',
      };
    case 'busca':
      return {
        text: 'Qual é o produto que devo procurar?',
      };
  }
}

function getRespostaSaudacao(termo: string): string {
  const t = termo.toLowerCase().trim();
  if (t === 'boa noite') return 'Boa noite!';
  if (t === 'boa tarde') return 'Boa tarde!';
  if (t === 'bom dia') return 'Bom dia!';
  // Saudação genérica (oi, olá, e aí, etc.): responde conforme o horário
  return getSaudacaoPorHorario();
}

function getSaudacaoPorHorario(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia!';
  if (h >= 12 && h < 18) return 'Boa tarde!';
  return 'Boa noite!';
}

function getRespostaAleatoriaCortesia(): string {
  const respostas = ['Tudo ótimo por aqui!', 'Tudo bem!', 'Ótimo!'];
  return respostas[Math.floor(Math.random() * respostas.length)];
}
