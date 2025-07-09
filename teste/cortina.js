const tecidos = {
  "CETIM": 11.00,
  "MICROFIBRA": 6.70,
  "GAZE DE LINHO": 12.00,
  "LINHO DHL": 25.00,
  "LINHO FLAME": 16.00,
  "LINHO JEANS": 25.00,
  "LINHO CTX": 16.50,
  "LINHO POLLY": 18.00,
  "LINHO ROMA": 23.00,
  "OXFORD": 11.00,
  "SHANTUNG": 28.00,
  "TECIDO TELADO": 40.00,
  "VELUDO 1,40": 17.00,
  "VELUDO SILVER": 32.00,
  "VOIL LISO": 8.50,
  "VOIL TEXTURIZADO": 14.00,
  "BK 100% LAVÁVEL": 27.00,
  "BK 100% LINHÃO": 40.00,
  "BK 70% MESCLA": 38.00,
  "BK 70%": 23.00
};

const trilhos = {
  "TRILHO SUÍÇO SIMPLES": 8.50,
  "TRILHO SUÍÇO DUPLO": 11.00,
  "TRILHO SUÍÇO TRIPLO": 17.00,
  "TRILHO SUÍÇO FLEXÍVEL": 15.00,
  "SEM TRILHO": 0.00,
  "VARÃO SUÍÇO": 17.00,
  "VARÃO SUÍÇO DUPLO": 25.00
};

function arred(val) {
  return Math.round(val * 100) / 100;
}

function ceiling(val, step) {
  return Math.ceil(val / step) * step;
}

function formatarReais(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

window.preencherSelects = function () {
  const tecidoSelect = document.getElementById("tecido");
  const trilhoSelect = document.getElementById("trilho");

  if (!tecidoSelect || !trilhoSelect) return;

  for (const [nome, preco] of Object.entries(tecidos)) {
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
};

window.calcular = function () {
  const largura = parseFloat(document.getElementById('largura')?.value.replace(',', '.') || 0);
  const altura = parseFloat(document.getElementById('altura')?.value.replace(',', '.') || 0);
  const precoTecido = parseFloat(document.getElementById('tecido')?.value || 0);
  const tecidoSel = document.getElementById('tecido');
  const nomeTecido = tecidoSel?.options[tecidoSel.selectedIndex]?.text?.split(' - ')[0] || "";
  const trilhoSel = document.getElementById('trilho');
  const nomeTrilho = trilhoSel?.options[trilhoSel.selectedIndex]?.text?.split(' - ')[0] || "";
  const precoTrilho = parseFloat(trilhoSel?.value || 0);
  const desconto = parseFloat((document.getElementById('desconto')?.value || "0").replace(',', '.'));
  const ambiente = document.getElementById('ambiente')?.value || "Ambiente";
  const barraExtra = parseFloat(document.getElementById('barraExtra')?.value.replace(',', '.') || 0);
  const xBarraAlta = parseFloat(document.getElementById('xBarraAlta')?.value.replace(',', '.') || 1.4);
  const multiplicadorFinalBarra = altura > 3.5 ? xBarraAlta : 1;

  const qtdTecidoBase = arred((largura * 3.1) + 0.7);
  function arredondarTiras(valor) {
    const parteDecimal = valor % 1;
    return parteDecimal < 0.4 ? Math.floor(valor) : Math.ceil(valor);
  }
  const qtdTiras = arredondarTiras(qtdTecidoBase / 3);
  const alturaTira = arred(altura + 0.12 + barraExtra);

  let qtdTecidoTotal = altura > 2.6 ? arred(qtdTiras * alturaTira) : arred(qtdTecidoBase);

  const valorTecido = arred(qtdTecidoTotal * precoTecido);
  const entrela = arred(qtdTecidoBase * 1.64);
  const qntDeslizante = Math.ceil(((largura / 0.1) + 1) * 2);
  const deslizante = arred(qntDeslizante * 0.15);
  const terminal = arred(2 * 0.66);
  const costura = arred(qtdTecidoTotal * 8);
  const barra = arred(qtdTecidoBase * 5.50 * multiplicadorFinalBarra);
  const instalacao = 5.00;
  const kitsBucha = Math.ceil(largura * 0.5);
  const bucha = arred(kitsBucha * 4);

  let trilho = 0;
  const precoSuporte = 9.00;
  const precoTampa = 2.00;

  if (nomeTrilho.includes("VARÃO SUÍÇO")) {
    const qtdTubo = ceiling(largura, 0.5);
    let qtdSuporte = 2;
    if (largura > 1.9 && largura <= 3.5) qtdSuporte = 3;
    else if (largura > 3.5 && largura <= 4.8) qtdSuporte = 4;
    else if (largura > 4.8) qtdSuporte = 4 + Math.ceil((largura - 4.8) / 1.5);

    const precoTubo = trilhos[nomeTrilho];
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
    { label: `Entrela: ${qtdTecidoBase} m x R$ 1,64`, valor: entrela },
    { label: `Deslizante: ${qntDeslizante} x R$ 0,15`, valor: deslizante },
    { label: `Terminal: 2 x R$ 0,66`, valor: terminal },
    { label: `Costura: ${qtdTecidoTotal} m x R$ 8,00`, valor: costura },
    { label: `Barra: ${qtdTecidoBase} m x R$ 5,50 x ${multiplicadorFinalBarra}`, valor: barra },
    { label: `Instalação`, valor: instalacao },
    { label: `Bucha e Parafuso: ${kitsBucha} x R$ 4,00`, valor: bucha },
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
};
