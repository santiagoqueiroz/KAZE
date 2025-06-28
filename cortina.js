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
  "TRILHO SUÍÇO SIMPLES": 12.75,
  "TRILHO SUÍÇO DUPLO": 16.50,
  "TRILHO SUÍÇO TRIPLO": 25.50,
  "TRILHO SUÍÇO FLEXÍVEL": 22.50,
  "SEM TRILHO": 0.00,
  "VARÃO SUÍÇO": 47.50,
  "VARÃO SUÍÇO DUPLO": 59.50
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
  const trilhoSel = parseFloat(document.getElementById('trilho').value);
  const descontoInput = document.getElementById('desconto');
  const desconto = parseFloat(descontoInput?.value || 0);

  const qtdTecidoBase = arred((largura * 3.1) + 0.7);
  let qtdTecidoTotal = altura > 2.6 ? arred((altura + 0.12 + 0.40) * 2) : qtdTecidoBase;

  const valorTecido = arred(qtdTecidoTotal * precoTecido);
  const entrela = arred(qtdTecidoBase * 1.64);
  const qntDeslizante = Math.ceil(((largura / 0.1) + 1) * 2);
  const deslizante = arred(qntDeslizante * 0.15);
  const terminal = arred(2 * 0.60);
  const costura = arred(qtdTecidoTotal * 8);
  const barra = arred(qtdTecidoBase * 4);
  const instalacao = 5.00;
  const bucha = arred(1 * 4);
  const trilho = arred(trilhoSel);

  const subtotal = arred(valorTecido + entrela + deslizante + terminal + costura + barra + instalacao + bucha + trilho);
  const simples = arred(subtotal * 0.06);
  const baseMaisSimples = arred(subtotal + simples);
  const totalVista = arred(baseMaisSimples * 2.4);
  const fatorCartao = 0.879;
  const totalCorrigido = arred(totalVista / fatorCartao);
  const totalComDesconto = arred(totalCorrigido - desconto);

  const linhas = [
    [`Tecido`, `${qtdTecidoTotal} m x R$ ${precoTecido.toFixed(2)}`, valorTecido],
    [`Trilho`, ``, trilho],
    [`Costura`, `${qtdTecidoTotal} m x R$ 8,00`, costura],
    [`Barra`, `${qtdTecidoBase} m x R$ 4,00`, barra],
    [`Entrela`, `${qtdTecidoBase} m x R$ 1,64`, entrela],
    [`Instalação`, ``, instalacao],
    [`Deslizante`, `${qntDeslizante} x R$ 0,15`, deslizante],
    [`Bucha e Parafuso`, ``, bucha],
    [`Terminal`, `2 x R$ 0,60`, terminal]
  ];

  let tabela = `<table border='1' cellpadding='5' cellspacing='0'><tr><th>Item</th><th>Cálculo</th><th>Valor (R$)</th></tr>`;
  linhas.forEach(([nome, desc, val]) => {
    tabela += `<tr><td>${nome}</td><td>${desc}</td><td>${val.toFixed(2)}</td></tr>`;
  });
  tabela += `</table>`;

  tabela += `<p>Subtotal: R$ ${subtotal.toFixed(2)}</p>`;
  tabela += `<p>Simples Nacional (6%): R$ ${simples.toFixed(2)}</p>`;
  tabela += `<p>Subtotal + Simples: R$ ${baseMaisSimples.toFixed(2)}</p>`;
  tabela += `<p>Markup (2,4x): R$ ${totalVista.toFixed(2)}</p>`;
  tabela += `<p>Ajuste Cartão (/0.879): R$ ${totalCorrigido.toFixed(2)}</p>`;
  tabela += `<p>Desconto: R$ ${desconto.toFixed(2)}</p>`;
  tabela += `<h3>TOTAL FINAL: R$ ${totalComDesconto.toFixed(2)}</h3>`;

  document.getElementById('resultado').innerHTML = tabela;
}
