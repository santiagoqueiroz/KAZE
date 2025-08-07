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

  const selTecido = document.getElementById("tecidoCF");
  const selTrilho = document.getElementById("trilhoCF");

  selTecido.innerHTML = "";
  selTrilho.innerHTML = "";

  for (const [nome, preco] of Object.entries(tecidos).sort()) {
    const o = document.createElement("option");
    o.value = preco;
    o.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
    selTecido.appendChild(o);
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
  const selTecido = document.getElementById("tecidoCF");
  const selTrilho = document.getElementById("trilhoCF");

  const precoTecido = parseFloat(selTecido.value || 0);
  const precoTrilho = parseFloat(selTrilho.value || 0);
  const nomeTecidoC = selTecido.selectedOptions[0].text.split(" - ")[0];
  const nomeTecidoF = selTecido.selectedOptions[0].text.split(" - ")[0];
  const nomeTrilho = selTrilho.selectedOptions[0].text.split(" - ")[0];
  const ambiente = document.getElementById("ambienteCF")?.value || "Ambiente";

  const barraExtra = 0.40;
  const xBarraAlta = 1.4;

  const alturaTira = arred(altura + 0.12 + barraExtra);
  const qtdBase = arred((largura * 3.1) + 0.7);
  const qtdTiras = (qtdBase / 3) % 1 < 0.4 ? Math.floor(qtdBase / 3) : Math.ceil(qtdBase / 3);
  const metragem = arred(altura > 2.6 ? (qtdTiras * alturaTira) : qtdBase);

  const metragemTotalTecido = arred(metragem * 2);

  const valorTecidoC = arred(metragem * precoTecido);
  const valorTecidoF = arred(metragem * precoTecido);

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

  const subtotalC = somarLinhas(linhasCortina);
  const simplesC = arred(subtotalC * 0.06);
  const baseC = arred(subtotalC + simplesC);
  const totalC = arred(baseC * 2.4 / 0.879);

  const subtotalF = somarLinhas(linhasForro);
  const simplesF = arred(subtotalF * 0.06);
  const baseF = arred(subtotalF + simplesF);
  const totalF = arred(baseF * 2.4 / 0.879);

  const produto = `${ambiente} - Cortina ${nomeTecidoC} + Forro ${nomeTecidoF} - ${nomeTrilho}`;
  window.produtoCortinaForro = produto;
  const produto = `${ambiente} - Cortina + Forro ${nomeTecido} - ${nomeTrilho}`;

  const resumoHTML = `
    <h2>${produto}</h2>
    <p><strong>Valor final: ${formatarReais(totalFinal)}</strong></p>
  `;

  console.groupCollapsed(`🧮 Cálculo Detalhado - ${produto}`);
  console.log("CORTINA:");
  linhasCortina.forEach(l => console.log(" -", l.label, "=", formatarReais(l.valor)));
  console.log("Subtotal:", formatarReais(subtotalC));
  console.log("+6%:", formatarReais(simplesC));
  console.log("x2.4:", formatarReais(baseC * 2.4));
  console.log("/0.879:", formatarReais(totalC));
  console.log("FORRO:");
  linhasForro.forEach(l => console.log(" -", l.label, "=", formatarReais(l.valor)));
  console.log("Subtotal:", formatarReais(subtotalF));
  console.log("+6%:", formatarReais(simplesF));
  console.log("x2.4:", formatarReais(baseF * 2.4));
  console.log("/0.879:", formatarReais(totalF));
  console.log("TOTAL FINAL:", formatarReais(totalFinal));
  console.groupEnd();

  window.totalFinalCortinaForro = totalFinal;
  window.totalCortinaCF = totalC;
  window.totalForroCF = totalF;
  document.getElementById("resultadoCF").innerHTML = resumoHTML;
}

export { preencherSelectsCF, calcularCortinaForro };
