# Deploy da estrutura multi-emitente (Fluydo.IA)

## 1. Schema (SQL Server via Prisma)

O `schema.prisma` está configurado com:

- **Tabela Emitentes**: `id` (VarChar 50, PK), `cnpj_emitente` (VarChar 20), `telefone` (VarChar 15).
- **Produto, Cliente, Pedido**: possuem o campo `id_emitente` (VarChar 50) como chave estrangeira para **Emitentes**.
- **PedidoItens**: vinculado a Pedido (isolamento por emitente via Pedido.id_emitente).

## 2. Rota dinâmica e contexto

- **URL:** `www.fluydo.ia.br/[telefone]` (ex.: www.fluydo.ia.br/11999998888).
- Ao carregar a página, o sistema chama **GET /api/emitente?telefone=** e obtém o **id_emitente** correspondente no banco.
- O **id_emitente** é armazenado no **contexto da aplicação** (`EmitenteProvider`) e passado ao chat, para uso em todas as requisições seguintes.

## 3. Filtro de pesquisa

Todas as buscas de produtos (palavras soltas na descrição, material, tolerância de 10% em dim1, dim2, dim3) incluem obrigatoriamente:

```ts
where: { id_emitente: id_identificado, ativo: 1, estoque: { gt: 0 } }
```

em `lib/busca-prisma.ts`. O chat e a API `/api/chat` enviam o `idEmitente` no body; a API `/api/busca` exige o parâmetro `idEmitente`.

## 4. Execução e sincronização

Após alterar os arquivos, execute:

```bash
npx prisma db push
```

Isso cria/atualiza as colunas e tabelas no SQL Server (Emitentes com `id`, `cnpj_emitente`, `telefone`; demais tabelas com `id_emitente`).

Em seguida:

```bash
npx prisma generate
```

para atualizar o cliente Prisma.

Depois reinicie o servidor de desenvolvimento (`npm run dev`) ou o processo em produção.
