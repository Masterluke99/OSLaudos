# Acqua TEC — Sistema de laudos

Aplicação local para cadastro de clientes, importação de medições de qualidade da água em CSV e geração de laudos em PDF/ZIP.

## Requisitos

- Python 3
- Navegador moderno
- Conexão com a internet para carregar jsPDF e JSZip pelas CDNs

O backend usa apenas a biblioteca padrão do Python e SQLite. Não é necessário instalar pacotes Python.

## Iniciar no Windows

Na pasta do projeto, execute:

```powershell
py backend\app.py
```

Ou abra `iniciar_windows.bat`. Acesse [http://127.0.0.1:8765](http://127.0.0.1:8765).

Para encerrar, pressione `Ctrl+C` no terminal em que o servidor está rodando.

## Iniciar no Linux

```bash
./iniciar_linux.sh
```

Em seguida, acesse [http://127.0.0.1:8765](http://127.0.0.1:8765).

## Fluxo de uso

1. Cadastre os clientes na seção **Clientes** ou importe o cadastro CSV.
2. Em **Gerador de laudos**, selecione o CSV das medições e informe o período mensal, se necessário.
3. Clique em **Importar CSV e conferir medições**.
4. Confira e corrija os vínculos entre as linhas do CSV e os clientes.
5. Clique em **Salvar medições no SQLite** para acrescentar as medições ao histórico.
6. Gere e baixe os laudos em PDF/ZIP.

As medições são armazenadas como registros históricos; uma nova importação não substitui os meses anteriores. Evite importar o mesmo arquivo mais de uma vez, pois cada importação cria um novo lote.

## Formato do CSV de medições

O CSV precisa conter uma coluna `Cliente`. As colunas reconhecidas incluem:

- Data: `Carimbo de data/hora`, `Data/Hora`, `Data` ou `Data_Coleta`
- `Cloro Livre`
- `PH` ou `pH`
- `Alcalinidade`
- `Dureza Total` ou `Dureza Cálcica`
- `Temperatura`
- `Aspecto Visual`
- Avaliação: `Avaliação Técnica`, `Observações` ou `Observacao`
- Local: `Local_Coleta`, `Local de Coleta` ou `Ponto_Coleta`

O sistema aceita campos separados por vírgula, ponto e vírgula ou tabulação. As colunas adicionais do CSV também são preservadas com cada medição.

## Dados e backup

O banco SQLite é criado em `dados\acquatec.db` no Windows (ou `dados/acquatec.db` no Linux). Ele contém clientes, medições e registros de importação. O banco e seus arquivos auxiliares estão excluídos do Git. A exportação JSON da seção **Dados e backup** inclui os clientes, mas ainda não as medições; o banco SQLite precisa de uma cópia de segurança separada.

O histórico de geração de PDFs ainda é salvo no armazenamento local do navegador. Não há sincronização entre computadores nem acesso multiusuário.

## API local

- `GET /api/clients` — lista clientes
- `PUT /api/clients` — substitui a lista de clientes
- `GET /api/measurements` — lista medições
- `GET /api/measurements?year=2026&month=11` — filtra medições por ano e mês
- `GET /api/measurements?client=<id>` — filtra por cliente
- `POST /api/measurements` — grava um lote de medições
- `GET /api/measurement-imports` — lista lotes importados

Os filtros de histórico estão disponíveis pela API; a tela de dashboards e seleção de períodos ainda não está implementada.

## Arquivos principais

```text
Acquatec_laudos_sqlite.html  Interface do sistema
script.js                    Importação, vínculos e geração dos PDFs
css/style.css                Estilos da interface
backend/app.py               Servidor HTTP e API local
backend/database.py          Inicialização e migração do SQLite
iniciar_windows.bat          Inicialização no Windows
iniciar_linux.sh             Inicialização no Linux
```
