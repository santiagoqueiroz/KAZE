// Versão do cortina.js com dados puxados do Firebase Firestore
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5kVoWRWZB6xtacyu6lH--QFXry_MPKps",
  authDomain: "kaze-8836b.firebaseapp.com",
  projectId: "kaze-8836b",
  storageBucket: "kaze-8836b.appspot.com",
  messagingSenderId: "336054068300",
  appId: "1:336054068300:web:6125e8eecc08d667fac0e9"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let tecidos = {};  // será preenchido do Firestore
let trilhos = {};  // idem
let parametros = {};  // idem

function arred(val) {
  return Math.round(val * 100) / 100;
}

function ceiling(val, step) {
  return Math.ceil(val / step) * step;
}

function formatarReais(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function preencherSelects() {
  const tecidoSelect = document.getElementById("tecido");
  const trilhoSelect = document.getElementById("trilho");
  if (!tecidoSelect || !trilhoSelect) return;

  const docTecidos = await getDoc(doc(db, "precos", "tecidos"));
  const docTrilhos = await getDoc(doc(db, "precos", "trilhos"));
  const docParametros = await getDoc(doc(db, "precos", "parametros"));

  tecidos = docTecidos.exists() ? docTecidos.data() : {};
  trilhos = docTrilhos.exists() ? docTrilhos.data() : {};
  parametros = docParametros.exists() ? docParametros.data() : {};

  for (const [nome, preco] of Object.entries(tecidos).sort((a, b) => a[0].localeCompare(b[0]))) {
    const opt = document.createElement("option");
    opt.value = preco;
    opt.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
    tecidoSelect.appendChild(opt);
  }

  for (const [nome, preco] of Object.entries(trilhos)) {
    const opt = document.createElement("option");
    opt.value = preco;
    opt.textContent = `${nome} - R$ ${preco.toFixed(2)}`;
    trilhoSelect.appendChild(opt);
  }
}

export function calcularCortina() {
  const largura = parseFloat(document.getElementById('larguraC')?.value.replace(',', '.') || 0);
  const altura = parseFloat(document.getElementById('alturaC')?.value.replace(',', '.') || 0);
  const precoTecido = parseFloat(document.getElementById('tecido')?.value || 0);
  const tecidoSel = document.getElementById('tecido');
  const nomeTecido = tecidoSel?.options[tecidoSel.selectedIndex]?.text?.split(' - ')[0] || "";
  const trilhoSel = document.getElementById('trilho');
  const nomeTrilho = trilhoSel?.options[trilhoSel.selectedIndex]?.text?.split(' - ')[0] || "";
  const precoTrilho = parseFloat(trilhoSel?.value || 0);
  const desconto = parseFloat((document.getElementById('descontoC')?.value || "0").replace(',', '.'));
  const ambiente = document.getElementById('ambienteC')?.value || "Ambiente";
  const barraExtra = parseFloat(document.getElementById('barraExtra')?.value.replace(',', '.') || 0);
  const xBarraAlta = parseFloat(document.getElementById('xBarraAlta')?.value.replace(',', '.') || 1.4);
  const multiplicadorFinalBarra = altura > 3.5 ? xBarraAlta : 1;

  const qtdTecidoBase = arred((largura * 3.1) + 0.7);
  const qtdTiras = (qtdTecidoBase / 3) % 1 < 0.4 ? Math.floor(qtdTecidoBase / 3) : Math.ceil(qtdTecidoBase / 3);
  const alturaTira = arred(altura + 0.12 + barraExtra);
  let qtdTecidoTotal = altura > 2.6 ? arred(qtdTiras * alturaTira) : arred(qtdTecidoBase);

  const valorTecido = arred(qtdTecidoTotal * precoTecido);
  const entrela = arred(qtdTecidoBase * parametros["ENTRETELA"]);
  const qntDeslizante = Math.ceil(((largura / 0.1) + 1) * 2);
  const deslizante = arred(qntDeslizante * parametros["DESLIZANTE"]);
  const terminal = arred(2 * parametros["TERMINAL"]);
  const costura = arred(qtdTecidoTotal * parametros["COSTURA"]);
  const barra = arred(qtdTecidoBase * parametros["BARRA"] * multiplicadorFinalBarra);
  const instalacao = parametros["INSTALAÇÃO"];
  const kitsBucha = Math.ceil(largura * 0.5);
  const bucha = arred(kitsBucha * parametros["BUCHA E PARAFUSO"]);

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

  const subtotal = arred(valorTecido + trilho + entrela + deslizante + terminal + costura + barra + instalacao + bucha);
  const simples = arred(subtotal * 0.06);
  const baseMaisSimples = arred(subtotal + simples);
  const totalVista = arred(baseMaisSimples * 2.4);
  const totalCorrigido = arred(totalVista / 0.879);
  const totalFinal = arred(totalCorrigido - desconto);

  const produto = `${ambiente} - Cortina ${nomeTecido} - ${nomeTrilho}`;

  const linhas = [
    { label: `Tecido: ${qtdTecidoTotal} m x R$ ${precoTecido.toFixed(2)}`, valor: valorTecido },
    { label: `Trilho`, valor: trilho },
    { label: `Entrela: ${qtdTecidoBase} m x R$ ${parametros["ENTRETELA"].toFixed(2)}`, valor: entrela },
    { label: `Deslizante: ${qntDeslizante} x R$ ${parametros["DESLIZANTE"].toFixed(2)}`, valor: deslizante },
    { label: `Terminal: 2 x R$ ${parametros["TERMINAL"].toFixed(2)}`, valor: terminal },
    { label: `Costura: ${qtdTecidoTotal} m x R$ ${parametros["COSTURA"].toFixed(2)}`, valor: costura },
    { label: `Barra: ${qtdTecidoBase} m x R$ ${parametros["BARRA"].toFixed(2)} x ${multiplicadorFinalBarra}`, valor: barra },
    { label: `Instalação`, valor: instalacao },
    { label: `Bucha e Parafuso: ${kitsBucha} x R$ ${parametros["BUCHA E PARAFUSO"].toFixed(2)}`, valor: bucha },
  ];

  const tabela = `
    <style>
      table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
      th, td { border-top: 1px solid #ccc; padding: 8px; text-align: right; }
      th:first-child, td:first-child { text-align: left; }
      tr:nth-child(even) { background-color: #f9f9f9; }
      tr:last-child td { font-weight: bold; color: #1a1a1a; background-color: #e0e0e0; }
    </style>
    <h2>${produto}</h2>
    <table>
      <tr><th>Item</th><th>Valor (R$)</th></tr>
      ${linhas.map(l => `<tr><td>${l.label}</td><td>${formatarReais(l.valor)}</td></tr>`).join('')}
      <tr><td><strong>Subtotal</strong></td><td>${formatarReais(subtotal)}</td></tr>
      <tr><td>Simples Nacional (6%)</td><td>${formatarReais(simples)}</td></tr>
      <tr><td>Subtotal + Simples</td><td>${formatarReais(baseMaisSimples)}</td></tr>
      <tr><td>Markup (2,4x)</td><td>${formatarReais(totalVista)}</td></tr>
      <tr><td>Ajuste Cartão (/0.879)</td><td>${formatarReais(totalCorrigido)}</td></tr>
      <tr><td>Desconto</td><td>${formatarReais(desconto)}</td></tr>
      <tr><td><strong>TOTAL FINAL</strong></td><td><strong>${formatarReais(totalFinal)}</strong></td></tr>
    </table>
  `;

  document.getElementById('resultado').innerHTML = tabela;
}
