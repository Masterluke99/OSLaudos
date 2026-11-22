# Acqua TEC — Sistema de laudos

Aplicação local para cadastro de clientes, importação de medições de qualidade da água em CSV e geração de laudos em PDF/ZIP.

## Requisitos

- Python 3
- Navegador moderno
- Conexão com a internet para carregar jsPDF e JSZip pelas CDNs

O backend usa a biblioteca padrão do Python e SQLite. Para assinatura digital, instale também os pacotes descritos em `requirements-sign.txt`.

## Iniciar no Windows

Na pasta do projeto, execute:

```powershell
py backend\app.py
```

Ou abra `iniciar_windows.bat`. Acesse [http://127.0.0.1:8765](http://127.0.0.1:8765).

Para encerrar, pressione `Ctrl+C` no terminal em que o servidor está rodando.

## Executável portátil

Na pasta `dist\AcquaTEC`, execute `AcquaTEC.exe`. O navegador será aberto automaticamente em
`http://127.0.0.1:8765`.

O banco SQLite e os arquivos de certificado dessa versão ficam dentro da própria pasta `dist\AcquaTEC\dados`.
Mantenha a pasta completa ao copiar ou instalar o sistema em outro computador. Para encerrar o
servidor local, feche a janela do terminal exibida pelo executável.

## Assinatura digital em lote

O gerador pode assinar cada PDF antes de montá-lo no ZIP. Marque **Assinar PDFs com certificado digital** na etapa de geração.

No menu lateral, a opção **Certificado digital** abre a pasta privada usada pelo sistema. Pela pasta, adicione ou substitua `certificado.pfx` e `config.json` manualmente.

Ao abrir essa opção, o sistema verifica automaticamente se o PFX e o arquivo de configuração estão presentes e exibe o estado na própria tela.

Instale as dependências de assinatura:

```powershell
py -3 -m pip install -r requirements-sign.txt
```

Configure o certificado em uma máquina privada:

1. Crie `dados\certificados\`.
2. Copie o certificado A1 como `dados\certificados\certificado.pfx`.
3. Crie `dados\certificados\config.json` com o formato:

```json
{
  "password": "SENHA_DO_CERTIFICADO"
}
```

A pasta `dados/certificados/` é ignorada pelo Git. Nunca envie o PFX ou a configuração de senha para o repositório.

O selo impresso usa a logo do sistema e é centralizado na parte inferior da última página. Ele contém “Assinado digitalmente”, o signatário, o CNPJ, a data/hora e um identificador curto no formato `ACQ-XXXXXXXXXXXX`.

Além do selo visual, o PDF recebe uma assinatura criptográfica ICP-Brasil reconhecida por leitores compatíveis. O selo inclui também um QR Code com o identificador, o nome do arquivo e o SHA-256 do documento antes da assinatura.

O pacote ZIP gerado contém `Validacao_Assinaturas.txt`, com o identificador, o SHA-256 do documento original e o SHA-256 do PDF assinado.

Na tela **Certificado digital**, use **Validar PDF** para conferir um PDF assinado. O sistema informa se o documento possui assinatura, se o conteúdo está íntegro, se a assinatura é válida e se a cadeia do certificado é confiável.

## Iniciar no Linux

```bash
./iniciar_linux.sh
```

Em seguida, acesse [http://127.0.0.1:8765](http://127.0.0.1:8765).

## Executável portátil no Linux

No Linux Mint ou em outra distribuição Linux baseada em Ubuntu/Debian, abra o Terminal na pasta do projeto e execute:

```bash
chmod +x criar_executavel_linux.sh
./criar_executavel_linux.sh
```

Em seguida, execute:

```bash
./dist/AcquaTEC/AcquaTEC
```

O script também copia o programa completo para `~/Desktop/AcquaTEC` e
cria o atalho `AcquaTEC.desktop` na Área de Trabalho. Use esse atalho para
abrir o sistema pelo duplo clique.

O executável Linux deve ser criado e testado no próprio Linux. Um arquivo compilado no Windows não funciona no Linux, e vice-versa.

## Instaladores para distribuição

Os instaladores são gerados no computador de desenvolvimento; quem recebe o instalador não precisa clonar o repositório nem instalar Python.

### Linux (Ubuntu, Debian ou Mint)

Instale `dpkg-dev` na máquina de desenvolvimento e execute `./criar_instalador_linux.sh`. O arquivo `.deb` será criado em `dist/instaladores/`. O usuário final pode abrir o arquivo para instalar ou executar:

```bash
sudo apt install ./dist/instaladores/acquatec_1.0.0_amd64.deb
```

O programa aparece no menu de aplicativos como **AcquaTEC**. O pacote deve ser compilado no Linux e na arquitetura de destino.

### Windows

Na máquina Windows de desenvolvimento, instale Python 3 e Inno Setup 6, adicione `ISCC.exe` ao `PATH` e execute `criar_instalador_windows.bat`. O arquivo `dist\instaladores\AcquaTEC-Setup.exe` é o instalador para os demais computadores Windows.

Os instaladores incluem o programa e as dependências Python. Os dados ficam no perfil do usuário e não são incluídos nos instaladores: o banco de cada computador é criado na primeira execução. Por segurança, certificados digitais e senhas também não são empacotados; configure-os separadamente em **Certificado digital** em cada computador.

Cada instalador é nativo da plataforma: gere o `.deb` no Linux e o `.exe` no Windows. A geração do PDF e do ZIP ainda carrega jsPDF e JSZip de CDNs e, portanto, precisa de conexão com a internet.

## Fluxo de uso

1. Cadastre os clientes na seção **Clientes** ou importe o cadastro CSV. Para gerar contratos, preencha também o representante legal e seu CPF.
2. Em **Gerador de laudos**, selecione o CSV das medições e informe o período mensal, se necessário.
3. Clique em **Importar CSV e conferir medições**.
4. Confira e corrija os vínculos entre as linhas do CSV e os clientes.
5. Clique em **Salvar medições no SQLite** para acrescentar as medições ao histórico.
6. Gere e baixe os laudos em PDF/ZIP.

Na seção **Contratos**, selecione um cliente e informe o registro profissional, as datas de vigência, os valores, o dia e a forma de pagamento. O contrato é individual, segue as 12 cláusulas do modelo fornecido e usa o foro da Comarca de Marília/SP.

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

O banco SQLite é criado em `dados\acquatec.db` no Windows (ou `dados/acquatec.db` no Linux). Ele contém clientes, medições e registros de importação. O banco e seus arquivos auxiliares estão excluídos do Git. A exportação JSON da seção **Dados e backup** inclui clientes, medições e registros de importação. A restauração substitui esses dados pelo conteúdo do arquivo selecionado.

O cadastro de clientes também guarda o representante legal e o CPF usados como signatário nos contratos. Esses campos são incluídos nos backups e na exportação CSV de clientes.

Cada arquivo CSV recebe uma assinatura SHA-256 no momento da importação. Uma nova tentativa com o mesmo conteúdo é recusada pelo servidor, evitando lotes e medições duplicados.

O histórico de geração de PDFs ainda é salvo no armazenamento local do navegador. Não há sincronização entre computadores nem acesso multiusuário.

## API local

- `GET /api/clients` — lista clientes
- `PUT /api/clients` — substitui a lista de clientes
- `GET /api/measurements` — lista medições
- `GET /api/measurements?year=2026&month=11` — filtra medições por ano e mês
- `GET /api/measurements?client=<id>` — filtra por cliente
- `POST /api/measurements` — grava um lote de medições
- `GET /api/measurement-imports` — lista lotes importados
- `POST /api/restore` — substitui os dados cadastrados pelos dados de um backup completo
- `POST /api/sign-pdfs` — assina em lote os PDFs enviados no corpo da requisição
- `POST /api/verify-pdf` — verifica integridade, validade e confiança das assinaturas embutidas em um PDF
- `GET /api/certificate-status` — informa se o PFX e a configuração estão presentes
- `POST /api/open-certificate-folder` — abre a pasta privada do certificado no Explorador de Arquivos

Os filtros de histórico estão disponíveis pela API; a tela de dashboards e seleção de períodos ainda não está implementada.

## Arquivos principais

```text
Acquatec_laudos_sqlite.html  Interface do sistema
script.js                    Importação, vínculos e geração dos PDFs
contracts.js                 Geração individual de contratos PDF
css/style.css                Estilos da interface
backend/app.py               Servidor HTTP e API local
backend/database.py          Inicialização e migração do SQLite
iniciar_windows.bat          Inicialização no Windows
iniciar_linux.sh             Inicialização no Linux
```
