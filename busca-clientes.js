// Busca de clientes sem ler a coleção inteira (cada documento lido conta como uma leitura paga).
// Cada cliente guarda em "busca" o começo de cada palavra do nome (sem acento, minúsculo),
// o telefone e o CPF/CNPJ só com números; uma consulta "array-contains" lê só os que combinam.
// Clientes ainda sem o campo são achados pelo começo do nome, e o campo é gravado quando são vistos.
// Usado pelo sistema novo (app.js) e pelas páginas antigas.
import { db } from "./firebase-config.js";
import { collection, doc, getDoc, getDocs, query, where, limit, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const MAX_BUSCA = 30;
const MAX_PREFIXO = 15;
export const semAcento = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");
const porNome = (a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" });

export function chavesBusca(c) {
  const k = new Set();
  for (const p of semAcento(c.nome).split(/[^a-z0-9]+/)) for (let i = 2; i <= Math.min(p.length, MAX_PREFIXO); i++) k.add(p.slice(0, i));
  const tel = soDigitos(c.telefone);
  if (tel.length >= 8) {
    const semDDD = tel.length >= 10 ? tel.slice(2) : tel;
    for (let i = 4; i <= semDDD.length; i++) k.add(semDDD.slice(0, i));
    k.add(tel);
  }
  const documento = soDigitos(c.cpfOuCnpj);
  if (documento.length >= 11) k.add(documento);
  return [...k].sort();
}

// Grava o campo de busca de um cliente que não tem ou está desatualizado (uma vez por página aberta)
const conferidos = new Set();
export function conferirBusca(c) {
  if (!c?.id || conferidos.has(c.id)) return;
  conferidos.add(c.id);
  const chaves = chavesBusca(c);
  if (Array.isArray(c.busca) && c.busca.join("|") === chaves.join("|")) return;
  updateDoc(doc(db, "clientes", c.id), { busca: chaves }).catch((e) => console.warn("Busca do cliente não atualizada:", e));
}

export const chaveDe = (texto) => String(texto ?? "").trim().replace(/\s+/g, " ");
export const termoDe = (texto) => semAcento(texto).replace(/[^a-z0-9]+/g, " ").trim();
const ehBuscaNumero = (t) => /^[0-9 ]+$/.test(t);
export const podeBuscar = (t) => (ehBuscaNumero(t) ? t.replace(/ /g, "").length >= 4 : t.split(" ").some((p) => p.length >= 2));
const comMaiusculas = (t) => t.toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase());

// Todas as palavras digitadas precisam ser o começo de alguma palavra do nome
export function combina(c, t) {
  if (ehBuscaNumero(t)) {
    const n = t.replace(/ /g, "");
    return (c.busca || []).includes(n) || soDigitos(c.telefone).includes(n) || soDigitos(c.cpfOuCnpj).includes(n);
  }
  const palavras = semAcento(c.nome).split(/[^a-z0-9]+/);
  return t.split(" ").every((p) => palavras.some((w) => w.startsWith(p)));
}

// Clientes que combinam com o texto, em ordem alfabética. cheia: há mais do que os lidos.
export async function consultarClientes(texto) {
  const t = termoDe(texto), col = collection(db, "clientes"), consultas = [];
  if (!podeBuscar(t)) return { clientes: [], cheia: false };
  if (ehBuscaNumero(t)) consultas.push(query(col, where("busca", "array-contains", t.replace(/ /g, "")), limit(MAX_BUSCA)));
  else {
    const maior = t.split(" ").sort((a, b) => b.length - a.length)[0].slice(0, MAX_PREFIXO);
    consultas.push(query(col, where("busca", "array-contains", maior), limit(MAX_BUSCA)));
    // Clientes ainda sem o campo de busca: pelo começo do nome, como costuma estar escrito
    const bruto = chaveDe(texto);
    for (const v of new Set([bruto, comMaiusculas(bruto), bruto.toUpperCase()])) consultas.push(query(col, where("nome", ">=", v), where("nome", "<=", v + ""), limit(10)));
  }
  const resultados = await Promise.all(consultas.map((q) => getDocs(q)));
  const achados = new Map();
  for (const r of resultados) r.docs.forEach((d) => { const c = { id: d.id, ...d.data({ serverTimestamps: "estimate" }) }; achados.set(d.id, c); conferirBusca(c); });
  return { clientes: [...achados.values()].filter((c) => combina(c, t)).sort(porNome), cheia: resultados[0].size >= MAX_BUSCA };
}

// Últimos clientes escolhidos numa busca, guardados neste aparelho (sem ler o banco).
// Apagados ao sair do sistema novo.
const RECENTES = "kaze-clientes-recentes", MAX_RECENTES = 10;
export function clientesRecentes() {
  try { const l = JSON.parse(localStorage.getItem(RECENTES) || "[]"); return Array.isArray(l) ? l.filter((c) => c && typeof c.id === "string") : []; } catch { return []; }
}
function gravarRecentes(lista) { try { localStorage.setItem(RECENTES, JSON.stringify(lista.slice(0, MAX_RECENTES))); } catch { /* sem armazenamento */ } }
export function lembrarCliente(c) {
  if (!c?.id) return;
  const resumo = { id: c.id, nome: c.nome || "", telefone: c.telefone || "", bairro: c.bairro || "", cidade: c.cidade || "" };
  gravarRecentes([resumo, ...clientesRecentes().filter((x) => x.id !== c.id)]);
}
export function esquecerCliente(id) { gravarRecentes(clientesRecentes().filter((x) => x.id !== id)); }
export function apagarRecentes() { try { localStorage.removeItem(RECENTES); } catch { /* sem armazenamento */ } }

// Cadastro completo dos últimos pesquisados (páginas antigas): lê cada um uma vez por página aberta
const lidos = new Map();
export async function lerRecentes() {
  const lista = await Promise.all(clientesRecentes().map(async ({ id }) => {
    if (!lidos.has(id)) {
      const s = await getDoc(doc(db, "clientes", id));
      lidos.set(id, s.exists() ? { id, ...s.data() } : null);
    }
    if (!lidos.get(id)) esquecerCliente(id);
    return lidos.get(id);
  }));
  return lista.filter(Boolean);
}
export function guardarLido(c) { if (c?.id) lidos.set(c.id, c); }
