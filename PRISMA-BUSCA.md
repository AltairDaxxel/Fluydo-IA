# Integração Prisma + Busca Inteligente (Fluydo.IA)

## 1. Schema (Prisma)

O arquivo `prisma/schema.prisma` está configurado com:

- **Produto**: ID, Codigo, descricao, dim1–dim4 (Decimal 7,3), Material, Unidade, Aplicacao, Estoque, PrecoUnitario, Ativo
- **Cliente**: ID, CNPJ, CPF, Telefone, e-mail, Senha, Ativo
- **Pedido** e **PedidoItens**: relacionados a Cliente e Produto

O `provider` está como `mysql`. Para PostgreSQL ou SQL Server, altere em `prisma/schema.prisma` e ajuste os tipos `@db.*` se necessário.

## 2. Configuração

1. Instale as dependências e gere o client:
   ```bash
   npm install
   npx prisma generate
   ```

   **Se aparecer o erro "Module not found: Can't resolve '@prisma/client'"** ao compilar:
   ```bash
   npm install @prisma/client
   npx prisma generate
   ```
   No Windows você pode usar o script: `scripts\setup-prisma.bat`  
   Depois reinicie o servidor: `npm run dev`

2. Crie o arquivo `.env.local` na raiz com a URL do banco:
   ```env
   DATABASE_URL="mysql://usuario:senha@localhost:3306/nome_do_banco"
   ```

3. (Opcional) Crie as tabelas no banco:
   ```bash
   npx prisma db push
   ```
   Ou use migrações:
   ```bash
   npx prisma migrate dev --name init
   ```

## 3. API de Busca (`/api/busca`)

- **GET** `/api/busca?q=vedação 50 viton`
- **POST** `/api/busca` com body `{ "mensagem": "vedação 50 viton" }` ou `{ "q": "..." }`

Comportamento:

- **Descrição**: a string é quebrada em palavras; retorna produtos cuja `descricao` contenha **todas** as palavras (em qualquer ordem).
- **Dimensões**: números na busca são interpretados como dim1, dim2 ou dim3, com **tolerância de 10%** (ex.: 50 → 45–55).
- **Material**: termos como Viton, Nitrílica, NBR, EPDM etc. filtram pelo campo `Material`.
- **Filtros fixos**: apenas produtos com `Ativo = 1` e `Estoque > 0`.

## 4. Chat

Quando `DATABASE_URL` está definida, o chat usa essa busca (Prisma) ao procurar produtos. Os resultados aparecem como **cards** no chat (código, descrição, dimensões, material, preço, estoque).

## 5. Interface

- **Saudação**: "Olá, eu sou o Fluydo.IA, assistente virtual."
- **Cores**: Azul `#2B59FF` para destaque; Verde Lima `#D6FF38` para o nome "Fluydo.IA" e ícone de envio.
- **Produtos**: exibidos em cards responsivos (estilo mobile) com as informações acima.
