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

function preencherSelects() {
  const tecidoSelect = document.getElementById("tecido");
  const trilhoSelect = document.getElementById("trilho");

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

  const descontoInput = document.createElement("input");
  descontoInput.id = "desconto";
  descontoInput.type = "number";
  descontoInput.step = "0.01";
  descontoInput.placeholder = "Desconto em R$";
  descontoInput.style.marginTop = "10px";
  descontoInput.addEventListener("input", calcular);
  document.body.insertBefore(descontoInput, document.getElementById("resultado"));
}

window.onload = () => {
  preencherSelects();
  calcular();
};

function calcular() {
  const largura = parseFloat(document.getElementById('largura').value);
  const altura = parseFloat(document.getElementById('altura').value);
  const precoTecido = parseFloat(document.getElementById('tecido').value);
  const trilhoSel = document.getElementById('trilho');
  const nomeTrilho = trilhoSel.options[trilhoSel.selectedIndex].text.split(' - ')[0];
  const precoTrilho = parseFloat(trilhoSel.value);
  const descontoInput = document.getElementById('desconto');
  const desconto = parseFloat(descontoInput?.value || 0);

  const qtdTecidoBase = arred((largura * 3.1) + 0.7);
  let qtdTecidoTotal = 0;

  if (altura > 2.6) {
    const tira = arred(altura + 0.12 + 0.40);
    qtdTecidoTotal = arred(tira * 2);
  } else {
    qtdTecidoTotal = qtdTecidoBase;
  }

  const valorTecido = arred(qtdTecidoTotal * precoTecido);
  const entrela = arred(qtdTecidoBase * 1.64);
  const qntDeslizante = Math.ceil(((largura / 0.1) + 1) * 2);
  const deslizante = arred(qntDeslizante * 0.15);
  const terminal = arred(2 * 0.60);
  const costura = arred(qtdTecidoTotal * 8);
  const barra = arred(qtdTecidoBase * 4);
  const instalacao = 5.00;
  const bucha = arred(1 * 4);

  let trilho = 0;
  if (nomeTrilho.includes("VARÃO SUÍÇO")) {
    const tubo = ceiling(largura, 0.5) * trilhos[nomeTrilho];
    const suporte = 3 * 9.00;
    const tampa = 2 * 2.00;
    trilho = arred(tubo + suporte + tampa);
  } else {
    trilho = arred(ceiling(largura, 0.5) * precoTrilho);
  }

  const subtotal = arred(valorTecido + entrela + deslizante + terminal + costura + barra + instalacao + bucha + trilho);
  const simples = arred(subtotal * 0.06);
  const baseMaisSimples = arred(subtotal + simples);
  const totalVista = arred(baseMaisSimples * 2.4);
  const fatorCartao = 0.879;
  const totalCorrigido = arred(totalVista / fatorCartao);
  const totalComDesconto = arred(totalCorrigido - desconto);
  const totalFinal = totalComDesconto;

  const linhas = [
    { label: `Tecido: ${qtdTecidoTotal} m x R$ ${precoTecido.toFixed(2)}`, valor: valorTecido },
    { label: `Trilho`, valor: trilho },
    { label: `Costura: ${qtdTecidoTotal} m x R$ 8,00`, valor: costura },
    { label: `Barra: ${qtdTecidoBase} m x R$ 4,00`, valor: barra },
    { label: `Entrela: ${qtdTecidoBase} m x R$ 1,64`, valor: entrela },
    { label: `Deslizante: ${qntDeslizante} x R$ 0,15`, valor: deslizante },
    { label: `Bucha e Parafuso`, valor: bucha },
    { label: `Instalação`, valor: instalacao },
    { label: `Terminal: 2 x R$ 0,60`, valor: terminal },
  ];

  const tabela = `<table><tr><th>Item</th><th>Valor (R$)</th></tr>` +
    linhas.map(l => `<tr><td>${l.label}</td><td>${l.valor.toFixed(2)}</td></tr>`).join('') +
    `<tr><td><strong>Subtotal</strong></td><td>${subtotal.toFixed(2)}</td></tr>` +
    `<tr><td>Simples Nacional (6%)</td><td>${simples.toFixed(2)}</td></tr>` +
    `<tr><td>Subtotal + Simples</td><td>${baseMaisSimples.toFixed(2)}</td></tr>` +
    `<tr><td>Markup (2,4x)</td><td>${totalVista.toFixed(2)}</td></tr>` +
    `<tr><td>Ajuste Cartão (/0.879)</td><td>${totalCorrigido.toFixed(2)}</td></tr>` +
    `<tr><td>Desconto</td><td>${desconto.toFixed(2)}</td></tr>` +
    `<tr><td><strong>TOTAL FINAL</strong></td><td><strong>${totalFinal.toFixed(2)}</strong></td></tr></table>`;

  document.getElementById('resultado').innerHTML = tabela;
}
