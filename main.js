
// 📦 Importação de módulos do Firebase e scripts locais
  import { app, auth, db } from "./firebase-config.js";
  import { mensagemErro } from "./erros.js";
  import { esc } from "./seguranca.js";
  import { calcularTotais, carregarRegras } from "./regras-preco.js";
// 📦 Importação de módulos do Firebase e scripts locais
  import {
// 🔥 Inicializa o Firestore (banco de dados)
    getFirestore, collection, getDocs, query, orderBy,
    doc, getDoc, updateDoc, serverTimestamp, runTransaction
  } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
// 📦 Importação de módulos do Firebase e scripts locais
  import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
// 📦 Importação de módulos do Firebase e scripts locais
  import { carregarTipos, calcularPersiana as calcularPersianaCalc } from './persianas.js';
// 📦 Importação de módulos do Firebase e scripts locais
  import { preencherSelects, calcularCortina } from './cortina.js';
  import { preencherSelects as preencherSelectsBK, calcularBlackout } from './blackout.js';
  import { preencherSelects as preencherSelectsCBK, calcularCortinaBK } from './cortina+bk.js';
  import { preencherSelectsCF, calcularCortinaForro } from './cortina+forro.js';
  import { addDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
  import { caixaBuscaCliente } from './busca-antiga.js';

  window.calcularCortina = calcularCortina;
  window.calcularBlackout = calcularBlackout;
  window.calcularCortinaBK = calcularCortinaBK;
  window.calcularCortinaForro = calcularCortinaForro;

 
// 🚀 Inicializa o app Firebase
// 🔥 Inicializa o Firestore (banco de dados)
// 🔐 Inicializa autenticação do Firebase

// 📁 Objeto para armazenar dados dos clientes
const clientes = {};
let clienteSelecionado = null;

  function formatarReais(v) {
    return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const corpoItens = document.getElementById("lista-itens");

// 👤 Verifica se o usuário está logado e liga a busca de clientes
// (não lê mais todos os clientes: cada cliente lido conta como uma leitura paga)
  onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = "index.html";
    caixaBuscaCliente(document.getElementById("busca-cliente"), (c) => {
      clientes[c.id] = c;
      mostrarDadosCliente(c.id);
    });
    await carregarRegras();
  });

// 📋 Mostra os dados do cliente selecionado
  window.mostrarDadosCliente = async function (id) {
// 🧹 Esconde dados e limpa seleção
    if (!clientes[id]) return esconderTudo();
    clienteSelecionado = id;

const campos = ["nome", "telefone", "cpf", "endereco", "bairro", "cidade", "email"];
const c = clientes[id];

campos.forEach((campo) => {
  const spanEl = document.getElementById(campo);
  const pEl = spanEl.closest("p");
  const valor = (campo === "cpf") ? c.cpfOuCnpj : c[campo];

  if (valor && valor.trim() !== "") {
    spanEl.textContent = valor;
    pEl.style.display = "block";
  } else {
    pEl.style.display = "none";
  }
});

document.getElementById("dados-cliente").style.display = "block";


    const ref = doc(db, "clientes", id);
    const snap = await getDoc(ref);
    if (!snap.data().orcamentoAtivo) {
      await updateDoc(ref, {
        orcamentoAtivo: {
          status: "aberto",
          dataCriacao: serverTimestamp(),
          itens: []
        }
      });
    }
    const atualizado = await getDoc(ref);
// 📦 Exibe os itens do orçamento e calcula os totais
    mostrarItens(atualizado.data().orcamentoAtivo?.itens || []);
  };

// 🧹 Esconde dados e limpa seleção
  function esconderTudo() {
    document.getElementById("dados-cliente").style.display = "none";
    document.getElementById("tabela-itens").style.display = "none";
    clienteSelecionado = null;
  }

// 🔒 Grava itens do orçamento dentro de uma transação: lê a versão mais recente do
// Firestore antes de gravar, para duas abas/pessoas não apagarem itens uma da outra
  async function alterarItensOrcamento(alterar) {
    const ref = doc(db, "clientes", clienteSelecionado);
    return runTransaction(db, async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists()) throw Object.assign(new Error("Cliente não encontrado"), { code: "not-found" });
      const itens = [...(snap.data().orcamentoAtivo?.itens || [])];
      const resultado = alterar(itens);
      if (resultado === false) return null; // nada a gravar
      t.update(ref, { "orcamentoAtivo.itens": itens });
      return itens;
    });
  }

  function adicionarItemOrcamento(item) {
    return alterarItensOrcamento((itens) => { itens.push(item); });
  }

  // Representação do item independente da ordem dos campos (para comparar itens)
  function chaveItem(valor) {
    if (Array.isArray(valor)) return "[" + valor.map(chaveItem).join(",") + "]";
    if (valor && typeof valor === "object") {
      return "{" + Object.keys(valor).sort().map((k) => JSON.stringify(k) + ":" + chaveItem(valor[k])).join(",") + "}";
    }
    return JSON.stringify(valor);
  }

  // Itens exibidos na tela (usados para identificar qual item remover)
  let itensNaTela = [];

// 📦 Exibe os itens do orçamento e calcula os totais
  function mostrarItens(itens) {
    itensNaTela = itens || [];
    corpoItens.innerHTML = "";
    
    if (!itens || itens.length === 0) {
      document.getElementById("tabela-itens").style.display = "none";
      document.getElementById("total-geral").style.display = "none";
      return;
    }
    itens.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${esc(item.produto)}</td>
        <td>${parseFloat(item.largura).toFixed(2)}</td>
        <td>${parseFloat(item.altura).toFixed(2)}</td>
        <td>${parseInt(item.qtd)}</td>
        <td>${parseFloat(item.unit).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td>${parseFloat(item.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td><button onclick="removerItem(${index})">🗑️</button></td>
      `;
      corpoItens.appendChild(tr);
    });
    document.getElementById("tabela-itens").style.display = "table";

    const { totalGeral, totalVista } = calcularTotais(itens);
    document.getElementById("soma-final").textContent = totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById("total-geral").style.display = "block";
document.getElementById("total-vista").textContent = totalVista.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });


  }

// 🪟 Abre a janela/modal para adicionar persiana
  window.abrirJanelaPersiana = async function () {
    document.getElementById("janelaItem").style.display = "flex";
    const select = document.getElementById("tipo");
    if (select.options.length === 0) await carregarTipos(select);
  };

  window.fecharJanelaItem = function () {
    document.getElementById("janelaItem").style.display = "none";
    document.getElementById("resultado").innerHTML = "";
  };

  window.calcularPersiana = function () {
      const tipo = document.getElementById("tipo").value;
      const largura = parseFloat(document.getElementById("largura").value || 0);
      const altura = parseFloat(document.getElementById("altura").value || 0);
      const desconto = parseFloat(document.getElementById("desconto").value || 0);
      const ambiente = document.getElementById("ambiente").value.trim() || "Ambiente";
      if (!tipo || !largura || !altura) return alert("Preencha todos os campos.");
  
      const r = calcularPersianaCalc(largura, altura, tipo, desconto);
      window.resultadoPersiana = { ...r, desconto: desconto };
      const resumo = `
        <h2>${esc(ambiente)} - Persiana ${esc(tipo)}</h2>
        <p>Desconto: ${formatarReais(desconto)}</p>
        <p><strong>Valor final: ${formatarReais(r.total)}</strong></p>`;
      document.getElementById("resultado").innerHTML = resumo;
    };



// ✅ Confirma e salva item de persiana no Firestore
  window.confirmarItemPersiana = async function () {
    if (!clienteSelecionado) return alert("Selecione um cliente.");
    const tipo = document.getElementById("tipo").value;
    const largura = parseFloat(document.getElementById("largura").value);
    const altura = parseFloat(document.getElementById("altura").value);
    const ambiente = document.getElementById("ambiente").value;
    const desconto = parseFloat(document.getElementById("desconto").value || 0);
    if (!tipo || !largura || !altura || !ambiente) return alert("Preencha todos os campos.");

    const total = parseFloat(window.resultadoPersiana?.total || 0);
    const unit = parseFloat(window.resultadoPersiana?.valorUnitario || 0);
    const item = {
      produto: `${ambiente} - Persiana ${tipo}`,
      largura,
      altura,
      qtd: 1,
      unit: unit,
      total: total
    };
    const itens = await adicionarItemOrcamento(item);
// 📦 Exibe os itens do orçamento e calcula os totais
    mostrarItens(itens);
    fecharJanelaItem();
  };

// 🪟 Abre a janela/modal para adicionar cortina
  window.abrirJanelaCortina = async function () {
    document.getElementById("janelaCortina").style.display = "flex";
    preencherSelects();
  };

  window.fecharJanelaCortina = function () {
    document.getElementById("janelaCortina").style.display = "none";
    document.getElementById("resultadoC").innerHTML = "";
  };

  window.abrirJanelaBlackout = async function () {
    document.getElementById("janelaBlackout").style.display = "flex";
    preencherSelectsBK();
  };
  
  window.fecharJanelaBlackout = function () {
    document.getElementById("janelaBlackout").style.display = "none";
    document.getElementById("resultadoBK").innerHTML = "";
  };

  window.abrirJanelaCortinaBK = function () {
    document.getElementById("janelaCortinaBK").style.display = "flex";
    setTimeout(preencherSelectsCBK, 10);
  };

  window.fecharJanelaCortinaBK = function () {
    document.getElementById("janelaCortinaBK").style.display = "none";
    document.getElementById("resultadoCBK").innerHTML = "";
  };


  window.abrirJanelaCortinaForro = function () {
    document.getElementById("janelaCortinaForro").style.display = "flex";
    setTimeout(preencherSelectsCF, 10);
  };

  window.fecharJanelaCortinaForro = function () {
    document.getElementById("janelaCortinaForro").style.display = "none";
    document.getElementById("resultadoCF").innerHTML = "";
  };

window.abrirJanelaManual = function () {
    document.getElementById("janelaManual").style.display = "flex";
  };

  window.fecharJanelaManual = function () {
    document.getElementById("janelaManual").style.display = "none";
  };

// ✅ Confirma e salva item de cortina no Firestore
  window.confirmarItemCortina = async function () {
    if (!clienteSelecionado) return alert("Selecione um cliente.");


    // Pega o nome base do produto gerado
    let produto = document.querySelector("#resultadoC h2")?.textContent || "Cortina";
    const ambiente = document.getElementById("ambienteC").value.trim();



    const largura = parseFloat(document.getElementById("larguraC").value || 0);
    const altura = parseFloat(document.getElementById("alturaC").value || 0);
    const total = typeof window.totalFinalCortina === "number"
  ? window.totalFinalCortina
  : Number(window.totalFinalCortina.toString().replace(",", "."));


    const item = {
      produto,
      largura,
      altura,
      qtd: 1,
      unit: total,
      total: total
    };

    const itens = await adicionarItemOrcamento(item);
// 📦 Exibe os itens do orçamento e calcula os totais
    mostrarItens(itens);
    fecharJanelaCortina();
  };

window.confirmarItemBlackout = async function () {
  if (!clienteSelecionado) return alert("Selecione um cliente.");



  const tipo = document.getElementById("tecidoBK")?.selectedOptions[0]?.text?.split(" - ")[0] || "";
  const trilho = document.getElementById("trilhoBK")?.selectedOptions[0]?.text?.split(" - ")[0] || "";
  const ambienteBK = document.getElementById("ambienteBK")?.value.trim() || "Ambiente";
  const produto = `${ambienteBK} - Blackout ${tipo} - ${trilho}`;

  const largura = parseFloat(document.getElementById("larguraBK").value || 0);
  const altura = parseFloat(document.getElementById("alturaBK").value || 0);
  const total = typeof window.totalFinalBlackout === "number"
  ? window.totalFinalBlackout
  : Number(window.totalFinalBlackout.toString().replace(",", "."));


  const item = {
    produto,
    largura,
    altura,
    qtd: 1,
    unit: total,
    total: total
  };

  const itens = await adicionarItemOrcamento(item);

  mostrarItens(itens);
  fecharJanelaBlackout();
};

window.confirmarItemCortinaBK = async function () {
  if (!clienteSelecionado) return alert("Selecione um cliente.");


  const tipoC = document.getElementById("tecidoC")?.selectedOptions[0]?.text?.split(" - ")[0] || "";
  const tipoBK = document.getElementById("tecidoBK_CBK")?.selectedOptions[0]?.text?.split(" - ")[0] || "";
  const trilho = document.getElementById("trilhoCBK")?.selectedOptions[0]?.text?.split(" - ")[0] || "";
  const ambienteCBK = document.getElementById("ambienteCBK")?.value.trim() || "Ambiente";
  const produto = `${ambienteCBK} - Cortina ${tipoC} + Blackout ${tipoBK} - ${trilho}`;

  const largura = parseFloat(document.getElementById("larguraCBK").value || 0);
  const altura = parseFloat(document.getElementById("alturaCBK").value || 0);
  const total = typeof window.totalFinalGlobal === "number"
  ? window.totalFinalGlobal
  : Number(window.totalFinalGlobal.toString().replace(",", "."));


  const item = {
    produto,
    largura,
    altura,
    qtd: 1,
    unit: total,
    total: total
  };

  const itens = await adicionarItemOrcamento(item);
  mostrarItens(itens);
  fecharJanelaCortinaBK();
};

  window.confirmarItemCortinaForro = async function () {
  if (!clienteSelecionado) return alert("Selecione um cliente.");

  let produto = window.produtoCortinaForro || document.querySelector("#resultadoCF h2")?.textContent || "Cortina + Forro";
  const largura = parseFloat(document.getElementById("larguraCF").value || 0);
  const altura = parseFloat(document.getElementById("alturaCF").value || 0);

  const total = typeof window.totalFinalCortinaForro === "number"
    ? window.totalFinalCortinaForro
    : Number(window.totalFinalCortinaForro.toString().replace(",", "."));

  const totalCortina = window.totalCortinaCF || 0;
  const totalForro = window.totalForroCF || 0;

  const item = {
    produto,
    largura,
    altura,
    cortina: totalCortina,
    forro: totalForro,
    qtd: 1,
    unit: total,
    total: total
  };

  const itens = await adicionarItemOrcamento(item);
  mostrarItens(itens);
  fecharJanelaCortinaForro();
};

  window.confirmarItemManual = async function () {
    if (!clienteSelecionado) return alert("Selecione um cliente.");

    const nome = document.getElementById("nomeManual").value.trim();
    const quantidade = parseFloat(document.getElementById("quantidadeManual").value || 0);
    const valor = parseFloat(document.getElementById("valorManual").value || 0);
    const largura = parseFloat(document.getElementById("larguraManual").value || 0);
    const altura  = parseFloat(document.getElementById("alturaManual").value || 0);
    if (!nome || !quantidade || !valor) return alert("Preencha todos os campos.");

    const item = {
      produto: nome,
      largura: largura,
      altura: altura,
      qtd: quantidade,
      unit: valor,
      total: quantidade * valor
    };

    const itens = await adicionarItemOrcamento(item);
    mostrarItens(itens);
    fecharJanelaManual();
  };



  window.removerItem = async function (index) {
  if (!clienteSelecionado) return;
  const alvo = itensNaTela[index];
  if (!alvo) return;
  if (!confirm(`Remover o item "${alvo.produto}" do orçamento?`)) return;

  // Remove o item que está na tela, procurando-o na versão atual do Firestore
  // (a posição pode ter mudado se alguém alterou o orçamento em outra aba)
  let encontrado = true;
  const itens = await alterarItensOrcamento((atuais) => {
    const i = atuais.findIndex((it) => chaveItem(it) === chaveItem(alvo));
    if (i === -1) { encontrado = false; return false; }
    atuais.splice(i, 1);
  });
  if (!encontrado) {
    alert("Esse item já tinha sido removido ou alterado em outra tela. A lista foi atualizada.");
    const snap = await getDoc(doc(db, "clientes", clienteSelecionado));
    mostrarItens(snap.data()?.orcamentoAtivo?.itens || []);
    return;
  }
// 📦 Exibe os itens do orçamento e calcula os totais
  mostrarItens(itens);
};

// Salvar orçamento
window.salvarOrcamento = async function () {
  if (!clienteSelecionado) return alert("Selecione um cliente antes de salvar.");

  const user = auth.currentUser;
  if (!user) return alert("Usuário não autenticado.");

  const cliente = clientes[clienteSelecionado];
  const ref = doc(db, "clientes", clienteSelecionado);
  const snap = await getDoc(ref);
  const itens = snap.data().orcamentoAtivo?.itens || [];

  if (itens.length === 0) return alert("Não há itens no orçamento para salvar.");

  const { totalGeral, totalVista } = calcularTotais(itens);

  const orcamento = {
    clienteId: clienteSelecionado,
    cliente: {
      nome: cliente.nome || "",
      telefone: cliente.telefone || "",
      cpf: cliente.cpfOuCnpj || "",
      endereco: cliente.endereco || "",
      bairro: cliente.bairro || "",
      cidade: cliente.cidade || "",
      email: cliente.email || ""
    },
    itens: itens,
    totalGeral: totalGeral,
    totalVista: totalVista,
    dataHora: new Date().toISOString(),
    usuarioId: user.uid
  };

  try {
    await addDoc(collection(db, "orcamentos"), orcamento);
    alert("Orçamento salvo com sucesso!");
  } catch (erro) {
    console.error("Erro ao salvar orçamento:", erro);
    alert("Não foi possível salvar o orçamento. " + mensagemErro(erro));
  }
};

