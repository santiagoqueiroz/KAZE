// cortina+bk.js
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

let tecidos = {};
let tecidosBK = {};
let trilhos = {};
let parametros = {};

function arred(val) {
  return Math.round(val * 100) / 100;
}
function ceiling(val, step) {
  return Math.ceil(val / step) * step;
}
function formatarReais(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

async function carregarPrecos() {
  const t1 = await getDoc(doc(db, "precos", "tecidos"));
  const t2 = await getDoc(doc(db, "precos", "tecidos_bk"));
  const t3 = await getDoc(doc(db, "precos", "trilhos"));
  const t4 = await getDoc(doc(db, "precos", "parametros"));

  tecidos = t1.exists() ? t1.data() : {};
  tecidosBK = t2.exists() ? t2.data() : {};
  trilhos = t3.exists() ? t3.data() : {};
  parametros = t4.exists() ? t4.data() : {};

  const selC = document.getElementById("tecidoC");
  const selBK = document.getElementById("tecidoBK");
  const selTrilho = document.getElementById("trilho");

  for (const [nome, preco] of Object.entries(tecidos).sort()) {
    const o = document.createElement("option");
    o.value = preco;
    o.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
    selC.appendChild(o);
  }
  for (const [nome, preco] of Object.entries(tecidosBK).sort()) {
    const o = document.createElement("option");
    o.value = preco;
    o.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
    selBK.appendChild(o);
  }
  for (const [nome, preco] of Object.entries(trilhos)) {
    const o = document.createElement("option");
    o.value = preco;
    o.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
    selTrilho.appendChild(o);
  }
}

function removerItensCompartilhados(linhas) {
  return linhas.filter(l => {
    const label = l.label.toLowerCase();
    return !(label.includes("trilho") || label.includes("barra") || label.includes("instala") || label.includes("bucha"));
  });
}

function somarLinhas(linhas) {
  return linhas.reduce((soma, l) => soma + l.valor, 0);
}

function gerarTabela(produto, linhas, totalFinal) {
  return `
    <h2>${produto}</h2>
    <table>
      <tr><th>Item</th><th>Valor (R$)</th></tr>
      ${linhas.map(l => `<tr><td>${l.label}</td><td>${formatarReais(l.valor)}</td></tr>`).join('')}
      <tr><td><strong>TOTAL FINAL</strong></td><td><strong>${formatarReais(totalFinal)}</strong></td></tr>
    </table>
  `;
}

function calcularCortinaBK() {
  const largura = parseFloat(document.getElementById("largura").value || 0);
  const altura = parseFloat(document.getElementById("altura").value || 0);
  const precoC = parseFloat(document.getElementById("tecidoC").value || 0);
  const precoBK = parseFloat(document.getElementById("tecidoBK").value || 0);
  const nomeC = document.getElementById("tecidoC").selectedOptions[0].text.split(" - ")[0];
  const nomeBK = document.getElementById("tecidoBK").selectedOptions[0].text.split(" - ")[0];
  const nomeTrilho = document.getElementById("trilho").selectedOptions[0].text.split(" - ")[0];
  const precoTrilho = parseFloat(document.getElementById("trilho").value || 0);
  const barraExtra = parseFloat(document.getElementById("barraExtra").value || 0);
  const xBarraAlta = parseFloat(document.getElementById("xBarraAlta").value || 1.4);
  const ambiente = document.getElementById("ambiente").value || "Ambiente";
  const desconto = parseFloat(document.getElementById("desconto").value || 0);

  const linhasCortina = [];
  const linhasBK = [];

  // Parte da CORTINA
  const alturaTira = arred(altura + 0.12 + barraExtra);
  const qtdBase = arred((largura * 3.1) + 0.7);
  const qtdTiras = (qtdBase / 3) % 1 < 0.4 ? Math.floor(qtdBase / 3) : Math.ceil(qtdBase / 3);
  const qtdTotalC = altura > 2.6 ? arred(qtdTiras * alturaTira) : arred(qtdBase);
  const valorTecidoC = arred(qtdTotalC * precoC);
  const entrela = arred(qtdBase * parametros["ENTRETELA"]);
  const qntDeslizante = Math.ceil(((largura / 0.1) + 1) * 2);
  const deslizante = arred(qntDeslizante * parametros["DESLIZANTE"]);
  const terminal = arred(2 * parametros["TERMINAL"]);
  const costura = arred(qtdTotalC * parametros["COSTURA"]);
  const barra = arred(qtdBase * parametros["BARRA"] * (altura > 3.5 ? xBarraAlta : 1));
  const trilho = arred(ceiling(largura, 0.5) * precoTrilho);
  const instalacao = parametros["INSTALAÇÃO"];
  const kitsBucha = Math.ceil(largura * 0.5);
  const bucha = arred(kitsBucha * parametros["BUCHA E PARAFUSO"]);
  
  linhasCortina.push({ label: `Tecido cortina: ${qtdTotalC} m`, valor: valorTecidoC });
  linhasCortina.push({ label: `Trilho`, valor: trilho });
  linhasCortina.push({ label: `Entrela`, valor: entrela });
  linhasCortina.push({ label: `Deslizante`, valor: deslizante });
  linhasCortina.push({ label: `Terminal`, valor: terminal });
  linhasCortina.push({ label: `Costura`, valor: costura });
  linhasCortina.push({ label: `Barra`, valor: barra });
  linhasCortina.push({ label: `Instalação`, valor: instalacao });
  linhasCortina.push({ label: `Bucha e Parafuso`, valor: bucha });
  
  const subtotalC = somarLinhas(linhasCortina);
  const simplesC = arred(subtotalC * 0.06);
  const baseC = arred(subtotalC + simplesC);
  const totalC = arred(baseC * 2.4 / 0.879);

  // Parte do BLACKOUT
  let tecidoBase = 0;
  let qtdTirasBK = 1;
  let alturaFinal = arred(altura + 0.10 + 0.15);
  let qtdBK = 0;
  
  if (altura <= 2.8) {
    tecidoBase = arred(largura + 0.8);
    qtdBK = tecidoBase;
  } else if (altura <= 3.0) {
    tecidoBase = arred(largura + 0.8 + ((altura - 2.8) * 2));
    qtdBK = tecidoBase;
  } else {
    const bruto = (largura + 0.8) / 2.8;
    const decimal = bruto % 1;
    if (decimal <= 0.14) qtdTirasBK = Math.floor(bruto);
    else if (decimal <= 0.5) qtdTirasBK = Math.floor(bruto) + 0.5;
    else qtdTirasBK = Math.ceil(bruto);
    qtdBK = arred(alturaFinal * qtdTirasBK);
    tecidoBase = arred(largura + 0.8); // usado em barra, entretela, etc.
  }
  
  const valorTecidoBK = arred(qtdBK * precoBK);
  linhasBK.push({ label: `Tecido BK: ${qtdBK} m`, valor: valorTecidoBK });
  linhasBK.push({ label: `Entretela`, valor: arred(tecidoBase * parametros["ENTRETELA BK"]) });
  linhasBK.push({ label: `Deslizante`, valor: arred(Math.ceil(tecidoBase / 0.08) * parametros["DESLIZANTE"]) });
  linhasBK.push({ label: `Terminal`, valor: arred(2 * parametros["TERMINAL"]) });
  linhasBK.push({ label: `Costura`, valor: arred(qtdBK * parametros["COSTURA"]) });
  linhasBK.push({ label: `Barra`, valor: arred(tecidoBase * parametros["BARRA"]) });
  linhasBK.push({ label: `Instalação`, valor: parametros["INSTALAÇÃO"] });
  linhasBK.push({ label: `Bucha e Parafuso`, valor: arred(Math.ceil(largura) * parametros["BUCHA E PARAFUSO"]) });
  
  const linhasBKFiltradas = removerItensCompartilhados(linhasBK);
  const subtotalBK = somarLinhas(linhasBKFiltradas);
  const simplesBK = arred(subtotalBK * 0.06);
  const baseBKfinal = arred(subtotalBK + simplesBK);
  const totalBK = arred(baseBKfinal * 2.4 / 0.879);


  const totalFinal = arred(totalC + totalBK - desconto);

  const produto = `${ambiente} - Cortina ${nomeC} + BK ${nomeBK} - ${nomeTrilho}`;
  const linhasCombinadas = [...linhasCortina, ...linhasBKFiltradas];
  const tabelaHTML = gerarTabela(produto, linhasCombinadas, totalFinal);

  console.groupCollapsed(`🧮 Cálculo Detalhado - ${produto}`);
  console.log("CORTINA:");
  linhasCortina.forEach(l => console.log(" -", l.label, "=", formatarReais(l.valor)));
  console.log("Subtotal:", formatarReais(subtotalC));
  console.log("+6%:", formatarReais(simplesC));
  console.log("x2.4:", formatarReais(baseC * 2.4));
  console.log("/0.879:", formatarReais(totalC));

  console.log("BLACKOUT (sem trilho, barra, instalação, bucha):");
  linhasBKFiltradas.forEach(l => console.log(" -", l.label, "=", formatarReais(l.valor)));
  console.log("Subtotal:", formatarReais(subtotalBK));
  console.log("+6%:", formatarReais(simplesBK));
  console.log("x2.4:", formatarReais(baseBKfinal * 2.4));
  console.log("/0.879:", formatarReais(totalBK));

  console.log("DESCONTO FINAL:", formatarReais(desconto));
  console.log("TOTAL FINAL:", formatarReais(totalFinal));
  console.groupEnd();

  document.getElementById("resultado").innerHTML = tabelaHTML;
}

document.getElementById("btn-login").onclick = async () => {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;
  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (e) {
    document.getElementById("erro-login").textContent = "Erro: " + e.message;
  }
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("login-box").style.display = "none";
    document.getElementById("formulario").style.display = "block";
    carregarPrecos();
  }
});

export { carregarPrecos as preencherSelects, calcularCortinaBK };
