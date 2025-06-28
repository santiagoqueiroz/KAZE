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
  "Trilho Suíço Simples": 8.50,
  "Trilho Suíço Duplo": 11.00,
  "Trilho Suíço Triplo": 17.00,
  "Trilho Suíço Flexível": 15.00,
  "Varão Suíço": -1
};

function arred(val) {
  return Math.round(val * 100) / 100;
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
    opt.textContent = nome + (preco > 0 ? ` - R$ ${preco.toFixed(2)}` : "");
    trilhoSelect.appendChild(opt);
  }
}

window.onload = preencherSelects;

function calcular() {
  const largura = parseFloat(document.getElementById('largura').value);
  const altura = parseFloat(document.getElementById('altura').value);
  const precoTecido = parseFloat(document.getElementById('tecido').value);
  const trilhoSel = parseFloat(document.getElementById('trilho').value);

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
  const deslizante = arred(largura * 32 * 0.15);
  const terminal = arred(2 * 0.60);
  const costura = arred(qtdTecidoTotal * 8);
  const barra = arred(qtdTecidoBase * 4);
  const instalacao = 5.00;
  const bucha = arred(1 * 4);

  let trilho = 0;
  if (trilhoSel === -1) {
    const tubo = arred(largura * 17);
    const suporte = arred(3 * 9);
    const tampas = arred(2 * 2);
    trilho = arred(tubo + suporte + tampas);
  } else {
    trilho = arred(trilhoSel);
  }

  const subtotal = arred(valorTecido + entrela + deslizante + terminal + costura + barra + instalacao + bucha + trilho);
  const simples = 14.15;
  const totalVista = arred(subtotal * 2.4);
  const totalFinal = arred(totalVista + simples);

  document.getElementById('resultado').innerHTML = `
    <p>Subtotal: R$ ${subtotal.toFixed(2)}</p>
    <p>Total à Vista (com markup): R$ ${totalVista.toFixed(2)}</p>
    <p>Total Final (com Simples Nacional): <strong>R$ ${totalFinal.toFixed(2)}</strong></p>
  `;
}
