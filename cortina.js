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

  const ambienteInput = document.createElement("input");
  ambienteInput.id = "ambiente";
  ambienteInput.placeholder = "Ambiente";
  ambienteInput.style.marginTop = "10px";
  ambienteInput.addEventListener("input", calcular);
  document.body.insertBefore(ambienteInput, document.getElementById("resultado"));

  const descontoInput = document.createElement("input");
  descontoInput.id = "desconto";
  descontoInput.type = "number";
  descontoInput.step = "0.01";
  descontoInput.placeholder = "Desconto em R$";
  descontoInput.style.marginTop = "10px";
  descontoInput.addEventListener("input", calcular);
  document.body.insertBefore(descontoInput, document.getElementById("resultado"));

  const barraExtraInput = document.createElement("input");
  barraExtraInput.id = "barraExtra";
  barraExtraInput.placeholder = "Barra (ex: 0,40)";
  barraExtraInput.value = "0,40";
  barraExtraInput.style.marginTop = "10px";
  barraExtraInput.addEventListener("input", calcular);
  document.body.insertBefore(barraExtraInput, document.getElementById("resultado"));
}

window.onload = () => {
  preencherSelects();
  calcular();
};

function calcular() {
  const largura = parseFloat(document.getElementById('largura').value.replace(',', '.'));
  const altura = parseFloat(document.getElementById('altura').value.replace(',', '.'));
  const precoTecido = parseFloat(document.getElementById('tecido').value);
  const tecidoSel = document.getElementById('tecido');
  const nomeTecido = tecidoSel.options[tecidoSel.selectedIndex].text.split(' - ')[0];
  const trilhoSel = document.getElementById('trilho');
  const nomeTrilho = trilhoSel.options[trilhoSel.selectedIndex].text.split(' - ')[0];
  const precoTrilho = parseFloat(trilhoSel.value);
  const desconto = parseFloat((document.getElementById('desconto')?.value || "0").replace(',', '.'));
  const ambiente = document.getElementById('ambiente')?.value || "Ambiente";
  const barraExtra = parseFloat((document.getElementById('barraExtra')?.value || "0.40").replace(',', '.'));

  const qtdTecidoBase = arred((largura * 3.1) + 0.7);
  const qtdTiras = Math.ceil(qtdTecidoBase / 3);
  const alturaTira = arred(altura + 0.12 + barraExtra);

  let qtdTecidoTotal = altura > 2.6 ? arred(qtdTiras * alturaTira) : arred(qtdTecidoBase);

  const valorTecido = arred(qtdTecidoTotal * precoTecido);
  const entrela = arred(qtdTecidoBase * 1.64);
  const qntDeslizante = Math.ceil(((largura / 0.1) + 1) * 2);
  const deslizante = arred(qntDeslizante * 0.15);
  const terminal = arred(2 * 0.60);
  const costura = arred(qtdTecidoTotal * 8);
  const barra = arred(qtdTecidoBase * 4);
  const instalacao = 5.00;
  const kitsBucha = Math.ceil(largura * 0.5);
  const bucha = arred(kitsBucha * 4);

  let trilho = 0;
  if (nomeTrilho.includes("VARÃO SUÍÇO")) {
    const qtdTubo = Math.ceil(largura);
    const qtdSuporte = Math.ceil(largura / 1.1);
    const precoTubo = trilhos[nomeTrilho];
    const precoSuporte = 9.00;
    const precoTampa = 2.00;
    trilho = arred((qtdTubo * precoTubo) + (qtdSuporte * precoSuporte) + (2 * precoTampa));
  } else {
    trilho = arred(ceiling(largura, 0.5) * precoTrilho);
  }

  const subtotal = arred(valorTecido + trilho + entrela + deslizante + terminal + costura + barra + instalacao + bucha);
  const simples = arred(subtotal * 0.06);
  const baseMaisSimples = arred(subtotal + simples);
  const totalVista = arred(baseMaisSimples * 2.4);
  const fatorCartao = 0.879;
  const totalCorrigido = arred(totalVista / fatorCartao);
  const totalFinal = arred(totalCorrigido - desconto);

  const produto = `${ambiente} - Cortina ${nomeTecido} - ${nomeTrilho}`;

  const detalhes = [
    `Tecido: ${qtdTecidoTotal} m x R$ ${precoTecido.toFixed(2)} = ${formatarReais(valorTecido)}`,
    `Trilho = ${formatarReais(trilho)}`,
    `Entrela: ${qtdTecidoBase} m x R$ 1,64 = ${formatarReais(entrela)}`,
    `Deslizante: ${qntDeslizante} x R$ 0,15 = ${formatarReais(deslizante)}`,
    `Terminal: 2 x R$ 0,60 = ${formatarReais(terminal)}`,
    `Costura: ${qtdTecidoTotal} m x R$ 8,00 = ${formatarReais(costura)}`,
    `Barra: ${qtdTecidoBase} m x R$ 4,00 = ${formatarReais(barra)}`,
    `Instalação = ${formatarReais(instalacao)}`,
    `Bucha e Parafuso: ${kitsBucha} x R$ 4,00 = ${formatarReais(bucha)}`
  ];

  const adicionais = [
    `Simples Nacional (6%) = ${formatarReais(simples)}`,
    `Subtotal + Simples = ${formatarReais(baseMaisSimples)}`,
    `Markup (2,4x) = ${formatarReais(totalVista)}`,
    `Ajuste Cartão (/0.879) = ${formatarReais(totalCorrigido)}`,
    `Desconto = ${formatarReais(desconto)}`
  ];

  const tabela =
    '<div style="font-family:sans-serif; max-width:600px;">' +
      '<h2 style="margin-bottom:0;">' + produto + '</h2>' +
      '<div style="font-size:0.9em; margin-bottom:16px; color:#555;">' +
        detalhes.join('<br>') +
      '</div>' +
      '<div style="margin-bottom:10px;"><strong>Subtotal: ' + formatarReais(subtotal) + '</strong></div>' +
      '<div style="font-size:0.9em; margin-bottom:16px; color:#555;">' +
        adicionais.join('<br>') +
      '</div>' +
      '<div style="font-size:1.2em; font-weight:bold; color:#1a1a1a;">TOTAL FINAL: ' + formatarReais(totalFinal) + '</div>' +
    '</div>';

  document.getElementById('resultado').innerHTML = tabela;
}
