# Se o chat der "Erro ao processar" ou erro de API

O chat usa a **API do Google Gemini**. Se aparecer erro ao enviar mensagem (ex.: "oi"), confira:

## 1. Arquivo .env.local

Na pasta do projeto deve existir o arquivo **.env.local** com uma linha assim:

```
GEMINI_API_KEY=sua_chave_aqui
```

Não use aspas; não deixe espaço antes ou depois do `=`.

## 2. Gerar uma chave

1. Acesse: **https://aistudio.google.com/apikey**
2. Faça login com sua conta Google.
3. Clique em **"Create API key"** (ou "Get API key").
4. Copie a chave e cole no **.env.local** na variável **GEMINI_API_KEY**.

## 3. Reiniciar o servidor

Depois de alterar o .env.local:

1. Pare o servidor (Ctrl+C no terminal ou feche a janela do INICIAR-CHAT.bat).
2. Inicie de novo: **npm run dev** ou duplo clique em **INICIAR-CHAT.bat**.
3. Abra de novo **http://localhost:3000** e teste o chat.

## 4. Se ainda der erro

A partir de agora a mensagem de erro no chat deve ser mais clara (ex.: "Chave do Gemini inválida..."). Se aparecer outra mensagem, anote e use para buscar a solução ou pedir ajuda.
