const precos = {
  "ROLÔ - TECIDO BLACKOUT 100%": 355.00,
  "ROLÔ - TECIDO TRANSLÚCIDO": 290.00,
  "ROLÔ - TECIDO TELA SOLAR 1%": 450.00,
  "ROLÔ - TECIDO TELA SOLAR 3%": 305.00,
  "ROLÔ - TECIDO TELA SOLAR 5%": 295.00,
  "ROMANA - TECIDO TRANSLÚCIDO": 445.00,
  "ROMANA - TECIDO TELA SOLAR 1%": 550.00,
  "ROMANA - TECIDO TELA SOLAR 3%": 390.00,
  "ROMANA - TECIDO TELA SOLAR 5%": 360.00,
  "ROMANA - BLACKOUT 100%": 435.00,
  "DOUBLE VISION BASIC": 520.00,
  "HORIZONTAL 25mm - ALUM LISA": 310.00,
  "HORIZONTAL 50mm - ALUM LISA": 455.00,
  "HORIZONTAL 50mm - ALUM LISA C/ FITA": 620.00,
  "HORIZONTAL 50mm - PVC TEXTURIZADO C/ FITA": 825.00,
  "HORIZONTAL 50mm - MADEIRA LISA": 1300.00,
  "HORIZONTAL 50mm - MADEIRA LISA C/ FITA": 1450.00,
  "HORIZONTAL 50mm - BAMBOO LISA": 1060.00,
  "HORIZONTAL 50mm - BAMBOO LISA C/ FITA": 1215.00,
  "VERTICAL 89mm - PVC LISA": 370.00
};

window.onload = () => {
  const select = document.getElementById('tipo');
  for (const tipo in precos) {
    const option = document.createElement('option');
    option.value = tipo;
    option.textContent = tipo;
    select.appendChild(option);
  }

  document.querySelectorAll('input, select').forEach(el =>
    el.addEventListener('input', calcular)
  );
};

function calcular() {
  const largura = parseFloat(document.getElementById('largura').value) || 0;
  const altura = parseFloat(document.getElementById('altura').value) || 0;
  const tipo = document.getElementById('tipo').value;
  const desconto = parseFloat(document.getElementById('desconto').value) || 0;

  let area = largura * altura;
  if (area < 1.5) area = 1.5;

  const valorM2 = precos[tipo] || 0;
  let total = area * valorM2 - desconto;

  if (total < 0) total = 0;

  document.getElementById('resultado').textContent =
    `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
}
