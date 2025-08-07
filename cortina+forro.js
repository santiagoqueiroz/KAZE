import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

let tecidos = {};
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

async function preencherSelectsCF() {
  const t1 = await getDoc(doc(db, "precos", "tecidos"));
  const t3 = await getDoc(doc(db, "precos", "trilhos"));
  const t4 = await getDoc(doc(db, "precos", "parametros"));

  tecidos = t1.exists() ? t1.data() : {};
  trilhos = t3.exists() ? t3.data() : {};
  parametros = t4.exists() ? t4.data() : {};

  const selTecidoC = document.getElementById("tecidoC_CF");
  const selTecidoF = document.getElementById("tecidoF_CF");
  const selTrilho = document.getElementById("trilhoCF");

  selTecidoC.innerHTML = "";
  selTecidoF.innerHTML = ""
  selTrilho.innerHTML = "";

  for (const [nome, preco] of Object.entries(tecidos).sort()) {
    const o1 = document.createElement("option");
    o1.value = preco;
    o1.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
    selTecidoC.appendChild(o1);

    const o2 = document.createElement("option");
    o2.value = preco;
    o2.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
    selTecidoF.appendChild(o2);
  }
  for (const [nome, preco] of Object.entries(trilhos)) {
    const o = document.createElement("option");
    o.value = preco;
    o.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
    selTrilho.appendChild(o);
  }
}

function somarLinhas(linhas) {
  return linhas.reduce((soma, l) => soma + l.valor, 0);
}

function calcularCortinaForro() {
  const largura = parseFloat(document.getElementById("larguraCF").value || 0);
  const altura = parseFloat(document.getElementById("alturaCF").value || 0);
  const barraExtra = parseFloat(document.getElementById("barraExtraCF").value || 0.40);
  const xBarraAlta = parseFloat(document.getElementById("xBarraAltaCF").value || 1.4);
  const desconto = parseFloat(document.getElementById("descontoCF").value || 0);
  const selTecidoC = document.getElementById("tecidoC_CF");
  const selTecidoF = document.getElementById("tecidoF_CF");
  const selTrilho = document.getElementById("trilhoCF");

  const precoTecidoC = parseFloat(selTecidoC.value || 0);
  const precoTecidoF = parseFloat(selTecidoF.value || 0);
  const precoTrilho = parseFloat(selTrilho.value || 0);
  const nomeTecidoC = selTecidoC.selectedOptions[0].text.split(" - ")[0];
  const nomeTecidoF = selTecidoF.selectedOptions[0].text.split(" - ")[0];
  const nomeTrilho = selTrilho.selectedOptions[0].text.split(" - ")[0];
  const ambiente = document.getElementById("ambienteCF")?.value || "Ambiente";

  const alturaTira = arred(altura + 0.12 + barraExtra);
  const qtdBase = arred((largura * 3.1) + 0.7);
  const qtdTiras = (qtdBase / 3) % 1 < 0.4 ? Math.floor(qtdBase / 3) : Math.ceil(qtdBase / 3);
  const metragem = arred(altura > 2.6 ? (qtdTiras * alturaTira) : qtdBase);

  const valorTecidoC = arred(metragem * precoTecidoC);
  const valorTecidoF = arred(metragem * precoTecidoF);

  const entrela = arred(qtdBase * parametros["ENTRETELA"]);
  const qntDeslizante = Math.ceil(((largura / 0.1) + 1) * 2);
  const deslizante = arred(qntDeslizante * parametros["DESLIZANTE"]);
  const terminal = arred(2 * parametros["TERMINAL"]);
  const costuraC = arred(metragem * parametros["COSTURA"]);
  const costuraF = arred(metragem * parametros["COSTURA"]);
  const barraC = arred(qtdBase * parametros["BARRA"] * (altura > 3.5 ? xBarraAlta : 1));
  const barraF = arred(qtdBase * parametros["BARRA"] * (altura > 3.5 ? xBarraAlta : 1));

  let trilho = 0;
  const precoSuporte = parametros["SUPORTE"];
  const precoTampa = parametros["TAMPA"];
  if (nomeTrilho.includes("VARÃO SUÍÇO")) {
    const qtdTubo = ceiling(largura, 0.5);
    let qtdSuporte = 2;
    if (largura > 1.9 && largura <= 3.5) qtdSuporte = 3;
    else if (largura > 3.5 && largura <= 4.8) qtdSuporte = 4;
    else if (largura > 4.8) qtdSuporte = 4 + Math.ceil((largura - 4.8) / 1.5);
    const precoTubo = trilhos[nomeTrilho.trim()];
    trilho = arred((qtdTubo * precoTubo) + (qtdSuporte * precoSuporte) + (2 * precoTampa));
  } else {
    trilho = arred(ceiling(largura, 0.5) * precoTrilho);
  }

  const instalacao = parametros["INSTALAÇÃO"];
  const bucha = arred(Math.ceil(largura * 0.5) * parametros["BUCHA E PARAFUSO"]);

  const linhasCortina = [];
  linhasCortina.push({ label: `Tecido cortina: ${metragem} m`, valor: valorTecidoC });
  linhasCortina.push({ label: `Trilho`, valor: trilho });
  linhasCortina.push({ label: `Entrela`, valor: entrela });
  linhasCortina.push({ label: `Deslizante`, valor: deslizante });
  linhasCortina.push({ label: `Terminal`, valor: terminal });
  linhasCortina.push({ label: `Costura`, valor: costuraC });
  linhasCortina.push({ label: `Barra`, valor: barraC });
  linhasCortina.push({ label: `Instalação`, valor: instalacao });
  linhasCortina.push({ label: `Bucha e Parafuso`, valor: bucha });

  const linhasForro = [];
  linhasForro.push({ label: `Tecido forro: ${metragem} m`, valor: valorTecidoF });
  linhasForro.push({ label: `Costura (forro)`, valor: costuraF });
  linhasForro.push({ label: `Barra (forro)`, valor: barraF });
  
  const todasAsLinhas = [...linhasCortina, ...linhasForro];
  const subtotal = somarLinhas(todasAsLinhas);
  const simples = arred(subtotal * 0.06);
  const base = arred(subtotal + simples);
  const valorComMarkup = arred(base * 2.4);
  const valorCorrigido = arred(valorComMarkup / 0.879);
  const totalFinal = arred(valorCorrigido - desconto);

  const produto = `${ambiente} - Cortina ${nomeTecidoC} + Forro ${nomeTecidoF} - ${nomeTrilho}`;
  window.produtoCortinaForro = produto;

  const resumoHTML = `
    <h2>${produto}</h2>
    <p>Desconto: ${formatarReais(desconto)}</p>
    <p><strong>Valor final: ${formatarReais(totalFinal)}</strong></p>
  `;

  console.groupCollapsed(`🧮 Cálculo Detalhado - ${produto}`);
  console.log("CORTINA:");
  linhasCortina.forEach(l => console.log(" -", l.label, "=", formatarReais(l.valor)));

  console.log("FORRO:");
  linhasForro.forEach(l => console.log(" -", l.label, "=", formatarReais(l.valor)));

  console.log("Subtotal:", formatarReais(subtotal));
  console.log("+6%:", formatarReais(simples));
  console.log("x2.4:", formatarReais(valorComMarkup));
  console.log("/0.879:", formatarReais(valorCorrigido));
  console.log("DESCONTO FINAL:", formatarReais(desconto));
  console.log("TOTAL FINAL:", formatarReais(totalFinal));
  console.groupEnd();

  window.totalFinalCortinaForro = totalFinal;
  document.getElementById("resultadoCF").innerHTML = resumoHTML;

 
}

export { preencherSelectsCF, calcularCortinaForro };
