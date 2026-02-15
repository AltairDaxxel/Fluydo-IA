/**
 * Busca na web (DuckDuckGo Instant Answer) para enriquecer respostas.
 * Sem API key. Uso moderado.
 */

const DDG_URL = 'https://api.duckduckgo.com/?format=json';

interface DuckDuckGoResult {
  Abstract?: string;
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
}

export async function buscarNaWeb(consulta: string): Promise<string> {
  const query = consulta.trim();
  if (!query || query.length < 3) return '';

  try {
    const res = await fetch(
      `${DDG_URL}&q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return '';
    const data = (await res.json()) as DuckDuckGoResult;
    const partes: string[] = [];
    if (data.AbstractText) {
      partes.push(data.AbstractText);
      if (data.AbstractSource) partes.push(`(Fonte: ${data.AbstractSource})`);
    }
    if (data.RelatedTopics?.length) {
      const textos = data.RelatedTopics
        .slice(0, 3)
        .map((t) => t.Text)
        .filter(Boolean) as string[];
      if (textos.length) partes.push(textos.join(' | '));
    }
    return partes.length ? partes.join('\n') : '';
  } catch {
    return '';
  }
}
