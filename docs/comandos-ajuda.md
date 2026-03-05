# Comandos do Fluydo — Lista para tabela de ajuda

Use esta lista para preencher a tabela **FluydoAjuda** (e **FluydoAjudaGatilhos** com os termos que disparam cada artigo).

---

## Navegação e menu

| Comando | O que faz |
|--------|------------|
| **menu** | Volta ao menu principal (dicas iniciais e "Como posso te ajudar agora?") |
| **voltar** | Igual a "menu" — volta ao menu principal |
| **voltar ao menu** | Volta ao menu principal |

---

## Ajuda

| Comando | O que faz |
|--------|------------|
| **ajuda** | Mostra tópicos de ajuda (ou artigo sugerido pelo texto). Conteúdo vem das tabelas FluydoAjuda / FluydoAjudaGatilhos. |
| **?** | Igual a "ajuda" — abre a ajuda |
| **help** | Pedido explícito de ajuda (mesmo fluxo que "ajuda") |
| **como usar** | Pedido explícito de ajuda |
| **como faço** / **como faz** | Pedido explícito de ajuda |
| **manual** | Pedido explícito de ajuda |
| **instruções** | Pedido explícito de ajuda |
| **ajuda:slug** ou **ver ajuda slug** | Abre o artigo de ajuda cujo slug é "slug" (ex.: ajuda:buscar, ver ajuda buscar) |

---

## Pedido e carrinho

| Comando | O que faz |
|--------|------------|
| **ver pedido** | Mostra o pedido atual (itens e quantidades). Se não houver itens: "Não há pedido pendente." |
| **pedido** | Igual a "ver pedido" |
| **ver** | Igual a "ver pedido" |
| **finalizar pedido** ou **finalizar** | Mostra o pedido para conferência e orienta a confirmar e informar CPF/CNPJ. Sem itens: volta ao menu. |
| **fechar pedido** ou **fechar** | Igual a "finalizar pedido" — inicia o fechamento do pedido |
| **excluir pedido** ou **excluir** | Pergunta se deseja excluir o pedido completo. Resposta "sim" remove todos os itens. |
| **alterar pedido** | Permite mudar quantidade ou excluir itens do pedido (fluxo guiado) |
| **incluir no pedido** / **pedir** | Depois de marcar itens e quantidades na tabela de resultados, inclui os itens no carrinho e pergunta quantidades se faltar |
| **incluir outro item** | Sugerido após ver pedido — leva a pesquisar outro produto |

---

## Busca de produtos

| Comando | O que faz |
|--------|------------|
| **buscar produto** / **buscar produtos** | Pergunta: "Qual é o produto que devo procurar?" (não busca no estoque) |
| **procurar produto** / **procurar outro** | Igual — pede que o usuário digite o que quer procurar |
| **outro produto** / **quero outro produto** | Resposta: "Qual é o produto que devo procurar?" |
| **linha X** (ex.: linha VD, linha Case) | Busca produtos cujo código começa com as letras informadas (ex.: VD, Case). "Linha" precisa estar na mensagem. |
| **medida** ou **com medida** + números | Filtra a busca por dimensões. Ex.: "retentor medida 130", "oring 28 x 3,53" — usa números em dim1, dim2, dim3 ou dim4. |
| Pesquisa livre | Código, descrição ou medidas (ex.: oring 28, retentor 110x130x13) — busca na tabela Produtos (termos no Vocabulario + números + material/dureza). |

---

## PDF e arquivos

| Comando | O que faz |
|--------|------------|
| **baixar pdf** ou **pdf** | Gera PDF da última tabela de resultados de produtos exibida no chat. |

---

## Resumo rápido (para um único artigo "Comandos")

- **menu / voltar** → volta ao menu  
- **ajuda / ?** → abre ajuda (tópicos ou artigo por slug)  
- **ver pedido** → mostra o pedido  
- **finalizar pedido** → inicia fechamento (CPF/CNPJ)  
- **excluir pedido** → exclui todo o pedido  
- **alterar pedido** → altera itens ou quantidades  
- **incluir no pedido / pedir** → inclui itens marcados na tabela no carrinho  
- **buscar produto / outro produto** → "Qual é o produto que devo procurar?"  
- **linha X** → busca por início do código  
- **medida + números** → filtra por dimensões  
- **baixar pdf / pdf** → PDF da última tabela de resultados  
