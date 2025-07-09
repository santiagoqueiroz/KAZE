// blackout.js — cálculo baseado nas regras do BK
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const db = getFirestore(getApp());

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

export async function preencherSelects() {
  const tecidoSelect = document.getElementById("tecido");
  const trilhoSelect = document.getElementById("trilho");
  if (!tecidoSelect || !trilhoSelect) return;

  const docTecidos = await getDoc(doc(db, "precos", "tecidos_bk"));
  const docTrilhos = await getDoc(doc(db, "precos", "trilhos"));
  const docParametros = await getDoc(doc(db, "precos", "parametros"));

  tecidos = docTecidos.exists() ? docTecidos.data() : {};
  trilhos = docTrilhos.exists() ? docTrilhos.data() : {};
  parametros = docParametros.exists() ? docParametros.data() : {};

  for (const [nome, preco] of Object.entries(tecidos).sort()) {
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

export function calcularBlackout() {
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

  // Cálculo do tecido total conforme altura
  let tecidoBase = 0;
  let qtdTiras = 1;
  let alturaFinal = arred(altura + 0.10 + 0.15);
  let qtdTecidoTotal = 0;

  if (altura <= 2.8) {
    tecidoBase = arred(largura + 0.8);
    qtdTecidoTotal = tecidoBase;
  } else if (altura <= 3.0) {
    tecidoBase = arred(largura + 0.8 + ((altura - 2.8) * 2));
    qtdTecidoTotal = tecidoBase;
  } else {
    const bruto = (largura + 0.8) / 2.8;
    const decimal = bruto % 1;
    if (decimal <= 0.14) qtdTiras = Math.floor(bruto);
    else if (decimal <= 0.5) qtdTiras = Math.floor(bruto) + 0.5;
    else qtdTiras = Math.ceil(bruto);
    qtdTecidoTotal = arred(alturaFinal * qtdTiras);
    tecidoBase = arred(largura + 0.8); // ✅ define um valor para cálculo do deslizante, terminal e barra
  }

  const valorTecido = arred(qtdTecidoTotal * precoTecido);
  const entrela = arred(tecidoBase * parametros["ENTRETELA BK"]);
  const qtdDeslizante = Math.ceil(tecidoBase / 0.08);
  const deslizante = arred(qtdDeslizante * parametros["DESLIZANTE"]);
  const terminal = arred(2 * parametros["TERMINAL"]);
  const costura = arred(qtdTecidoTotal * parametros["COSTURA"]);
  const barra = arred(tecidoBase * parametros["BARRA"]);
  const instalacao = parametros["INSTALAÇÃO"];
  const kitsBucha = Math.ceil(largura);
  const bucha = arred(kitsBucha * parametros["BUCHA E PARAFUSO"]);

  // Trilho
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

  const produto = `${ambiente} - Blackout ${nomeTecido} - ${nomeTrilho}`;

    const linhas = [
    { label: `Tecido: ${qtdTecidoTotal} m x R$ ${precoTecido.toFixed(2)}`, valor: valorTecido },
    { label: `Trilho`, valor: trilho },
    { label: `Entretela: ${tecidoBase} m x R$ ${parametros["ENTRETELA BK"].toFixed(2)}`, valor: entrela },
    { label: `Deslizante: ${qtdDeslizante} x R$ ${parametros["DESLIZANTE"].toFixed(2)}`, valor: deslizante },
    { label: `Terminal: 2 x R$ ${parametros["TERMINAL"].toFixed(2)}`, valor: terminal },
    { label: `Costura: ${qtdTecidoTotal} m x R$ ${parametros["COSTURA"].toFixed(2)}`, valor: costura },
    { label: `Barra: ${tecidoBase} m x R$ ${parametros["BARRA"].toFixed(2)}`, valor: barra },
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

    console.groupCollapsed(`🧮 Cálculo Detalhado - ${produto}`);
    console.log("🧵 Tecido:", `${qtdTecidoTotal} m x R$ ${precoTecido.toFixed(2)} = ${formatarReais(valorTecido)}`);
    if (nomeTrilho.includes("VARÃO SUÍÇO")) {
    const qtdTubo = ceiling(largura, 0.5);
    let qtdSuporte = 2;
    if (largura > 1.9 && largura <= 3.5) qtdSuporte = 3;
    else if (largura > 3.5 && largura <= 4.8) qtdSuporte = 4;
    else if (largura > 4.8) qtdSuporte = 4 + Math.ceil((largura - 4.8) / 1.5);
  
    console.log("🪵 Trilho VARÃO SUÍÇO:");
    console.log("   Tubo:", `${qtdTubo} m`);
    console.log("   Suportes:", `largura = ${largura}m → ${qtdSuporte} unidades`);
    console.log("   Tampas: 2 unidades");
    console.log("   Preço total do trilho: " + formatarReais(trilho));
  } else {
    console.log("🛤️ Trilho:", `ceiling(${largura}m, 0.5) x R$ ${precoTrilho.toFixed(2)} = ${formatarReais(trilho)}`);
  }
    console.log("📐 Entretela:", `${tecidoBase} m x R$ ${parametros["ENTRETELA BK"].toFixed(2)} = ${formatarReais(entrela)}`);
    console.log("🧷 Deslizante:", `${qtdDeslizante} x R$ ${parametros["DESLIZANTE"].toFixed(2)} = ${formatarReais(deslizante)}`);
    console.log("🔩 Terminal:", `2 x R$ ${parametros["TERMINAL"].toFixed(2)} = ${formatarReais(terminal)}`);
    console.log("🧵 Costura:", `${qtdTecidoTotal} m x R$ ${parametros["COSTURA"].toFixed(2)} = ${formatarReais(costura)}`);
    console.log("📏 Barra:", `${tecidoBase} m x R$ ${parametros["BARRA"].toFixed(2)} = ${formatarReais(barra)}`);
    console.log("🛠️ Instalação:", formatarReais(instalacao));
    console.log("🔧 Bucha e Parafuso:", `${kitsBucha} x R$ ${parametros["BUCHA E PARAFUSO"].toFixed(2)} = ${formatarReais(bucha)}`);
    console.log("🧮 Subtotal:", formatarReais(subtotal));
    console.log("📊 Simples Nacional (6%):", formatarReais(simples));
    console.log("➕ Subtotal + Simples:", formatarReais(baseMaisSimples));
    console.log("📈 Markup (2,4x):", formatarReais(totalVista));
    console.log("💳 Ajuste Cartão (/0.879):", formatarReais(totalCorrigido));
    console.log("🏷️ Desconto:", formatarReais(desconto));
    console.log("💰 TOTAL FINAL:", formatarReais(totalFinal));
    console.groupEnd();

  document.getElementById('resultado').innerHTML = tabela;
}
