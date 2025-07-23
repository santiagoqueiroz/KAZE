# KAZE

Este repositório contém uma aplicação web simples para gerenciamento de clientes e geração de orçamentos de cortinas e persianas utilizando o Firebase como backend. A seguir está uma descrição de todos os arquivos presentes no projeto.

## Páginas HTML

- **index.html** – Tela de login que autentica o usuário no Firebase e redireciona para o painel principal.
- **painel.html** – Menu principal exibido após o login, com links para todas as outras páginas.
- **cadastrar_cliente.html** – Formulário para cadastro de novos clientes no Firestore.
- **consultar_clientes.html** – Lista todos os clientes salvos e permite exclusão de registros.
- **fazer_orcamento.html** – Página para criar e salvar orçamentos de cortinas/persianas; utiliza os cálculos dos scripts JavaScript.
- **consultar_orcamento.html** – Permite consultar e imprimir um orçamento em aberto de determinado cliente.
- **orcamentos_salvos.html** – Apresenta a lista de orçamentos já finalizados e gravados no Firestore.
- **precos_nomeerrado.html** – Interface administrativa para edição manual das tabelas de preços armazenadas no Firestore.

## Scripts JavaScript

- **main.js** – Arquivo principal. Inicializa o Firebase, faz controle de autenticação e manipula os orçamentos (adicionar itens, calcular totais e salvar).
- **persianas.js** – Funções para carregar preços de persianas do Firestore e calcular o valor conforme dimensões e desconto.
- **cortina.js** – Implementa o cálculo detalhado de cortinas de tecido, obtendo preços e parâmetros do Firestore.
- **blackout.js** – Responsável pelo cálculo de cortinas do tipo blackout.
- **cortina+bk.js** – Calcula orçamentos combinando cortina de tecido e blackout em um único produto.

## Outros arquivos

- **style.css** – Estilos compartilhados entre as páginas.
- **favicon.ico**, **logo_kaze.jpg** e **logo_kaze.png** – Imagens utilizadas na interface.

## Diretórios auxiliares

- **versao1/** – Guarda uma versão anterior da aplicação contendo arquivos equivalentes (HTML, CSS e scripts) utilizados como referência histórica.
- **versao2/** – Guarda uma versão anterior da aplicação contendo arquivos equivalentes (HTML, CSS e scripts) utilizados como referência histórica. 23-07-25
- **teste/** – Conjunto de arquivos de teste e protótipos diversos utilizados durante o desenvolvimento.

Para utilizar a aplicação localmente basta abrir `index.html` em um navegador com acesso à internet (para carregar o Firebase). É necessário possuir credenciais válidas de usuário cadastradas no projeto Firebase indicado nos scripts.
