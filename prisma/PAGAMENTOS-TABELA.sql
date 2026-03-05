-- Tabela Pagamentos (Codigo | Descricao) por emitente.
-- Execute no SQL Server se a tabela ainda não existir.
-- Ajuste id_emitente conforme sua tabela Emitentes.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Pagamentos')
BEGIN
  CREATE TABLE Pagamentos (
    id          VARCHAR(50)  NOT NULL PRIMARY KEY,
    id_emitente VARCHAR(50)  NOT NULL,
    Codigo      VARCHAR(20)  NOT NULL,
    Descricao   VARCHAR(100) NOT NULL,
    CONSTRAINT FK_Pagamentos_Emitente FOREIGN KEY (id_emitente) REFERENCES Emitentes(id)
  );
END
GO

-- Exemplo de inserção (substitua o id_emitente pelo ID do seu emitente):
-- INSERT INTO Pagamentos (id, id_emitente, Codigo, Descricao) VALUES
--   ('pag1', 'SEU_ID_EMITENTE', 'AV', 'À vista'),
--   ('pag2', 'SEU_ID_EMITENTE', '30DD', '30 dias'),
--   ('pag3', 'SEU_ID_EMITENTE', '2X', '2x 30/60 dias');
