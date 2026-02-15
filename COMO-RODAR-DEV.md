# Como rodar o chat (npm run dev)

O comando `npm run dev` usa o **Next.js**, que fica dentro do projeto depois de instalar as dependências. Se aparecer **'next' não é reconhecido**, faça o seguinte:

## Passo a passo no CMD

1. Abra o **Prompt de Comando** (cmd).

2. Vá até a pasta do projeto:
   ```cmd
   cd C:\Dropbox\Dados\Altair\Fluydo-IA
   ```

3. **Instale as dependências** (só precisa fazer uma vez):
   ```cmd
   npm install
   ```
   Espere terminar (pode demorar um pouco).

4. Suba o servidor do chat:
   ```cmd
   npm run dev
   ```

5. No navegador, abra: **http://localhost:3000**

A partir daí o chat deve responder (incluindo ao digitar "oi").

---

**Resumo:** o erro acontece quando as dependências não estão instaladas. Sempre rode **`npm install`** na pasta do projeto antes do primeiro **`npm run dev`**.
