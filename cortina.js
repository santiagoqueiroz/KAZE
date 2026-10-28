// Versão do cortina.js com dados puxados do Firebase Firestore
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, auth, db } from "./firebase-config.js";
import { esc } from "./seguranca.js";
import { regras } from "./regras-preco.js";



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
  //const qtdTiras = (qtdTecidoBase / 3) % 1 < 0.4 ? Math.floor(qtdTecidoBase / 3) : Math.ceil(qtdTecidoBase / 3);
  const divisor = nomeTecido.toUpperCase().includes("VELUDO 1,40") ? 1.40 : 3;
  const qtdTiras = (qtdTecidoBase / divisor) % 1 < 0.4 ? Math.floor(qtdTecidoBase / divisor) : Math.ceil(qtdTecidoBase / divisor);
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

  let qtdSuporte = 0;
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
  const totalVista = arred(baseMaisSimples * regras.markup);
  const totalCorrigido = arred(totalVista / regras.fatorVista);
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

  const resumo = `
    <h2>${esc(produto)}</h2>
    <p>Desconto: ${formatarReais(desconto)}</p>
    <p><strong>Valor final: ${formatarReais(totalFinal)}</strong></p>`;

  console.groupCollapsed(`🧮 Cálculo Detalhado - ${produto}`);
console.log("🧵 Tecido:", `${qtdTecidoTotal} m x R$ ${precoTecido.toFixed(2)} = ${formatarReais(valorTecido)}`);
if (nomeTrilho.includes("VARÃO SUÍÇO")) {
  console.log("🪵 Trilho VARÃO SUÍÇO:");
  console.log("   Tubo:", `ceiling(${largura}m, 0.5) = ${ceiling(largura, 0.5)} m`);
  console.log("   Suportes:", `largura = ${largura}m → ${qtdSuporte} unidades`);
  console.log("   Tampas: 2 unidades");
  console.log("   Preço total do trilho: " + formatarReais(trilho));
} else {
  console.log("🛤️ Trilho:", `ceiling(${largura}m, 0.5) x R$ ${precoTrilho.toFixed(2)} = ${formatarReais(trilho)}`);
}
console.log("📐 Entrela:", `${qtdTecidoBase} m x R$ ${parametros["ENTRETELA"].toFixed(2)} = ${formatarReais(entrela)}`);
console.log("🧷 Deslizante:", `${qntDeslizante} x R$ ${parametros["DESLIZANTE"].toFixed(2)} = ${formatarReais(deslizante)}`);
console.log("🔩 Terminal:", `2 x R$ ${parametros["TERMINAL"].toFixed(2)} = ${formatarReais(terminal)}`);
console.log("🧵 Costura:", `${qtdTecidoTotal} m x R$ ${parametros["COSTURA"].toFixed(2)} = ${formatarReais(costura)}`);
console.log("📏 Barra:", `${qtdTecidoBase} m x R$ ${parametros["BARRA"].toFixed(2)} x ${multiplicadorFinalBarra} = ${formatarReais(barra)}`);
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

  window.totalFinalCortina = totalFinal;
  document.getElementById('resultadoC').innerHTML = resumo;
}
