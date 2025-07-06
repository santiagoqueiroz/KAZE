import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔧 Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD5kVoWRWZB6xtacyu6lH--QFXry_MPKps",
  authDomain: "kaze-8836b.firebaseapp.com",
  projectId: "kaze-8836b",
  storageBucket: "kaze-8836b.firebasestorage.app",
  messagingSenderId: "336054068300",
  appId: "1:336054068300:web:6125e8eecc08d667fac0e9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);

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
