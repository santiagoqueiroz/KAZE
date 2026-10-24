// Regras comerciais usadas em todos os cálculos de orçamento.
// Os valores ficam no Firestore (precos/regras) e são editados na página Preços.
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-config.js";

// Valores padrão, usados enquanto o Firestore não responde ou se o documento não existir
export const REGRAS_PADRAO = { markup: 2.4, custoCartao: 0.879 };

// markup: multiplicador sobre o custo.
// fatorVista ("custo cartão"): preço à vista = preço parcelado × fatorVista (ex.: 0,879).
export const regras = {
  markup: REGRAS_PADRAO.markup,
  fatorVista: REGRAS_PADRAO.custoCartao
};

// Lê precos/regras do Firestore; chame depois que o usuário estiver logado
export async function carregarRegras() {
  try {
    const snap = await getDoc(doc(db, "precos", "regras"));
    const dados = snap.exists() ? snap.data() : {};
    const markup = Number(dados.markup);
    const custoCartao = Number(dados.custoCartao);
    if (markup > 0) regras.markup = markup;
    if (custoCartao > 0 && custoCartao <= 1) regras.fatorVista = custoCartao;
  } catch (err) {
    console.warn("Não foi possível carregar as regras de preço; usando os valores padrão.", err);
  }
  return regras;
}

// Arredonda para centavos
export function centavos(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

// Totais do orçamento calculados a partir dos itens (nunca do texto da tela)
export function calcularTotais(itens) {
  const totalGeral = centavos((itens || []).reduce((soma, item) => soma + (parseFloat(item.total) || 0), 0));
  const totalVista = centavos(totalGeral * regras.fatorVista);
  return { totalGeral, totalVista };
}
