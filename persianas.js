import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔧 Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD5kVoWRWZB6xtacyu6lH--QFXry_MPKps",
  authDomain: "kaze-8836b.firebaseapp.com",
  projectId: "kaze-8836b",
  storageBucket: "kaze-8836b.firebasestorage.app",
  messagingSenderId: "336054068300",
  appId: "1:336054068300:web:6125e8eecc08d667fac0e9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("✅ Firebase inicializado");
console.log("db:", db);

const precos = {};
const select = document.getElementById('tipo');
const larguraInput = document.getElementById('largura');
const alturaInput = document.getElementById('altura');
const descontoInput = document.getElementById('desconto');
const resultado = document.getElementById('resultado');

async function carregarTipos() {
  console.log("🔍 Buscando dados no Firestore...");
  const querySnapshot = await getDocs(collection(db, "persianas"));
  const lista = [];

  querySnapshot.forEach((doc) => {
    const dados = doc.data();
    lista.push({ nome: dados.nome, preco: dados.preco });
  });

  lista.sort((a, b) => a.nome.localeCompare(b.nome));

  lista.forEach((item) => {
    precos[item.nome] = item.preco;

    if (select) {
      const option = document.createElement('option');
      option.value = item.nome;
      option.textContent = item.nome;
      select.appendChild(option);
    }
  });

  console.log("✅ Persianas carregadas:", precos);
}

function calcular() {
  const largura = parseFloat(larguraInput?.value) || 0;
  const altura = parseFloat(alturaInput?.value) || 0;
  const tipo = select?.value;
  const desconto = parseFloat(descontoInput?.value) || 0;

  const resultadoValor = calcularPersiana(largura, altura, tipo, desconto);
  resultado.textContent = `Total: R$ ${resultadoValor.total.replace('.', ',')}`;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    console.log("👤 Usuário autenticado:", user.email);
    await carregarTipos();
    [larguraInput, alturaInput, select, descontoInput].forEach(el =>
      el?.addEventListener('input', calcular)
    );
  } else {
    console.warn("⚠️ Usuário não autenticado. Acesso bloqueado.");
    if (resultado) resultado.textContent = "⚠️ Faça login para visualizar os valores.";
  }
});

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
