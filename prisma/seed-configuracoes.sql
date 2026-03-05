-- Fluydo.IA - Seed da tabela Configuracoes (mensagens do motor de busca)
-- Executar após: npx prisma migrate dev --name add_configuracoes
-- Banco: SQL Server (sintaxe compatível)
--
-- Como executar:
--   SSMS / Azure Data Studio: abra o arquivo e execute.
--   Linha de comando: npx prisma db execute --file prisma/seed-configuracoes.sql
--
-- Se a tabela já tiver essas chaves, use a Opção B (MERGE) em vez da A para atualizar.

-- ========== Opção A: INSERT simples (use quando a tabela estiver vazia) ==========
INSERT INTO Configuracoes (Chave, Valor) VALUES
  (N'msg_comando_ajuda', N'Ainda não há artigos de ajuda cadastrados. Digite o produto ou código que deseja pesquisar.'),
  (N'msg_texto_inicial', N'Ainda não sabe como pesquisar? Digite ajuda ou ? para ver as dicas.' + NCHAR(10) + NCHAR(10) + N'Como posso te ajudar agora?'),
  (N'msg_linha_nao_encontrada', N'A linha procurada não foi encontrada. Verifique o código ou a descrição da linha na tabela Linhas.'),
  (N'msg_linha_indisponivel', N'Essa linha de produto é de venda exclusiva, não está disponível.'),
  (N'msg_sucesso_busca_linha', N'Encontrei {n} produto(s). Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar os produtos ao pedido.'),
  (N'msg_sucesso_busca_codigo', N'Produto(s) encontrado(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.'),
  (N'msg_pedir_especificacoes', N'Para eu encontrar o produto certo, monte a pesquisa assim: use "medida" ou d1/d2/d3/d4 antes das dimensões (ex.: medida 140 170 ou d1 140 d2 170), "perf" antes do perfil (ex.: perf BAG), "mat" antes do material (ex.: mat NBR70) e "apli" antes da aplicação (ex.: apli motor). Exemplo completo: retentor d1 140 d2 170 perf BAG mat NBR70 apli eixo.'),
  (N'msg_sucesso_busca_descricao', N'Encontrei {n} produto(s). Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar os produtos ao pedido.'),
  (N'msg_nenhum_resultado', N'Não encontrei nada com essa busca. Pode tentar com o código, a descrição ou as medidas do produto.');

-- ========== Opção B: MERGE (atualiza se já existir; descomente e comente a Opção A para usar) ==========
/*
MERGE INTO Configuracoes AS target
USING (
  SELECT N'msg_comando_ajuda' AS Chave, N'Ainda não há artigos de ajuda cadastrados. Digite o produto ou código que deseja pesquisar.' AS Valor
  UNION ALL SELECT N'msg_texto_inicial', N'Ainda não sabe como pesquisar? Digite ajuda ou ? para ver as dicas.' + NCHAR(10) + NCHAR(10) + N'Como posso te ajudar agora?'
  UNION ALL SELECT N'msg_linha_nao_encontrada', N'A linha procurada não foi encontrada. Verifique o código ou a descrição da linha na tabela Linhas.'
  UNION ALL SELECT N'msg_linha_indisponivel', N'Essa linha de produto é de venda exclusiva, não está disponível.'
  UNION ALL SELECT N'msg_sucesso_busca_linha', N'Encontrei {n} produto(s). Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar os produtos ao pedido.'
  UNION ALL SELECT N'msg_sucesso_busca_codigo', N'Produto(s) encontrado(s). Informe as quantidades e digite "pedir" para adicionar ao pedido.'
  UNION ALL SELECT N'msg_pedir_especificacoes', N'Para eu encontrar o produto certo, monte a pesquisa assim: use "medida" ou d1/d2/d3/d4 antes das dimensões (ex.: medida 140 170 ou d1 140 d2 170), "perf" antes do perfil (ex.: perf BAG), "mat" antes do material (ex.: mat NBR70) e "apli" antes da aplicação (ex.: apli motor). Exemplo completo: retentor d1 140 d2 170 perf BAG mat NBR70 apli eixo.'
  UNION ALL SELECT N'msg_sucesso_busca_descricao', N'Encontrei {n} produto(s). Informe as quantidades dos produtos desejados, e ao final digite "pedir" para adicionar os produtos ao pedido.'
  UNION ALL SELECT N'msg_nenhum_resultado', N'Não encontrei nada com essa busca. Pode tentar com o código, a descrição ou as medidas do produto.'
) AS source (Chave, Valor)
ON target.Chave = source.Chave
WHEN MATCHED THEN
  UPDATE SET Valor = source.Valor
WHEN NOT MATCHED BY TARGET THEN
  INSERT (Chave, Valor) VALUES (source.Chave, source.Valor);
*/
