// cortina+bk.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5kVoWRWZB6xtacyu6lH--QFXry_MPKps",
  authDomain: "kaze-8836b.firebaseapp.com",
  projectId: "kaze-8836b",
  storageBucket: "kaze-8836b.appspot.com",
  messagingSenderId: "336054068300",
  appId: "1:336054068300:web:6125e8eecc08d667fac0e9"
};

const app = initializeApp(firebaseConfig);
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

  // Tecido cortina
  const alturaTira = arred(altura + 0.12 + barraExtra);
  const qtdBase = arred((largura * 3.1) + 0.7);
  const qtdTiras = (qtdBase / 3) % 1 < 0.4 ? Math.floor(qtdBase / 3) : Math.ceil(qtdBase / 3);
  const qtdTotalC = altura > 2.6 ? arred(qtdTiras * alturaTira) : arred(qtdBase);
  const valorTecidoC = arred(qtdTotalC * precoC);
  linhasCortina.push({ label: `Tecido cortina: ${qtdTotalC} m`, valor: valorTecidoC });

  const barra = arred(qtdBase * parametros["BARRA"] * (altura > 3.5 ? xBarraAlta : 1));
  const trilho = arred(ceiling(largura, 0.5) * precoTrilho);

  linhasCortina.push({ label: `Trilho`, valor: trilho });
  linhasCortina.push({ label: `Barra`, valor: barra });
  linhasCortina.push({ label: `Instalação`, valor: parametros["INSTALAÇÃO"] });
  linhasCortina.push({ label: `Bucha e Parafuso`, valor: arred(Math.ceil(largura * 0.5) * parametros["BUCHA E PARAFUSO"]) });

  // Subtotal cortina
  const subtotalC = somarLinhas(linhasCortina);
  const totalC = arred(arred((subtotalC * 1.06) * 2.4) / 0.879);

  // Blackout (parcial)
  const baseBK = arred(largura + 0.8);
  const alturaBK = arred(altura + 0.25);
  const qtdBK = arred(baseBK); // simplificado
  const valorTecidoBK = arred(qtdBK * precoBK);
  linhasBK.push({ label: `Tecido BK: ${qtdBK} m`, valor: valorTecidoBK });
  linhasBK.push({ label: `Entretela`, valor: arred(baseBK * parametros["ENTRETELA BK"]) });
  linhasBK.push({ label: `Deslizante`, valor: arred(Math.ceil(baseBK / 0.08) * parametros["DESLIZANTE"]) });
  linhasBK.push({ label: `Terminal`, valor: arred(2 * parametros["TERMINAL"]) });
  linhasBK.push({ label: `Costura`, valor: arred(qtdBK * parametros["COSTURA"]) });
  linhasBK.push({ label: `Barra`, valor: arred(baseBK * parametros["BARRA"]) });
  linhasBK.push({ label: `Instalação`, valor: parametros["INSTALAÇÃO"] });
  linhasBK.push({ label: `Bucha e Parafuso`, valor: arred(Math.ceil(largura) * parametros["BUCHA E PARAFUSO"]) });

  const linhasBKFiltradas = removerItensCompartilhados(linhasBK);
  const subtotalBK = somarLinhas(linhasBKFiltradas);
  const totalBK = arred(arred((subtotalBK * 1.06) * 2.4) / 0.879);

  const totalFinal = arred(totalC + totalBK - desconto);

  const produto = `${ambiente} - Cortina ${nomeC} + BK ${nomeBK} - ${nomeTrilho}`;
  const linhasCombinadas = [...linhasCortina, ...linhasBKFiltradas];
  const tabelaHTML = gerarTabela(produto, linhasCombinadas, totalFinal);

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

document.getElementById("btn-calcular").onclick = calcularCortinaBK;

