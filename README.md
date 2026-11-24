# Acqua TEC — Sistema local de laudos

Aplicação para cadastrar clientes, importar medições e gerar laudos em PDF/ZIP. Os dados ficam no SQLite deste computador; não há sincronização entre máquinas.

## Iniciar no Windows

1. Instale o Python 3, se ainda não estiver instalado.
2. Dê dois cliques em `iniciar_windows.bat`.
3. Aguarde o navegador abrir em <http://127.0.0.1:8765>.

Não é necessário instalar pacotes Python para o uso básico. Mantenha a janela aberta enquanto usa o sistema; `Ctrl+C` encerra o servidor.

## Uso diário

1. Cadastre os clientes ou importe o cadastro em CSV.
2. Em **Gerador de laudos**, importe o CSV de medições e confira os vínculos com os clientes.
3. Salve as medições no SQLite e gere os laudos.

O CSV de medições precisa ter uma coluna `Cliente`. São aceitos separadores por vírgula, ponto e vírgula ou tabulação. Uma nova importação é acrescentada ao histórico; o mesmo arquivo não pode ser importado duas vezes.

## PDF e ZIP

A geração de PDF/ZIP usa bibliotecas carregadas da internet; é necessária conexão para carregar essas bibliotecas.

## Recursos opcionais

- **Contratos:** gere um contrato individual pela seção **Contratos**. Preencha os dados do representante legal no cadastro do cliente.
- **Assinatura digital:** instale as dependências conforme o sistema:

  - Windows: `py -3 -m pip install -r requirements-sign.txt`.
  - Linux: na pasta do projeto, execute:

    ```bash
    python3 -m venv .venv
    .venv/bin/python -m pip install -r requirements-sign.txt
    ```

    Se `python3 -m venv` não estiver disponível, instale o pacote `python3-venv` pela distribuição Linux e repita os comandos. Depois, inicie o sistema com `bash iniciar_linux.sh`; ele usará o ambiente `.venv`.

  Na seção **Certificado digital**, abra a pasta indicada e coloque nela `certificado.pfx` e `config.json`:

  ```json
  {
    "password": "SENHA_DO_CERTIFICADO"
  }
  ```

  Use **Atualizar status** depois de copiar os arquivos. Nunca compartilhe o certificado nem a senha. Se usar o executável portátil, mantenha os arquivos dentro da pasta `dados\certificados` ao lado do executável; ao executar pelo código-fonte, use `dados\certificados` na pasta do projeto.
- **Executável portátil:** mantenha a pasta `dist\AcquaTEC` completa; o banco e os certificados ficam dentro dela.
- **Instaladores:** os scripts `criar_instalador_windows.bat` e `criar_instalador_linux.sh` permitem gerar pacotes de distribuição. Certificados e senhas não são incluídos nos instaladores.

## Dados e backup

O banco fica em `dados\acquatec.db`. Use **Dados e backup** para exportar ou restaurar os dados. Restaurar um backup substitui os dados atuais. Guarde uma cópia do banco ou exporte um backup regularmente.

## Linux

Na pasta do projeto, execute:

```bash
chmod +x iniciar_linux.sh
./iniciar_linux.sh
```

O sistema abre em <http://127.0.0.1:8765>. O executável Linux deve ser criado e usado no próprio Linux.
