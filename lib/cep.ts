/**
 * Fluydo.IA - Busca de endereço por CEP (ViaCEP).
 */

const VIACEP_URL = 'https://viacep.com.br/ws';

export interface EnderecoCep {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  cep: string;
}

/** Retorna endereço pelo CEP ou null se não encontrar. */
export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoCep | null> {
  const n = cep.replace(/\D/g, '');
  if (n.length !== 8) return null;
  try {
    const res = await fetch(`${VIACEP_URL}/${n}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string; cep?: string };
    if (data.erro) return null;
    return {
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      localidade: data.localidade ?? '',
      uf: data.uf ?? '',
      cep: (data.cep ?? n).replace(/(\d{5})(\d{3})/, '$1-$2'),
    };
  } catch {
    return null;
  }
}

export function formatarEnderecoParaChat(e: EnderecoCep): string {
  const partes = [e.logradouro, e.bairro, `${e.localidade}/${e.uf}`, e.cep ? `CEP ${e.cep}` : ''].filter(Boolean);
  return partes.join(', ');
}
