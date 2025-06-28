import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = window.db;
const select = document.getElementById('tipo');
const larguraInput = document.getElementById('largura');
const alturaInput = document.getElementById('altura');
const descontoInput = document.getElementById('desconto');
const resultado = document.getElementById('resultado');

const precos = {};

async function carregarTipos() {
  const querySnapshot = await getDocs(collection(db, "persianas"));
  querySnapshot.forEach((doc) => {
    const dados = doc.data();
    precos[dados.nome] = dados.preco;

    const option = document.createElement('option');
    option.value = dados.nome;
    option.textContent = dados.nome;
    select.appendChild(option);
  });
}

function calcular() {
  const largura = parseFloat(larguraInput.value) || 0;
  const altura = parseFloat(alturaInput.value) || 0;
  const tipo = select.value;
  const desconto = parseFloat(descontoInput.value) || 0;

  let area = largura * altura;
  if (area < 1.5) area = 1.5;

  const valorM2 = precos[tipo] || 0;
  let total = area * valorM2 - desconto;
  if (total < 0) total = 0;

  resultado.textContent = `Total: R$ ${total.toFixed(2).replace('.', ',')}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  await carregarTipos();
  [larguraInput, alturaInput, select, descontoInput].forEach(el =>
    el.addEventListener('input', calcular)
  );
});
