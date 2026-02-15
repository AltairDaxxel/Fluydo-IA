# Como instalar o Node.js (e o npm) no Windows

O **npm** vem junto com o **Node.js**. Siga estes passos:

## 1. Baixar o Node.js

1. Acesse: **https://nodejs.org**
2. Baixe a versão **LTS** (recomendada) — botão verde.
3. Execute o instalador (`.msi`).

## 2. Durante a instalação

- Marque a opção **"Add to PATH"** (adicionar ao PATH), se aparecer.
- Conclua a instalação (Next até Finish).

## 3. Fechar e abrir o terminal de novo

- Feche **todos** os CMD ou PowerShell abertos.
- Abra um **novo** Prompt de Comando (ou novo terminal no Cursor).

## 4. Testar

No **novo** terminal, digite:

```cmd
node -v
npm -v
```

Se aparecer um número de versão (ex.: `v20.10.0` e `10.2.0`), está certo.

## 5. Rodar o projeto

```cmd
cd c:\Dropbox\Dados\Altair\Fluydo-IA
npm install
npm run serve
```

Ou, para o chat completo:

```cmd
npm run dev
```

---

**Se ainda der "npm não é reconhecido" depois de instalar:**

- Reinicie o computador (o PATH às vezes só atualiza após reiniciar).
- Ou use o **"Node.js Command Prompt"** que é instalado junto com o Node (procure no Menu Iniciar por "Node.js").
