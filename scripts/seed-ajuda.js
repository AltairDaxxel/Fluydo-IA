/**
 * Fluydo.IA - Seed das tabelas FluydoAjuda, FluydoAjudaGatilhos, FluydoAjudaExemplos.
 * Execute: node scripts/seed-ajuda.js
 * Requer DATABASE_URL no .env.local
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Limpando tabelas de ajuda (ordem: exemplos, gatilhos, ajuda)...');
  await prisma.fluydoAjudaExemplo.deleteMany({});
  await prisma.fluydoAjudaGatilho.deleteMany({});
  await prisma.fluydoAjuda.deleteMany({});

  console.log('Inserindo artigos em FluydoAjuda...');

  const ajudaComandos = await prisma.fluydoAjuda.create({
    data: {
      slug: 'comandos',
      titulo: 'Comandos do Fluydo',
      resumo: 'Lista de comandos de texto para navegar, ver pedido, ajuda e busca.',
      conteudoMd: `## Comandos principais

- **menu** / **voltar** — Volta ao menu principal
- **ajuda** / **?** — Abre esta ajuda (tópicos ou artigo por slug)
- **ver pedido** — Mostra o pedido atual
- **finalizar pedido** — Inicia o fechamento (confirme e informe CPF/CNPJ)
- **excluir pedido** — Exclui todo o pedido
- **alterar pedido** — Altera itens ou quantidades do pedido
- **incluir no pedido** / **pedir** — Inclui os itens marcados na tabela de resultados no carrinho
- **buscar produto** / **outro produto** — Pergunta qual produto procurar
- **linha X** — Busca produtos cujo código começa com X (ex.: linha VD)
- **medida** + números — Filtra busca por dimensões (ex.: retentor medida 130)
- **baixar pdf** / **pdf** — Gera PDF da última tabela de resultados

Para ver um tópico específico, digite **ajuda:slug** (ex.: ajuda:pedido, ajuda:busca).`,
      tags: 'comandos,menu,ajuda,pedido',
      ordem: 10,
      ativo: 1,
      visibilidade: 'publica',
    },
  });

  const ajudaMenu = await prisma.fluydoAjuda.create({
    data: {
      slug: 'menu',
      titulo: 'Menu e navegação',
      resumo: 'Como voltar ao menu principal.',
      conteudoMd: `## Menu e voltar

Digite **menu**, **voltar** ou **voltar ao menu** a qualquer momento para ver de novo as dicas iniciais e a pergunta "Como posso te ajudar agora?".`,
      tags: 'menu,voltar,navegação',
      ordem: 20,
      ativo: 1,
      visibilidade: 'publica',
    },
  });

  const ajudaAjuda = await prisma.fluydoAjuda.create({
    data: {
      slug: 'ajuda',
      titulo: 'Como usar a ajuda',
      resumo: 'Abrir ajuda e ver artigos por slug.',
      conteudoMd: `## Ajuda

- Digite **ajuda**, **?**, **help**, **como usar**, **manual** ou **instruções** para abrir a lista de tópicos.
- Para ir direto a um tópico: **ajuda:slug** ou **ver ajuda slug** (ex.: ajuda:pedido, ver ajuda buscar).`,
      tags: 'ajuda,help,manual',
      ordem: 30,
      ativo: 1,
      visibilidade: 'publica',
    },
  });

  const ajudaPedido = await prisma.fluydoAjuda.create({
    data: {
      slug: 'pedido',
      titulo: 'Ver e gerenciar pedido',
      resumo: 'Ver pedido, finalizar, excluir e alterar itens.',
      conteudoMd: `## Pedido e carrinho

- **ver pedido** / **pedido** / **ver** — Mostra os itens do pedido atual. Se não houver itens, exibe "Não há pedido pendente."
- **finalizar pedido** ou **fechar pedido** — Mostra o pedido para conferência e orienta a confirmar; em seguida peça CPF ou CNPJ para concluir.
- **excluir pedido** — Pergunta se deseja excluir todo o pedido. Responda "sim" para confirmar.
- **alterar pedido** — Permite mudar quantidade ou remover itens (fluxo guiado).
- **incluir no pedido** ou **pedir** — Depois de marcar itens e quantidades na tabela de resultados, inclui no carrinho. Se faltar quantidade, o Fluydo pergunta.`,
      tags: 'pedido,carrinho,finalizar,excluir,alterar',
      ordem: 40,
      ativo: 1,
      visibilidade: 'publica',
    },
  });

  const ajudaBusca = await prisma.fluydoAjuda.create({
    data: {
      slug: 'busca',
      titulo: 'Buscar produtos',
      resumo: 'Como pesquisar por código, linha ou medida.',
      conteudoMd: `## Busca de produtos

- **buscar produto** / **outro produto** / **procurar outro** — O Fluydo pergunta: "Qual é o produto que devo procurar?"
- **linha X** (ex.: linha VD, linha Case) — Busca produtos cujo **código começa** com as letras informadas. A palavra "linha" deve aparecer na mensagem.
- **medida** ou **com medida** + números — Filtra por dimensões. Ex.: "retentor medida 130", "oring 28 x 3,53". Os números são usados nas colunas de dimensão (dim1, dim2, dim3, dim4).
- Pesquisa livre — Digite código, descrição ou medidas (ex.: oring 28, retentor 110x130x13). A busca usa termos do vocabulário + números + material/dureza.`,
      tags: 'busca,linha,medida,produto',
      ordem: 50,
      ativo: 1,
      visibilidade: 'publica',
    },
  });

  const ajudaPdf = await prisma.fluydoAjuda.create({
    data: {
      slug: 'pdf',
      titulo: 'Baixar PDF',
      resumo: 'Gerar PDF da última tabela de resultados.',
      conteudoMd: `## PDF

Digite **baixar pdf** ou **pdf** para gerar um PDF da **última tabela de resultados** de produtos exibida no chat. Use depois de uma busca que listou produtos.`,
      tags: 'pdf,baixar,exportar',
      ordem: 60,
      ativo: 1,
      visibilidade: 'publica',
    },
  });

  const artigos = [
    { ajuda: ajudaComandos, slug: 'comandos' },
    { ajuda: ajudaMenu, slug: 'menu' },
    { ajuda: ajudaAjuda, slug: 'ajuda' },
    { ajuda: ajudaPedido, slug: 'pedido' },
    { ajuda: ajudaBusca, slug: 'busca' },
    { ajuda: ajudaPdf, slug: 'pdf' },
  ];

  console.log('Inserindo gatilhos em FluydoAjudaGatilhos...');

  const gatilhosPorSlug = {
    comandos: [
      { padrao: 'comandos', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'lista de comandos', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'o que posso digitar', tipoPadrao: 'contains', peso: 4 },
    ],
    menu: [
      { padrao: 'menu', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'voltar', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'voltar ao menu', tipoPadrao: 'contains', peso: 6 },
    ],
    ajuda: [
      { padrao: 'ajuda', tipoPadrao: 'contains', peso: 6 },
      { padrao: 'help', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'como usar', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'como faco', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'como faz', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'manual', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'instrucoes', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'instruções', tipoPadrao: 'contains', peso: 5 },
    ],
    pedido: [
      { padrao: 'ver pedido', tipoPadrao: 'contains', peso: 6 },
      { padrao: 'pedido', tipoPadrao: 'contains', peso: 3 },
      { padrao: 'finalizar pedido', tipoPadrao: 'contains', peso: 6 },
      { padrao: 'fechar pedido', tipoPadrao: 'contains', peso: 6 },
      { padrao: 'excluir pedido', tipoPadrao: 'contains', peso: 6 },
      { padrao: 'alterar pedido', tipoPadrao: 'contains', peso: 6 },
      { padrao: 'incluir no pedido', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'pedir', tipoPadrao: 'contains', peso: 4 },
      { padrao: 'carrinho', tipoPadrao: 'contains', peso: 3 },
    ],
    busca: [
      { padrao: 'buscar produto', tipoPadrao: 'contains', peso: 6 },
      { padrao: 'buscar produtos', tipoPadrao: 'contains', peso: 6 },
      { padrao: 'procurar produto', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'outro produto', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'linha ', tipoPadrao: 'startsWith', peso: 5 },
      { padrao: 'medida', tipoPadrao: 'contains', peso: 4 },
      { padrao: 'com medida', tipoPadrao: 'contains', peso: 5 },
      { padrao: 'como pesquisar', tipoPadrao: 'contains', peso: 5 },
    ],
    pdf: [
      { padrao: 'baixar pdf', tipoPadrao: 'contains', peso: 6 },
      { padrao: 'pdf', tipoPadrao: 'contains', peso: 4 },
      { padrao: 'exportar', tipoPadrao: 'contains', peso: 3 },
    ],
  };

  for (const { ajuda, slug } of artigos) {
    const lista = gatilhosPorSlug[slug];
    if (lista) {
      for (const g of lista) {
        await prisma.fluydoAjudaGatilho.create({
          data: { ajudaId: ajuda.id, padrao: g.padrao, tipoPadrao: g.tipoPadrao, peso: g.peso, ativo: 1 },
        });
      }
    }
  }

  console.log('Inserindo exemplos em FluydoAjudaExemplos...');

  const exemplosPorSlug = {
    comandos: [
      { exemplo: 'menu', observacao: 'Volta ao menu principal', ordem: 1 },
      { exemplo: 'ajuda', observacao: 'Abre a ajuda', ordem: 2 },
      { exemplo: 'ver pedido', observacao: 'Mostra o pedido atual', ordem: 3 },
      { exemplo: 'pedir', observacao: 'Inclui itens marcados no carrinho', ordem: 4 },
    ],
    menu: [
      { exemplo: 'menu', observacao: 'Exibe novamente as dicas iniciais', ordem: 1 },
      { exemplo: 'voltar ao menu', observacao: 'Mesmo efeito que menu', ordem: 2 },
    ],
    ajuda: [
      { exemplo: 'ajuda', observacao: 'Lista tópicos de ajuda', ordem: 1 },
      { exemplo: 'ajuda:pedido', observacao: 'Abre direto o artigo "pedido"', ordem: 2 },
      { exemplo: 'ver ajuda busca', observacao: 'Abre o artigo "busca"', ordem: 3 },
    ],
    pedido: [
      { exemplo: 'ver pedido', observacao: 'Exibe itens e quantidades do carrinho', ordem: 1 },
      { exemplo: 'finalizar pedido', observacao: 'Inicia conclusão; depois informe CPF ou CNPJ', ordem: 2 },
      { exemplo: 'excluir pedido', observacao: 'Remove todo o pedido (confirme com "sim")', ordem: 3 },
      { exemplo: 'alterar pedido', observacao: 'Altera quantidade ou remove itens', ordem: 4 },
      { exemplo: 'incluir no pedido', observacao: 'Após marcar itens na tabela, inclui no carrinho', ordem: 5 },
    ],
    busca: [
      { exemplo: 'retentor 110', observacao: 'Busca por descrição + número', ordem: 1 },
      { exemplo: 'linha VD', observacao: 'Produtos cujo código começa com VD', ordem: 2 },
      { exemplo: 'oring medida 28 x 3,53', observacao: 'Filtra por dimensões DI e seção', ordem: 3 },
      { exemplo: 'buscar produto', observacao: 'Pergunta qual produto procurar', ordem: 4 },
    ],
    pdf: [
      { exemplo: 'baixar pdf', observacao: 'Gera PDF da última tabela de resultados', ordem: 1 },
      { exemplo: 'pdf', observacao: 'Mesmo que "baixar pdf"', ordem: 2 },
    ],
  };

  for (const { ajuda, slug } of artigos) {
    const lista = exemplosPorSlug[slug];
    if (lista) {
      for (const ex of lista) {
        await prisma.fluydoAjudaExemplo.create({
          data: { ajudaId: ajuda.id, exemplo: ex.exemplo, observacao: ex.observacao, ordem: ex.ordem, ativo: 1 },
        });
      }
    }
  }

  console.log('Seed concluído: FluydoAjuda, FluydoAjudaGatilhos e FluydoAjudaExemplos preenchidos.');
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
