-- Tabela Vocabulario: termos que são "produto". A busca usa só palavras que estão aqui.
-- Ex.: "preciso de guia de nylon com 62" → busca só "guia" e "nylon" (e 62 como medida).
-- Estrutura: ID varchar(50), Descricao varchar(100)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Vocabulario')
BEGIN
  CREATE TABLE Vocabulario (
    ID        VARCHAR(50)  NOT NULL PRIMARY KEY,
    Descricao VARCHAR(100) NOT NULL
  );
END
GO

-- Exemplos: cadastre aqui os termos de produto (guia, nylon, anel, oring, retentor, etc.)
-- INSERT INTO Vocabulario (ID, Descricao) VALUES ('GUIA', 'Guia');
-- INSERT INTO Vocabulario (ID, Descricao) VALUES ('NYLON', 'Nylon');
-- INSERT INTO Vocabulario (ID, Descricao) VALUES ('ANEL', 'Anel');
-- INSERT INTO Vocabulario (ID, Descricao) VALUES ('ORING', 'O-Ring');
-- INSERT INTO Vocabulario (ID, Descricao) VALUES ('RETENTOR', 'Retentor');
-- INSERT INTO Vocabulario (ID, Descricao) VALUES ('GAXETA', 'Gaxeta');
