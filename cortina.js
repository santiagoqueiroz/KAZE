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

  const trilho = arred(trilhoSel);
  const trilhoDetalhes = `Trilho: R$ ${trilho.toFixed(2)}`;

  const subtotal = arred(valorTecido + entrela + deslizante + terminal + costura + barra + instalacao + bucha + trilho);
  const simples = 14.15;
  const totalVista = arred(subtotal * 2.4);
  const fatorCartao = 0.879;
  const totalCorrigido = arred(totalVista / fatorCartao);
  const totalComDesconto = arred(totalCorrigido - desconto);
  const totalFinal = arred(totalComDesconto + simples);

  const detalhamento = `
Tecido: ${qtdTecidoTotal} m x R$ ${precoTecido.toFixed(2)} = R$ ${valorTecido.toFixed(2)}
Entrela: ${qtdTecidoBase} m x R$ 1,64 = R$ ${entrela.toFixed(2)}
Deslizante: ((largura / 0,1)+1)*2 = ${qntDeslizante} x R$ 0,15 = R$ ${deslizante.toFixed(2)}
Terminal: 2 x R$ 0,60 = R$ ${terminal.toFixed(2)}
Costura: ${qtdTecidoTotal} m x R$ 8,00 = R$ ${costura.toFixed(2)}
Barra: ${qtdTecidoBase} m x R$ 4,00 = R$ ${barra.toFixed(2)}
Instalação: R$ ${instalacao.toFixed(2)}
Bucha e Parafuso: R$ ${bucha.toFixed(2)}
${trilhoDetalhes}
Subtotal: R$ ${subtotal.toFixed(2)}
Markup (2,4x): R$ ${totalVista.toFixed(2)}
Ajuste Cartão (/0.879): R$ ${totalCorrigido.toFixed(2)}
Desconto: R$ ${desconto.toFixed(2)}
Simples Nacional: R$ ${simples.toFixed(2)}
TOTAL FINAL: R$ ${totalFinal.toFixed(2)}
`;

  document.getElementById('resultado').textContent = detalhamento;
}
