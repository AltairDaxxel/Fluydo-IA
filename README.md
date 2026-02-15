# Fluydo.AI

## Configuração

1. Instale as dependências:
   ```bash
   npm install
   ```

2. A chave do Gemini fica em **`.env.local`** (já criado com `GEMINI_API_KEY`). Esse arquivo está no `.gitignore` — **nunca faça commit da chave**. Se a chave tiver sido exposta, gere uma nova em [Google AI Studio](https://aistudio.google.com/apikey).

3. Suba o projeto:
   - **Chat completo (Next.js + API):** `npm run dev` → abra **http://localhost:3000**
   - **Só o index.html com F5 sempre atualizando:** `npm run serve` → abra **http://localhost:3080/index.html**  
     (Esse servidor envia as páginas com headers que impedem cache; F5 e Ctrl+F5 passam a carregar a versão mais recente.)

## Testar as interfaces (tipagem)

```bash
npm run typecheck
```

Se não houver erros, as interfaces **Loja**, **Produto** e **Pedido** estão corretas. O script `scripts/check-types.ts` é usado só para validação pelo TypeScript.
