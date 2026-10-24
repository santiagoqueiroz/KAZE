import { app, auth, db } from "./firebase-config.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔧 Configuração do Firebase
 

const precos = {};

// 🔍 Carrega os tipos de persiana no <select>
export async function carregarTipos(selectElement) {
  const querySnapshot = await getDocs(collection(db, "persianas"));
  const lista = [];

  querySnapshot.forEach((doc) => {
    const dados = doc.data();
    lista.push({ nome: dados.nome, preco: dados.preco });
  });

  lista.sort((a, b) => a.nome.localeCompare(b.nome));

  lista.forEach((item) => {
    precos[item.nome] = item.preco;

    const option = document.createElement("option");
    option.value = item.nome;
    option.textContent = item.nome;
    selectElement.appendChild(option);
  });
}

// 🧮 Cálculo da persiana
export function calcularPersiana(largura, altura, tipo, desconto = 0) {
  let area = largura * altura;
  if (area < 1.5) area = 1.5;

  const valorM2 = precos[tipo] || 0;
  let total = area * valorM2 - desconto;
  if (total < 0) total = 0;

  return {
    area: area.toFixed(2),
    valorUnitario: valorM2.toFixed(2),
    total: total.toFixed(2)
  };
}

// 🔓 Função global opcional
window.abrirJanelaItem = function () {
  const modal = document.getElementById("janelaItem");
  if (modal) modal.style.display = "flex";
};
