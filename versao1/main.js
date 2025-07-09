
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
  import { carregarTipos, calcularPersiana } from './persianas.js';
// 📦 Importação de módulos do Firebase e scripts locais
  import { preencherSelects, calcularCortina } from './cortina.js';
  import { preencherSelects as preencherSelectsBK, calcularBlackout } from './blackout.js';
  import { preencherSelects as preencherSelectsCBK, calcularCortinaBK } from './cortina+bk.js';



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


// ✅ Confirma e salva item de persiana no Firestore
  window.confirmarItemPersiana = async function () {
    if (!clienteSelecionado) return alert("Selecione um cliente.");
    const tipo = document.getElementById("tipo").value;
    const largura = parseFloat(document.getElementById("largura").value);
    const altura = parseFloat(document.getElementById("altura").value);
    const ambiente = document.getElementById("ambiente").value;
    const desconto = parseFloat(document.getElementById("desconto").value || 0);
    if (!tipo || !largura || !altura || !ambiente) return alert("Preencha todos os campos.");

    const r = calcularPersiana(largura, altura, tipo, desconto);
    const item = {
      produto: `Persiana - ${tipo} (${ambiente})`,
      largura, altura, qtd: 1,
      unit: r.valorUnitario,
      total: r.total
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
    document.getElementById("resultado").innerHTML = "";
  };

  window.abrirJanelaBlackout = async function () {
    document.getElementById("janelaBlackout").style.display = "flex";
    preencherSelectsBK();
  };
  
  window.fecharJanelaBlackout = function () {
    document.getElementById("janelaBlackout").style.display = "none";
    document.getElementById("resultado").innerHTML = "";
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

    calcularCortina();

    // Pega o nome base do produto gerado
    let produto = document.querySelector("#resultado h2")?.textContent || "Cortina";
    const ambiente = document.getElementById("ambienteC").value.trim();

    // Remove o ambiente do início se já vier no título
    if (produto.startsWith("Ambiente")) {
      produto = produto.slice("Ambiente".length).trim().replace(/^[-–]\s*/, "");
    }
    if (ambiente && produto.startsWith(ambiente)) {
      produto = produto.slice(ambiente.length).trim().replace(/^[-–]\s*/, "");
    }


    // Adiciona o ambiente no final entre parênteses
    if (ambiente) produto += ` (${ambiente})`;

    const largura = parseFloat(document.getElementById("larguraC").value || 0);
    const altura = parseFloat(document.getElementById("alturaC").value || 0);
    const totalTexto = document.querySelector("#resultado tr:last-child td:last-child")?.textContent || "0";

    // Converte R$ 1.234,56 → 1234.56
    const valorLimpo = totalTexto
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim();

    const total = parseFloat(valorLimpo) || 0;

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

  calcularBlackout();

  let produto = document.querySelector("#resultadoBK h2")?.textContent || "Blackout";
  const ambiente = document.getElementById("ambienteBK").value.trim();

  if (produto.startsWith("Ambiente")) {
    produto = produto.slice("Ambiente".length).trim().replace(/^[-–]\\s*/, "");
  }
  if (ambiente && produto.startsWith(ambiente)) {
    produto = produto.slice(ambiente.length).trim().replace(/^[-–]\\s*/, "");
  }
  if (ambiente) produto += ` (${ambiente})`;

  const largura = parseFloat(document.getElementById("larguraBK").value || 0);
  const altura = parseFloat(document.getElementById("alturaBK").value || 0);
  const totalTexto = document.querySelector("#resultadoBK tr:last-child td:last-child")?.textContent || "0";

  const valorLimpo = totalTexto.replace("R$", "").replace(/\\./g, "").replace(",", ".").trim();
  const total = parseFloat(valorLimpo) || 0;

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
  calcularCortinaBK();

  let produto = document.querySelector("#resultadoCBK h2")?.textContent || "Cortina + Blackout";
  const ambiente = document.getElementById("ambienteCBK").value.trim();

  if (produto.startsWith("Ambiente")) {
    produto = produto.slice("Ambiente".length).trim().replace(/^[-–]\s*/, "");
  }
  if (ambiente && produto.startsWith(ambiente)) {
    produto = produto.slice(ambiente.length).trim().replace(/^[-–]\s*/, "");
  }
  if (ambiente) produto += ` (${ambiente})`;

  const largura = parseFloat(document.getElementById("larguraCBK").value || 0);
  const altura = parseFloat(document.getElementById("alturaCBK").value || 0);
  const totalTexto = document.querySelector("#resultadoCBK tr:last-child td:last-child")?.textContent || "0";

  const valorLimpo = totalTexto.replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
  const total = parseFloat(valorLimpo) || 0;

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
