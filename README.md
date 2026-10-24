# KAZE

Aplicação web para gerenciamento de clientes, orçamentos de cortinas e persianas, tabela de preços e controle financeiro da Kazê Cortinas. Roda inteiramente no navegador e usa o Firebase (Authentication + Firestore, projeto `kaze-8836b`) como backend.

## Sistema novo (app.html), em testes

- **app.html** – Sistema novo numa página só: clientes, orçamentos (rascunho, salvar, ver, imagem, imprimir), pedidos aprovados e a seção Dados. Funciona junto com as páginas antigas: lê e grava os mesmos documentos. No Firebase Hosting o app.html abre na raiz do site: `https://kaze-8836b.web.app` e, depois de configurado o domínio, `https://sistema.kazecortinas.com.br`. O index.html (login antigo) não é publicado no Firebase, e `/index.html`, `/app.html` e `/sistema` levam para a raiz. A barra de endereço mostra sempre só o endereço do sistema: a tela atual fica no histórico do navegador, não no endereço. O site oficial antigo (GitHub Pages) não usa o firebase.json e não muda.
- **app.js** – Lógica do app.html.
- **app.css** – Visual do app.html (roxo, compacto, menu embaixo no celular).
- **calculos.js** – Cálculo de preço de cortina, blackout, cortina + blackout, cortina + forro, persiana e item avulso. Mesmas fórmulas dos scripts antigos (conferido com 80 mil combinações sorteadas, sem diferença de centavo).
- **perfis.js** – Quem é do financeiro (vê Financeiro, Dados, preço de custo e "Ver o cálculo"). Os demais usuários não veem esses itens.
- **logo_kaze_app.jpg** – Logo com fundo branco puro, usado no app e na imagem do orçamento.

### Dados no Firestore usados pelo app

- **clientes/{id}.orcamentoAtivo** – Rascunho do orçamento do cliente (itens, `baseadoEm` quando é cópia, `atualizadoEm`). Ao salvar, vira um documento em `orcamentos` e o rascunho é apagado.
- **orcamentos/{id}** – Mesmo formato das páginas antigas, mais: `numero` (sequencial), `baseadoEm`, `criadoEm`, `usuarioEmail`, `regras` (markup e custo cartão usados). Cada item novo guarda também `tipo`, `ambiente`, `desconto`, `custo` e `entrada` (o que foi digitado, para editar depois).
- **contadores/orcamentos** – Último número de orçamento usado (`ultimo`).
- **pedidos/{id do orçamento}** – Pedido aprovado: `aprovadoEm` (data e hora do servidor), `aprovadoPor`/`aprovadoPorEmail`, `forma` (cartao, pix, debito, dinheiro, transferencia), `parcelas`, `valorTabela`, `valorFechado`, `desconto`, `observacao`, `status`, cópia dos itens e do cliente (nome, bairro, cidade), `orcamentoFeitoEm` e `orcamentoPor`. Serve de base para a seção Dados e para gráficos futuros.

### Regras do Firestore (firestore.rules)

Só as contas da equipe acessam os dados; preços só os editores. Pedido aprovado não pode ser alterado; só o financeiro cancela uma aprovação ou exclui um orçamento aprovado. A numeração só sobe de 1 em 1. Publicar com `firebase deploy --only firestore:rules` (vale para o site oficial também, porque o banco é o mesmo). Enquanto as regras novas não forem publicadas, o app funciona, mas não aprova pedidos e salva orçamentos sem número.

## Páginas HTML (sistema antigo)

- **index.html** – Tela de login (Firebase Auth); redireciona para o painel.
- **painel.html** – Menu principal após o login.
- **cadastrar_cliente.html** – Cadastro de novos clientes.
- **consultar_clientes.html** – Lista de clientes, com edição e exclusão.
- **editar_cliente.html** – Edição dos dados de um cliente.
- **fazer_orcamento.html** – Montagem do orçamento ativo de um cliente (usa `main.js` e os scripts de cálculo).
- **consultar_orcamento.html** – Consulta e impressão de um orçamento salvo.
- **orcamentos_salvos.html** – Lista de orçamentos finalizados, com exclusão.
- **precos.html** – Edição das tabelas de preços (`precos` e `persianas`). Só os editores autorizados nas regras do Firestore conseguem salvar.
- **financeiro.html** – Lançamentos de despesas/receitas e categorias (usa `financeiro.js`).

## Scripts JavaScript

- **main.js** – Lógica de `fazer_orcamento.html`: autenticação, itens do orçamento ativo, totais e gravação.
- **persianas.js** – Preços e cálculo de persianas.
- **cortina.js** – Cálculo de cortinas de tecido.
- **blackout.js** – Cálculo de cortinas blackout.
- **cortina+bk.js** – Cálculo de cortina de tecido + blackout.
- **cortina+forro.js** – Cálculo de cortina com forro.
- **financeiro.js** – Lógica da página financeiro.
- **ambiente.js** – Mostra o selo "Em desenvolvimento" quando o site não está no endereço oficial (GitHub Pages).

## Outros arquivos

- **style.css** – Estilos compartilhados.
- **favicon.ico**, **logo_kaze.jpg**, **logo_kaze.png** – Imagens.
- **firebase.json** / **.firebaserc** – Configuração do Firebase Hosting (versão de testes em `kaze-8836b.web.app`).

## Diretórios auxiliares

- **versao1/**, **versao2/**, **versao3/** – Versões anteriores, guardadas como referência histórica (não são publicadas no Firebase Hosting).
- **teste/** – Protótipos usados durante o desenvolvimento (não publicados).

## Como usar

Abra o site publicado e entre com um usuário cadastrado no Firebase Authentication do projeto. Para publicar a versão de testes: `firebase deploy --only hosting`.
