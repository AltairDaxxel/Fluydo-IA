/**
 * Fluydo.IA - Tipos do sistema de ajuda (FluydoAjuda, FluydoAjudaGatilhos, FluydoAjudaExemplos).
 */

export type AjudaArtigo = {
  id: number;
  slug: string;
  titulo: string;
  resumo?: string | null;
  conteudoMd: string;
  tags?: string | null;
  ordem: number;
  ativo: boolean;
  visibilidade: 'publica' | 'interna' | 'admin' | string;
};

export type AjudaGatilho = {
  id: number;
  ajudaId: number;
  padrao: string;
  tipoPadrao: 'contains' | 'startsWith' | 'regex' | string;
  peso: number;
  ativo: boolean;
};

export type AjudaExemplo = {
  id: number;
  ajudaId: number;
  exemplo: string;
  observacao?: string | null;
  ordem: number;
  ativo: boolean;
};

export type AjudaArtigoComExemplos = AjudaArtigo & {
  exemplos: AjudaExemplo[];
};
