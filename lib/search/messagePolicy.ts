import type { SearchPlan } from './types';

export function buildClarifyingQuestion(plan: SearchPlan): string | null {
  if (!plan.needsClarification) return null;
  if (plan.clarifyingQuestion && plan.clarifyingQuestion.trim()) return plan.clarifyingQuestion;

  switch (plan.intent.productType) {
    case 'ORING':
      return 'Essa medida parece ser o DI (diâmetro interno). Você sabe também a seção/espessura? Ex.: 28 x 3,53';
    case 'RETENTOR':
      return 'Normalmente o retentor vem em 3 medidas (DI x DE x altura). Você sabe as outras duas medidas? Ex.: 110 x 130 x 13';
    case 'GAXETA':
    case 'ANEL':
    case 'JUNTA':
      return 'Você consegue me passar as medidas (ex.: DI x seção) ou onde vai aplicar (eixo/pistão/haste)?';
    default:
      return 'Você consegue me passar mais detalhes (tipo de vedação e medidas)?';
  }
}

export function buildSearchIntro(): string {
  return 'Beleza — vou procurar isso pra você.';
}

