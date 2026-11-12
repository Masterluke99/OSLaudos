# 💧 Acqua TEC - Sistema Gerador de Laudos

Sistema web desenvolvido para automatizar o gerenciamento de análises de qualidade da água, cadastro de clientes e geração de laudos técnicos em PDF.

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-blue)
![Version](https://img.shields.io/badge/version-1.0-success)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-yellow)
![License](https://img.shields.io/badge/license-Private-red)

---

## 📋 Sobre o Projeto

O Sistema Acqua TEC foi criado para simplificar a rotina operacional de monitoramento da qualidade da água, permitindo:

- Cadastro de clientes
- Importação de dados por CSV
- Associação automática de medições aos clientes
- Geração de laudos técnicos em PDF
- Exportação de múltiplos laudos em arquivo ZIP
- Backup e restauração de dados
- Armazenamento local no navegador

Todo o processamento é realizado no navegador, sem necessidade de servidor ou banco de dados.

---

## 🚀 Funcionalidades

### 👥 Gestão de Clientes

- Cadastro manual
- Edição e exclusão
- Busca rápida
- Importação CSV
- Exportação CSV

### 📊 Importação de Medições

- Leitura de planilhas CSV
- Reconhecimento automático de clientes
- Conferência de vínculos
- Correção manual antes da emissão

### 📄 Geração de Laudos

- Criação automática de PDFs
- Inclusão dos dados do cliente
- Diagnóstico automático dos parâmetros
- Avaliação técnica
- Data da próxima análise

### 📦 Exportação

- Geração de pacote ZIP contendo todos os PDFs
- Histórico local de emissões

### 🔐 Backup

- Exportação da base para JSON
- Restauração completa dos cadastros

---

## 🧪 Parâmetros Avaliados

O sistema realiza análise automática dos seguintes parâmetros:

| Parâmetro | Faixa de Referência |
|------------|-------------------|
| Cloro Livre | 1.0 – 3.0 |
| pH | 7.4 – 7.8 |
| Alcalinidade | 80 – 120 |
| Dureza Cálcica | 200 – 400 |
| Temperatura | 26 – 32 °C |
| Aspecto Visual | Água límpida |

---

## 🖥️ Tecnologias Utilizadas

- HTML5
- CSS3
- JavaScript Vanilla
- LocalStorage
- jsPDF
- JSZip

---

## 📂 Estrutura do Projeto

```text
OSLaudos/
│
├── Acquatec_laudos.html
├── logo.png
└── README.md
```

---

## ⚙️ Como Utilizar

### 1. Clonar o projeto

```bash
git clone https://github.com/Masterluke99/OSLaudos.git
```

### 2. Abrir o sistema

Basta abrir:

```text
Acquatec_laudos.html
```

em qualquer navegador moderno.

---

## 📈 Fluxo de Trabalho

1. Cadastrar clientes
2. Importar medições da semana
3. Conferir vínculos automaticamente gerados
4. Gerar laudos em PDF
5. Baixar pacote ZIP
6. Armazenar histórico e backups

---

## 💾 Armazenamento

Atualmente o sistema utiliza:

```javascript
localStorage
```

para armazenar dados localmente no navegador.

Por isso recomenda-se:

- Fazer backups frequentes
- Exportar os cadastros periodicamente
- Não limpar os dados do navegador sem antes criar uma cópia de segurança

---

## 🏢 Desenvolvido para

**Acqua TEC Análises**

Sistema interno para apoio à emissão de relatórios e monitoramento da qualidade da água.

---

## 👨‍💻 Autor

**Antonio Lukas**

GitHub:
https://github.com/Masterluke99

---

## 📌 Versão

Versão Inicial - Sistema Gerador de Laudos
