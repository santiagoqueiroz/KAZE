
// 📦 Importação de módulos do Firebase e scripts locais
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
// 📦 Importação de módulos do Firebase e scripts locais
  import {
// 🔥 Inicializa o Firestore (banco de dados)
    getFirestore, collection, getDocs, query, orderBy,
    doc, getDoc, updateDoc, serverTimestamp
  } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
// 📦 Importação de módulos do Firebase e scripts locais
  import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
// 📦 Importação de módulos do Firebase e scripts locais
  import { carregarTipos, calcularPersiana as calcularPersianaCalc } from './persianas.js';
// 📦 Importação de módulos do Firebase e scripts locais
  import { preencherSelects, calcularCortina } from './cortina.js';
  import { preencherSelects as preencherSelectsBK, calcularBlackout } from './blackout.js';
  import { preencherSelects as preencherSelectsCBK, calcularCortinaBK } from './cortina+bk.js';
  import { addDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

  window.calcularCortina = calcularCortina;
  window.calcularBlackout = calcularBlackout;
  window.calcularCortinaBK = calcularCortinaBK;


  const firebaseConfig = {
    apiKey: "AIzaSyD5kVoWRWZB6xtacyu6lH--QFXry_MPKps",
    authDomain: "kaze-8836b.firebaseapp.com",
    projectId: "kaze-8836b",
    storageBucket: "kaze-8836b.firebasestorage.app",
    messagingSenderId: "336054068300",
    appId: "1:336054068300:web:6125e8eecc08d667fac0e9"
  };

// 🚀 Inicializa o app Firebase
  const app = initializeApp(firebaseConfig);
// 🔥 Inicializa o Firestore (banco de dados)
  const db = getFirestore(app);
// 🔐 Inicializa autenticação do Firebase
  const auth = getAuth(app);

// 📁 Objeto para armazenar dados dos clientes
const clientes = {};
let clienteSelecionado = null;

  function formatarReais(v) {
    return parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  const select = document.getElementById("cliente");
  const corpoItens = document.getElementById("lista-itens");

// 👤 Verifica se o usuário está logado e carrega clientes
  onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = "index.html";
    const q = query(collection(db, "clientes"), orderBy("nome"));
    const snapshot = await getDocs(q);
    snapshot.forEach((doc) => {
      clientes[doc.id] = doc.data();
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.textContent = clientes[doc.id].nome || "(sem nome)";
      select.appendChild(opt);
    });
  });

// 📋 Mostra os dados do cliente selecionado
  window.mostrarDadosCliente = async function () {
    const id = select.value;
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

// 📦 Exibe os itens do orçamento e calcula os totais
  function mostrarItens(itens) {
    corpoItens.innerHTML = "";
    
    if (!itens || itens.length === 0) {
      document.getElementById("tabela-itens").style.display = "none";
      document.getElementById("total-geral").style.display = "none";
      return;
    }
if (!itens || itens.length === 0) {
      document.getElementById("tabela-itens").style.display = "none";
      return;
    }
    itens.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.produto}</td>
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

    const totalGeral = itens.reduce((soma, item) => soma + parseFloat(item.total), 0);
    document.getElementById("soma-final").textContent = totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById("total-geral").style.display = "block";
    const totalVista = totalGeral * 0.879;
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
        <h2>${ambiente} - Persiana ${tipo}</h2>
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
    const ref = doc(db, "clientes", clienteSelecionado);
    const snap = await getDoc(ref);
    const itens = snap.data().orcamentoAtivo?.itens || [];
    itens.push(item);
    await updateDoc(ref, { "orcamentoAtivo.itens": itens });
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

    const ref = doc(db, "clientes", clienteSelecionado);
    const snap = await getDoc(ref);
    const itens = snap.data().orcamentoAtivo?.itens || [];
    itens.push(item);
    await updateDoc(ref, { "orcamentoAtivo.itens": itens });
// 📦 Exibe os itens do orçamento e calcula os totais
    mostrarItens(itens);
    fecharJanelaCortina();
  };

window.confirmarItemBlackout = async function () {
  if (!clienteSelecionado) return alert("Selecione um cliente.");



  let produto = document.querySelector("#resultadoBK h2")?.textContent || "Blackout";
  const ambiente = document.getElementById("ambienteBK").value.trim();
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

  const ref = doc(db, "clientes", clienteSelecionado);
  const snap = await getDoc(ref);
  const itens = snap.data().orcamentoAtivo?.itens || [];
  itens.push(item);
  await updateDoc(ref, { "orcamentoAtivo.itens": itens });

  mostrarItens(itens);
  fecharJanelaBlackout();
};

window.confirmarItemCortinaBK = async function () {
  if (!clienteSelecionado) return alert("Selecione um cliente.");


  let produto = document.querySelector("#resultadoCBK h2")?.textContent || "Cortina + Blackout";
  const ambiente = document.getElementById("ambienteCBK").value.trim();
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

  const ref = doc(db, "clientes", clienteSelecionado);
  const snap = await getDoc(ref);
  const itens = snap.data().orcamentoAtivo?.itens || [];
  itens.push(item);
  await updateDoc(ref, { "orcamentoAtivo.itens": itens });
  mostrarItens(itens);
  fecharJanelaCortinaBK();
};


  window.removerItem = async function (index) {
  if (!clienteSelecionado) return;
  const ref = doc(db, "clientes", clienteSelecionado);
  const snap = await getDoc(ref);
  const dados = snap.data();
  const itens = dados.orcamentoAtivo?.itens || [];

  if (index >= 0 && index < itens.length) {
    itens.splice(index, 1); // remove o item
    await updateDoc(ref, { "orcamentoAtivo.itens": itens });
// 📦 Exibe os itens do orçamento e calcula os totais
    mostrarItens(itens);
  }
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

  const totalGeralText = document.getElementById("soma-final").textContent || "R$ 0,00";
  const totalVistaText = document.getElementById("total-vista").textContent || "R$ 0,00";

  const totalGeral = parseFloat(totalGeralText.replace("R$", "").replace(/\./g, "").replace(",", "."));
  const totalVista = parseFloat(totalVistaText.replace("R$", "").replace(/\./g, "").replace(",", "."));

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
    alert("Erro ao salvar. Verifique o console.");
  }
};

