# "A conexão com localhost foi recusada"

Isso significa que **nada está rodando na porta 3000**. O servidor do chat precisa estar ligado antes de abrir o navegador.

## Forma mais fácil: usar o atalho

1. Na pasta do projeto **Fluydo-IA**, dê **duplo clique** em **INICIAR-CHAT.bat**
2. Espere aparecer no terminal: **"Ready"** ou **"compiled successfully"**
3. Aí sim abra no navegador: **http://localhost:3000**

Não feche a janela do terminal enquanto estiver usando o chat.

---

## Se preferir usar o CMD

1. Abra o **CMD** e digite:
   ```cmd
   cd C:\Dropbox\Dados\Altair\Fluydo-IA
   ```

2. Se ainda não instalou as dependências:
   ```cmd
   npm install
   ```
   (Só precisa fazer uma vez.)

3. Suba o servidor:
   ```cmd
   npm run dev
   ```

4. **Espere** aparecer algo como:
   ```
   ▲ Next.js 14.x.x
   - Local: http://localhost:3000
   ✓ Ready in 2s
   ```

5. **Só então** abra no navegador: **http://localhost:3000**

---

## Se der erro ao rodar `npm run dev`

- **"next não é reconhecido"** → Rode antes: `npm install`
- **"EBUSY"** → Feche o Cursor e qualquer outra janela que use a pasta do projeto; tente de novo.
- **Porta 3000 em uso** → Outro programa pode estar usando. Feche outros servidores ou reinicie o PC e tente de novo.

Resumo: a mensagem "conexão recusada" aparece quando você abre o navegador **antes** do servidor estar rodando. Sempre inicie o servidor (INICIAR-CHAT.bat ou `npm run dev`) e **só depois** acesse http://localhost:3000.
