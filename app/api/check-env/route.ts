import { NextResponse } from 'next/server';

/**
 * Rota de diagnóstico: indica se GROQ_API_KEY está definida (sem mostrar o valor).
 * Acesse: http://localhost:3000/api/check-env
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.GROQ_API_KEY;
  const definida = Boolean(key && key.trim().length > 0);
  return NextResponse.json({
    GROQ_API_KEY_definida: definida,
    dica: definida
      ? 'Chave carregada. Se o chat ainda falhar, a chave pode estar inválida ou expirada.'
      : 'Crie ou edite o arquivo .env.local com: GROQ_API_KEY=sua_chave',
  });
}
