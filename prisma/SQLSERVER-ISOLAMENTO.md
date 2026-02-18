# Fluydo.IA - SQL Server e Isolamento por ID_Emitente

## Identificação do parceiro por URL

- Rota dinâmica: **fluydo.ia.br/[telefone]** (ex.: fluydo.ia.br/11999998888).
- O sistema consulta a tabela **Emitentes** pelo campo **Telefone** (VarChar 15) e obtém o **ID_Emitente**.
- Se o telefone não for encontrado, é exibida a mensagem: **"Acesso não autorizado"**.
- O **ID_Emitente** obtido é usado como filtro obrigatório em todas as requisições de API (chat e busca).

## Regra de isolamento

Em **todas** as consultas (SELECT) nas tabelas **Produto**, **Cliente**, **Pedido** e **PedidoItens**, o campo **ID_Emitente** deve ser obrigatoriamente incluído no filtro **WHERE**. Nenhuma informação de outro emitente pode ser exibida.

- A busca de produtos (`lib/busca-prisma.ts`) já filtra por `idEmitente`.
- Consultas futuras a Clientes, Pedidos e PedidoItens devem sempre receber e usar `idEmitente` no `where`.

## Schema (SQL Server)

- **provider**: `sqlserver`
- **Emitentes**: tabela com `ID`, `CNPJ_Emitente`, `Telefone` (VarChar 15)
- **Produto**, **Cliente**, **Pedido**, **PedidoItens**: possuem chave estrangeira `ID_Emitente` para **Emitentes**

## Conexão e sincronização

1. **DATABASE_URL** (`.env` ou `.env.local`) para SQL Server, por exemplo:
   ```
   DATABASE_URL="sqlserver://PlanetDaxxel.dyndns.org:1433;database=NomeDoBanco;user=usuario;password=senha;encrypt=true;trustServerCertificate=true"
   ```

2. **Aplicar a coluna Telefone no SQL Server** (se o banco já existir):
   ```bash
   npx prisma db push
   ```

3. **Gerar o cliente Prisma**:
   ```bash
   npx prisma generate
   ```

   Opcional: **Ler o schema do servidor** (refletir tabelas existentes) antes de db push:
   ```bash
   npx prisma db pull
   ```
   Isso sobrescreve o `schema.prisma` com o modelo lido do banco. Ajuste manualmente se precisar (nomes de relação, Telefone em Emitentes, etc.).

4. **Reiniciar o servidor**:
   ```bash
   npm run dev
   ```

## Uso do ID_Emitente nas APIs

- **POST /api/chat**: envie no body `idEmitente` (string) com o ID do emitente da sessão. Sem ele, a busca de produtos não usará o Prisma (usa API/mock externo).
- **GET /api/busca**: use o query param `idEmitente` (ou `id_emitente`).
- **POST /api/busca**: envie no body `idEmitente` (ou `id_emitente`). Sem ele, a API retorna 400.

O frontend deve obter o `idEmitente` da sessão (login) e enviá-lo em todas as chamadas ao chat e à busca.
