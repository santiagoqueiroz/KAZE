// Sistema Kazê (app.html): clientes, orçamentos, pedidos aprovados e dados de vendas.
// Convive com as páginas antigas: lê e grava os mesmos documentos do Firestore, no mesmo formato.
import { auth, db } from "./firebase-config.js";
import { mensagemErro } from "./erros.js";
import { esc } from "./seguranca.js";
import { regras, carregarRegras, centavos, calcularTotais } from "./regras-preco.js";
import { TIPOS, calcularItem } from "./calculos.js";
import { ehFinanceiro, nomePessoa, emailPessoa } from "./perfis.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, getCountFromServer,
  runTransaction, writeBatch, serverTimestamp, deleteField, terminate, clearIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Utilidades ----------
const $ = (id) => document.getElementById(id);
const fmtReal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtM2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const real = (v) => fmtReal.format(Number(v) || 0);
const m2 = (v) => fmtM2.format(Number(v) || 0);
const semAcento = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const porNome = (a, b) => (a.nome || "").localeCompare(b.nome || "", "pt-BR", { sensitivity: "base" });
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dataCurta = (d) => d.toLocaleDateString("pt-BR");
const hora = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const pad = (v) => String(v).padStart(2, "0");
const novoId = () => "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const ehNumero = (v) => v !== null && v !== "" && Number.isFinite(Number(v));
const lixeira = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
// Aceita "2,60", "2.60" e "1.234,56"
function lerNumero(texto) {
  let t = String(texto ?? "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!t) return NaN;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  return Number(t);
}
// Número para um campo de texto: 2.6 → "2,6"
const paraCampo = (v) => (ehNumero(v) ? String(Number(v)).replace(".", ",") : "");

// Mostra uma pergunta de confirmação dentro da página
function confirmar(el, texto, rotuloSim, aoConfirmar) {
  el.innerHTML = `<div class="confirma"><span>${texto}</span><button class="btn btn-perigo-cheio btn-p" type="button" data-sim>${esc(rotuloSim)}</button><button class="btn btn-secundario btn-p" type="button" data-nao>Cancelar</button></div>`;
  el.querySelector("[data-sim]").onclick = () => { el.innerHTML = ""; aoConfirmar(); };
  el.querySelector("[data-nao]").onclick = () => { el.innerHTML = ""; };
  el.querySelector("[data-nao]").focus();
}
function avisar(el, texto, tipo = "info") {
  el.innerHTML = `<div class="${tipo}"><span>${texto}</span></div>`;
}
const erroTexto = (e) => esc(mensagemErro(e));
const semPermissao = (e) => String(e?.code || "").includes("permission-denied");

// ---------- Estado ----------
let usuario = null, financeiro = false;
let clientes = new Map(), orcamentos = new Map(), pedidos = new Map();
const carregado = { clientes: false, orcamentos: false, pedidos: false };
let pedidosBloqueados = false; // as regras novas do banco ainda não foram publicadas
let tabelas = { tecidos: {}, tecidosBK: {}, trilhos: {}, parametros: {}, persianas: {} };
let pTabelas = null;

const cliente = (id) => clientes.get(id);
const dataOrc = (o) => { const d = new Date(o.dataHora); return isNaN(d) ? (o.criadoEm?.toDate?.() || new Date(0)) : d; };
const dataPed = (p) => p.aprovadoEm?.toDate?.() || null;
const recentes = (a, b) => dataOrc(b) - dataOrc(a);
const orcsDoCliente = (id) => [...orcamentos.values()].filter((o) => o.clienteId === id).sort(recentes);
const numOrc = (o) => (o.numero ? `Nº ${String(o.numero).padStart(4, "0")}` : `Ref. ${o.id.slice(0, 6).toUpperCase()}`);
// Os valores gravados no orçamento valem, mesmo que o markup mude depois
const totalDe = (o) => (ehNumero(o.totalGeral) ? Number(o.totalGeral) : calcularTotais(o.itens).totalGeral);
const vistaDe = (o) => (ehNumero(o.totalVista) ? Number(o.totalVista) : centavos(totalDe(o) * regras.fatorVista));
// Dados do cliente para mostrar: o cadastro atual ou, se o cliente foi excluído, a cópia guardada no orçamento
function clienteDoOrc(o) {
  const c = cliente(o.clienteId);
  if (c) return c;
  const s = o.cliente || {};
  return { id: null, nome: s.nome || "(cliente excluído)", telefone: s.telefone || "", endereco: s.endereco || "", bairro: s.bairro || "", cidade: s.cidade || "" };
}

// Representação do item independente da ordem dos campos (para comparar itens)
function chaveItem(valor) {
  if (Array.isArray(valor)) return "[" + valor.map(chaveItem).join(",") + "]";
  if (valor && typeof valor === "object") {
    if (typeof valor.toMillis === "function") return String(valor.toMillis());
    return "{" + Object.keys(valor).sort().map((k) => JSON.stringify(k) + ":" + chaveItem(valor[k])).join(",") + "}";
  }
  return JSON.stringify(valor);
}
const mesmoItem = (a, b) => (a.id ? a.id === b.id : chaveItem(a) === chaveItem(b));

// Rascunho = orçamento em aberto do cliente (clientes/{id}.orcamentoAtivo) com itens.
// O sistema antigo não limpa o orçamento em aberto ao salvar; se os itens são iguais aos de um
// orçamento já salvo do cliente, é sobra e não conta como rascunho.
function rascunhoDe(c) {
  const r = c?.orcamentoAtivo;
  if (!r || !Array.isArray(r.itens) || !r.itens.length) return null;
  if (!r.atualizadoEm) {
    if (!carregado.orcamentos) return null;
    const k = chaveItem(r.itens);
    if (orcsDoCliente(c.id).some((o) => chaveItem(o.itens || []) === k)) return null;
    // Sem todos os orçamentos do cliente lidos, só conta se o orçamento em aberto é recente
    // (o que veio antes do corte provavelmente é sobra de um orçamento antigo)
    if (!orcsCompletos.has(c.id) && !(r.dataCriacao?.toDate?.()?.toISOString() >= corteRecentes)) return null;
  }
  return r;
}
const dataRascunho = (r) => r.atualizadoEm?.toDate?.() || r.dataCriacao?.toDate?.() || null;
const agoraTs = () => { const d = new Date(); return { toDate: () => d, toMillis: () => d.getTime() }; };

// ---------- Navegação ----------
const AREA = { inicio: "inicio", clientes: "clientes", orcamentos: "orcamentos", "cliente-orc": "orcamentos", editor: "orcamentos", ver: "orcamentos", financeiro: "financeiro", dados: "financeiro" };
let atual = { tela: "inicio" };
// modo: "push" cria uma entrada no histórico (botão voltar), "replace" substitui a atual.
// A barra de endereço mostra sempre só o endereço do sistema; a tela fica guardada no histórico.
function ir(tela, extra = {}, modo = "push") {
  if (!financeiro && AREA[tela] === "financeiro") tela = "inicio";
  atual = { tela, ...extra };
  if (modo === "push") history.pushState(atual, "", location.pathname);
  else history.replaceState(atual, "", location.pathname);
  mostrar(true);
  window.scrollTo(0, 0);
}
function mostrar(navegou) {
  document.querySelectorAll(".tela").forEach((t) => { t.hidden = t.dataset.tela !== atual.tela; });
  document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("ativo", b.dataset.area === AREA[atual.tela]));
  const desenhar = { inicio: rInicio, clientes: rClientes, orcamentos: rOrcamentos, "cliente-orc": rClienteOrc, editor: rEditor, ver: rVer, dados: rDados }[atual.tela];
  if (desenhar) desenhar(navegou);
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-ir]");
  if (a) { e.preventDefault(); ir(a.dataset.ir); }
});
addEventListener("popstate", (e) => {
  if (!usuario) return;
  fecharJanelas();
  atual = e.state?.tela ? e.state : { tela: "inicio" };
  if (!financeiro && AREA[atual.tela] === "financeiro") atual = { tela: "inicio" };
  mostrar(true);
});
// Redesenha a tela atual quando os dados mudam (no máximo uma vez por quadro)
let agendado = false;
function redesenhar() {
  if (agendado) return;
  agendado = true;
  requestAnimationFrame(() => { agendado = false; if (usuario) mostrar(false); });
}

// ---------- Entrar e sair ----------
function traduzErroLogin(codigo) {
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(codigo)) return "E-mail ou senha incorretos.";
  if (codigo === "auth/invalid-email") return "E-mail inválido.";
  if (codigo === "auth/too-many-requests") return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  if (codigo === "auth/network-request-failed") return "Sem conexão. Verifique a internet e tente de novo.";
  return "Não foi possível entrar. Tente de novo.";
}
$("form-entrar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("e-entrar"), msg = $("e-msg");
  msg.textContent = ""; msg.className = "erro";
  btn.disabled = true; btn.textContent = "Entrando…";
  try {
    await signInWithEmailAndPassword(auth, $("e-email").value.trim(), $("e-senha").value);
  } catch (erro) {
    msg.textContent = traduzErroLogin(erro.code);
  } finally {
    btn.disabled = false; btn.textContent = "Entrar";
  }
});
$("e-esqueci").onclick = async () => {
  const email = $("e-email").value.trim(), msg = $("e-msg");
  if (!email) { msg.className = "erro"; msg.textContent = "Digite seu e-mail acima e toque de novo em Esqueci minha senha."; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    msg.className = "ok"; msg.textContent = "Se o e-mail estiver cadastrado, chega nele um link para criar uma senha nova.";
  } catch (erro) {
    msg.className = "erro"; msg.textContent = erro.code === "auth/invalid-email" ? "E-mail inválido." : "Não foi possível enviar agora. Tente de novo.";
  }
};
$("btn-sair").onclick = async () => {
  await signOut(auth);
  // Apaga a cópia dos dados guardada neste aparelho (computador compartilhado)
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch (erro) { console.warn("Cópia local não apagada:", erro); }
  location.replace(location.pathname);
};

onAuthStateChanged(auth, (u) => {
  $("carregando").hidden = true;
  if (!u) {
    usuario = null;
    $("app").hidden = true;
    $("entrar").hidden = false;
    $("e-email").focus();
    return;
  }
  if (usuario) return;
  usuario = u;
  financeiro = ehFinanceiro(u);
  document.body.classList.toggle("sem-financeiro", !financeiro);
  const nome = nomePessoa(u.uid, u.email);
  $("usuario-nome").textContent = nome;
  $("ola").textContent = `Olá, ${nome}`;
  $("entrar").hidden = true;
  $("app").hidden = false;
  ouvirDados();
  carregarRegras().then(redesenhar);
  pTabelas = carregarTabelas();
  ir("inicio", {}, "replace");
});

// ---------- Dados do Firestore ----------
const comId = (d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) });
let avisouAcesso = false;
function erroLeitura(erro) {
  console.error(erro);
  if (avisouAcesso) return;
  avisouAcesso = true;
  alert(semPermissao(erro) ? "Sua conta não tem acesso aos dados do sistema. Peça ao responsável para liberar." : mensagemErro(erro));
}
// Cada documento entregue pelo banco conta como uma leitura paga. Por isso o app não lê todos os orçamentos:
// fica ao vivo só com os dos últimos JANELA_DIAS dias, lê os de um cliente quando ele é aberto
// e os mais antigos de um período só quando o período é pedido em Dados.
const JANELA_DIAS = 35;
const corteRecentes = new Date(Date.now() - JANELA_DIAS * 864e5).toISOString();
let lidosDesde = corteRecentes; // todos os orçamentos com dataHora a partir daqui já foram lidos ("" = todos)
let totalOrcs = null;           // contagem feita no servidor (custa 1 leitura a cada mil orçamentos)
const orcsCompletos = new Set(); // clientes com todos os orçamentos lidos
// Fontes dos orçamentos: listas lidas uma vez (períodos de Dados) e listas ao vivo (recentes, por cliente).
// A lista usada pelo app junta as duas; a ao vivo vale por cima.
const fontesFixas = new Map(), fontesVivas = new Map();
function juntarOrcs() {
  orcamentos = new Map();
  for (const fontes of [fontesFixas, fontesVivas]) for (const m of fontes.values()) for (const [id, o] of m) orcamentos.set(id, o);
  redesenhar();
}
function guardarOrcs(fontes, nome, docs) {
  fontes.set(nome, new Map(docs.map((d) => [d.id, comId(d)])));
  juntarOrcs();
}
// Tira da memória um orçamento excluído por este aparelho (as listas lidas uma vez não ficam sabendo sozinhas)
function esquecerOrcs(ids) {
  for (const fontes of [fontesFixas, fontesVivas]) for (const m of fontes.values()) ids.forEach((id) => m.delete(id));
  juntarOrcs();
  contarOrcs();
}
function contarOrcs() {
  getCountFromServer(collection(db, "orcamentos")).then((s) => { totalOrcs = s.data().count; redesenhar(); }).catch((e) => console.warn("Contagem de orçamentos indisponível:", e));
}
// Orçamentos de um cliente, ao vivo enquanto o app está aberto (guarda os últimos 30 clientes abertos)
const ouvindoCliente = new Map();
function carregarOrcsDoCliente(id) {
  if (!id) return;
  if (ouvindoCliente.has(id)) { const parar = ouvindoCliente.get(id); ouvindoCliente.delete(id); ouvindoCliente.set(id, parar); return; }
  const nome = "cliente:" + id;
  ouvindoCliente.set(id, onSnapshot(query(collection(db, "orcamentos"), where("clienteId", "==", id)), (s) => {
    orcsCompletos.add(id);
    guardarOrcs(fontesVivas, nome, s.docs);
    if (!$("janela-cliente").hidden && editando === id) rotuloOrcsCliente(id);
  }, erroLeitura));
  if (ouvindoCliente.size > 30) {
    const [velho, parar] = ouvindoCliente.entries().next().value;
    parar(); ouvindoCliente.delete(velho); orcsCompletos.delete(velho); fontesVivas.delete("cliente:" + velho);
  }
}
// Um orçamento fora do que está em memória (ex.: pedido antigo aberto em Dados)
async function buscarOrc(id) {
  const s = await getDoc(doc(db, "orcamentos", id)).catch(() => null);
  if (!s?.exists()) return false;
  guardarOrcs(fontesFixas, "avulso:" + id, [s]);
  return true;
}
// Garante em memória todos os orçamentos feitos a partir de "inicio" (Date; null = desde sempre)
let lendoPeriodo = null;
function carregarDesde(inicio) {
  const desde = inicio ? inicio.toISOString() : "";
  if (lidosDesde === "" || (desde && desde >= lidosDesde)) return Promise.resolve();
  if (lendoPeriodo) return lendoPeriodo.then(() => carregarDesde(inicio));
  const ate = lidosDesde;
  // "Desde sempre" lê a coleção inteira, inclusive orçamentos muito antigos sem dataHora
  const q = desde ? query(collection(db, "orcamentos"), where("dataHora", ">=", desde), where("dataHora", "<", ate)) : collection(db, "orcamentos");
  lendoPeriodo = getDocs(q).then((s) => {
    lidosDesde = desde;
    guardarOrcs(fontesFixas, "desde:" + desde, s.docs);
  }).finally(() => { lendoPeriodo = null; });
  return lendoPeriodo;
}

function ouvirDados() {
  onSnapshot(collection(db, "clientes"), (s) => {
    clientes = new Map(s.docs.map((d) => [d.id, comId(d)]));
    carregado.clientes = true;
    redesenhar();
  }, erroLeitura);
  onSnapshot(query(collection(db, "orcamentos"), where("dataHora", ">=", corteRecentes)), (s) => {
    carregado.orcamentos = true;
    guardarOrcs(fontesVivas, "recentes", s.docs);
  }, erroLeitura);
  contarOrcs();
  onSnapshot(collection(db, "pedidos"), (s) => {
    pedidos = new Map(s.docs.map((d) => [d.id, comId(d)]));
    carregado.pedidos = true; pedidosBloqueados = false;
    redesenhar();
  }, (erro) => {
    // Sem as regras novas publicadas, a coleção pedidos fica fechada: o resto do sistema continua funcionando
    console.warn("Pedidos indisponíveis:", erro);
    carregado.pedidos = true; pedidosBloqueados = true;
    redesenhar();
  });
}

// Tabelas de preço: precos/{tecidos, tecidos_bk, trilhos, parametros} e a coleção persianas
async function carregarTabelas() {
  const soNumeros = (dados) => Object.fromEntries(Object.entries(dados || {}).filter(([, v]) => ehNumero(v)).map(([k, v]) => [k, Number(v)]));
  const ler = async (id) => { const s = await getDoc(doc(db, "precos", id)); return s.exists() ? soNumeros(s.data()) : {}; };
  try {
    const [tecidos, tecidosBK, trilhos, parametros, lista] = await Promise.all([ler("tecidos"), ler("tecidos_bk"), ler("trilhos"), ler("parametros"), getDocs(collection(db, "persianas"))]);
    const persianas = {};
    lista.forEach((d) => { const x = d.data(); if (x.nome && ehNumero(x.preco)) persianas[x.nome] = Number(x.preco); });
    tabelas = { tecidos, tecidosBK, trilhos, parametros, persianas };
  } catch (erro) {
    console.error("Não foi possível carregar as tabelas de preço.", erro);
  }
  if (!$("janela-item").hidden) { preencherOpcoes(); atualizarItem(); }
}

// ---------- Início ----------
function linhaRascunho(c) {
  const r = rascunhoDe(c), d = dataRascunho(r);
  return `<button class="linha" type="button" data-rascunho="${esc(c.id)}"><div><div class="nome">${esc(c.nome)} <span class="chip areia">Rascunho</span></div><div class="det">${plural(r.itens.length, "item", "itens")}${d ? ` · guardado ${dataCurta(d)} às ${hora(d)}` : ""}</div></div><div class="valor">${real(calcularTotais(r.itens).totalGeral)}</div></button>`;
}
// As listas mostram só os mais recentes; os demais ficam na página de cada cliente
const MAX_LISTA = 10;
function comRascunho() {
  return [...clientes.values()].filter(rascunhoDe).sort((a, b) => (dataRascunho(rascunhoDe(b))?.getTime() || 0) - (dataRascunho(rascunhoDe(a))?.getTime() || 0)).slice(0, MAX_LISTA);
}
function ligarRascunhos(el) { el.querySelectorAll("[data-rascunho]").forEach((b) => { b.onclick = () => ir("editor", { cliente: b.dataset.rascunho }); }); }
function rInicio() {
  $("hoje").textContent = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  $("resumo-clientes").textContent = carregado.clientes ? plural(clientes.size, "cliente", "clientes") : "Carregando…";
  $("resumo-orcamentos").textContent = totalOrcs !== null ? plural(totalOrcs, "orçamento salvo", "orçamentos salvos") : "";
  const lista = comRascunho();
  $("bloco-rascunhos-inicio").hidden = !lista.length;
  $("lista-rascunhos-inicio").innerHTML = lista.map(linhaRascunho).join("");
  ligarRascunhos($("lista-rascunhos-inicio"));
}

// ---------- Clientes ----------
function listaClientes(el, termo, aoClicar, comOrcamentos) {
  if (!carregado.clientes) { el.innerHTML = '<div class="vazio">Carregando clientes…</div>'; return; }
  const t = semAcento(termo.trim()), nums = termo.replace(/\D/g, "");
  const lista = [...clientes.values()].filter((c) => !t || semAcento(`${c.nome} ${c.bairro} ${c.cidade}`).includes(t) || (nums.length >= 3 && `${c.telefone}${c.cpfOuCnpj}`.replace(/\D/g, "").includes(nums))).sort(porNome);
  if (!lista.length) { el.innerHTML = termo.trim() ? `<div class="vazio">Nenhum cliente encontrado para "${esc(termo)}".</div>` : '<div class="vazio">Nenhum cliente cadastrado ainda.</div>'; return; }
  let letra = "", html = "";
  for (const c of lista) {
    const inicial = semAcento((c.nome || "#")[0]).toUpperCase(), l = /[A-Z]/.test(inicial) ? inicial : "#";
    if (l !== letra && !t) { letra = l; html += `<div class="letra">${esc(l)}</div>`; }
    const det = [c.telefone, [c.bairro, c.cidade].filter(Boolean).join(", ")].filter(Boolean).map(esc).join(" · ");
    let lado = "";
    if (comOrcamentos && rascunhoDe(c)) lado = '<span class="chip areia">Rascunho</span>';
    html += `<button class="linha" type="button" data-cliente="${esc(c.id)}"><div><div class="nome">${esc(c.nome || "(sem nome)")}</div><div class="det">${det}</div></div><div>${lado}</div></button>`;
  }
  el.innerHTML = html;
  el.querySelectorAll("[data-cliente]").forEach((b) => { b.onclick = () => aoClicar(b.dataset.cliente); });
}
function rClientes() {
  $("contagem-clientes").textContent = carregado.clientes ? `${plural(clientes.size, "cliente", "clientes")} em ordem alfabética. Toque num cliente para editar.` : "";
  listaClientes($("lista-clientes"), $("busca-clientes").value, (id) => abrirJanelaCliente(id), false);
}
$("busca-clientes").addEventListener("input", rClientes);

// ---------- Orçamentos ----------
const chipAprovado = (o) => (pedidos.has(o.id) ? ' <span class="chip ok">Aprovado</span>' : "");
function rOrcamentos() {
  const rasc = comRascunho();
  const rec = [...orcamentos.values()].sort(recentes).slice(0, MAX_LISTA);
  let html = rasc.map(linhaRascunho).join("") + rec.map((o) => `<button class="linha" type="button" data-orc="${esc(o.id)}"><div><div class="nome">${esc(clienteDoOrc(o).nome)}${chipAprovado(o)}</div><div class="det">${numOrc(o)} · ${dataCurta(dataOrc(o))} · ${plural((o.itens || []).length, "item", "itens")}</div></div><div class="valor">${real(totalDe(o))}</div></button>`).join("");
  if (!html) html = `<div class="vazio">${carregado.orcamentos ? "Nenhum orçamento ainda." : "Carregando…"}</div>`;
  $("lista-recentes").innerHTML = html;
  $("lista-recentes").querySelectorAll("[data-orc]").forEach((b) => { b.onclick = () => ir("ver", { orc: b.dataset.orc }); });
  ligarRascunhos($("lista-recentes"));
  listaClientes($("lista-clientes-orc"), $("busca-orc").value, (id) => ir("cliente-orc", { cliente: id }), true);
}
$("busca-orc").addEventListener("input", rOrcamentos);

function rClienteOrc(navegou) {
  const c = cliente(atual.cliente);
  if (!c) { if (carregado.clientes) ir("orcamentos", {}, "replace"); return; }
  carregarOrcsDoCliente(c.id);
  $("co-migalha").textContent = c.nome;
  $("co-nome").textContent = c.nome;
  $("co-contato").textContent = [c.telefone, [c.endereco, c.bairro].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  if (navegou) $("co-aviso").innerHTML = "";
  const lista = orcsDoCliente(c.id), r = rascunhoDe(c);
  let html = "";
  if (r) {
    const base = r.baseadoEm && orcamentos.get(r.baseadoEm), d = dataRascunho(r);
    html += `<div class="versao rascunho"><div class="data"><b>✎</b><span>aberto</span></div>
      <div><div class="titulo">Rascunho <span class="chip areia">Não salvo</span></div><div class="suave pequeno">${plural(r.itens.length, "item", "itens")}${d ? ` · guardado ${dataCurta(d)} às ${hora(d)}` : ""}${base ? " · cópia do " + numOrc(base) : ""}</div><div class="valor" style="text-align:left">${real(calcularTotais(r.itens).totalGeral)}</div></div>
      <div class="acoes"><button class="btn btn-primario btn-p" type="button" data-continuar>Continuar</button></div></div>`;
  }
  html += lista.map((o, i) => {
    const d = dataOrc(o), base = o.baseadoEm && orcamentos.get(o.baseadoEm), aprovado = pedidos.has(o.id);
    const podeExcluir = !aprovado || financeiro;
    return `<div class="versao${o.id === atual.destaque ? " destaque" : ""}">
      <div class="data"><b>${pad(d.getDate())}</b><span>${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}</span></div>
      <div><div class="titulo">${numOrc(o)}${aprovado ? '<span class="chip ok">Pedido aprovado</span>' : i === 0 ? '<span class="chip azul">Mais recente</span>' : ""}</div>
        <div class="suave pequeno">${hora(d)} · ${plural((o.itens || []).length, "item", "itens")}${base ? " · a partir do " + numOrc(base) : ""}</div>
        <div class="valor" style="text-align:left">${real(totalDe(o))} <span class="suave" style="font-weight:400">· à vista ${real(vistaDe(o))}</span></div></div>
      <div class="acoes"><button class="btn btn-secundario btn-p" type="button" data-ver="${esc(o.id)}">Ver</button><button class="btn btn-secundario btn-p" type="button" data-editar="${esc(o.id)}">Editar como novo</button>${podeExcluir ? `<button class="btn-icone" type="button" data-excluir="${esc(o.id)}" aria-label="Excluir ${numOrc(o)}">${lixeira}</button>` : ""}</div>
      <div class="caixa"></div>
    </div>`;
  }).join("");
  if (!html) html = orcsCompletos.has(c.id) ? `<div class="cartao vazio">Este cliente ainda não tem orçamentos. Use "+ Novo orçamento".</div>` : '<div class="cartao vazio">Carregando orçamentos…</div>';
  $("co-lista").innerHTML = html;
  $("co-lista").querySelector("[data-continuar]")?.addEventListener("click", () => ir("editor", { cliente: c.id }));
  $("co-lista").querySelectorAll("[data-ver]").forEach((b) => { b.onclick = () => ir("ver", { orc: b.dataset.ver }); });
  $("co-lista").querySelectorAll("[data-editar]").forEach((b) => { b.onclick = () => comecarRascunho(c.id, b.dataset.editar); });
  $("co-lista").querySelectorAll("[data-excluir]").forEach((b) => {
    b.onclick = () => {
      const o = orcamentos.get(b.dataset.excluir), caixa = b.closest(".versao").querySelector(".caixa");
      const extra = pedidos.has(o.id) ? " O pedido aprovado continua guardado nos Dados." : "";
      confirmar(caixa, `Excluir o ${numOrc(o)} de ${dataCurta(dataOrc(o))}?${extra} Não dá para desfazer.`, "Excluir", () => excluirOrcamento(o, caixa));
    };
  });
}
$("btn-novo-orc").onclick = () => comecarRascunho(atual.cliente, null);

async function excluirOrcamento(o, caixa) {
  try {
    await deleteDoc(doc(db, "orcamentos", o.id));
    esquecerOrcs([o.id]);
    if (atual.tela === "ver") ir("cliente-orc", { cliente: o.clienteId }, "replace");
  } catch (erro) {
    avisar(caixa, `Não foi possível excluir. ${erroTexto(erro)}`, "confirma");
  }
}

// Começa um rascunho vazio ou cópia de um orçamento salvo. Se já há rascunho, pergunta antes.
function comecarRascunho(clienteId, baseId, alvo, antes = () => {}) {
  const c = cliente(clienteId);
  if (!c) return;
  const criar = () => {
    const base = baseId ? orcamentos.get(baseId) : null;
    const itens = base ? (base.itens || []).map((i) => ({ ...i, id: i.id || novoId() })) : [];
    const novo = { status: "aberto", itens, baseadoEm: baseId || null, dataCriacao: serverTimestamp(), atualizadoEm: serverTimestamp(), atualizadoPor: usuario.uid };
    updateDoc(doc(db, "clientes", clienteId), { orcamentoAtivo: novo }).catch((erro) => alert("O rascunho não foi criado. " + mensagemErro(erro)));
    // Mostra já, sem esperar o servidor
    c.orcamentoAtivo = { ...novo, dataCriacao: agoraTs(), atualizadoEm: agoraTs() };
    antes();
    ir("editor", { cliente: clienteId });
  };
  const r = rascunhoDe(c);
  if (!r) return criar();
  alvo = alvo || (atual.tela === "ver" ? $("ver-confirma") : $("co-aviso"));
  alvo.innerHTML = `<div class="info"><span>${esc(c.nome)} já tem um rascunho em aberto (${plural(r.itens.length, "item", "itens")}).</span><button class="btn btn-primario btn-p" type="button" data-cont>Continuar rascunho</button><button class="btn btn-perigo btn-p" type="button" data-subst>Descartar e começar ${baseId ? "a cópia" : "outro"}</button></div>`;
  alvo.querySelector("[data-cont]").onclick = () => { antes(); ir("editor", { cliente: clienteId }); };
  alvo.querySelector("[data-subst]").onclick = criar;
  if (alvo.closest(".janela")) alvo.scrollIntoView({ block: "nearest" }); else window.scrollTo(0, 0);
}

// Novo orçamento a partir da tela Orçamentos: primeiro escolhe o cliente
const fecharEscolher = () => { $("janela-escolher").hidden = true; };
function rEscolher() {
  $("je-aviso").innerHTML = "";
  listaClientes($("je-lista"), $("je-busca").value, (id) => comecarRascunho(id, null, $("je-aviso"), fecharEscolher), true);
}
$("btn-novo-orc-grande").onclick = () => {
  $("je-busca").value = "";
  rEscolher();
  $("janela-escolher").hidden = false;
  $("je-lista").scrollTop = 0;
  if (matchMedia("(min-width: 721px)").matches) $("je-busca").focus();
};
$("je-busca").addEventListener("input", rEscolher);
$("je-fechar").onclick = fecharEscolher;
$("janela-escolher").addEventListener("click", (e) => { if (e.target === $("janela-escolher")) fecharEscolher(); });
$("je-novo-cliente").onclick = () => { fecharEscolher(); abrirJanelaCliente(null, (id) => comecarRascunho(id, null)); };

// ---------- Rascunho (editor) ----------
function detalheItem(i) {
  const p = [], l = Number(i.largura), a = Number(i.altura), q = Number(i.qtd) || 1, d = Number(i.desconto) || 0;
  if (l > 0 && a > 0) p.push(`${m2(l)} × ${m2(a)} m`);
  if (q > 1) p.push(`${q} un.`);
  if (d > 0) p.push(`desconto ${real(d)}`);
  return p.join(" · ");
}
function rEditor(navegou) {
  const c = cliente(atual.cliente), r = c?.orcamentoAtivo;
  if (!c || !r) { if (carregado.clientes) ir(c ? "cliente-orc" : "orcamentos", c ? { cliente: c.id } : {}, "replace"); return; }
  carregarOrcsDoCliente(c.id); // para achar o orçamento em que a cópia se baseou
  const itens = r.itens || [], base = r.baseadoEm && orcamentos.get(r.baseadoEm), d = dataRascunho(r);
  $("ed-voltar-cliente").textContent = c.nome;
  $("ed-voltar-cliente").onclick = () => ir("cliente-orc", { cliente: c.id });
  $("ed-titulo").textContent = base ? `Cópia do ${numOrc(base)}` : "Novo orçamento";
  $("ed-sub").textContent = base ? `${c.nome}. O ${numOrc(base)} continua guardado como está.` : [c.nome, c.telefone].filter(Boolean).join(" · ");
  if (navegou) $("ed-confirma").innerHTML = "";
  $("ed-qtd-itens").textContent = plural(itens.length, "item", "itens");
  $("ed-itens").innerHTML = itens.length ? itens.map((i, n) => {
    const det = detalheItem(i);
    return `<div class="item"><div><b>${esc(i.produto)}</b>${det ? `<small>${det}</small>` : ""}</div><span class="valor">${real(i.total)}</span><div class="acoes-item"><button class="btn btn-secundario btn-p" type="button" data-editar="${n}">Editar</button><button class="btn-icone" type="button" data-remover="${n}" aria-label="Remover ${esc(i.produto)}">${lixeira}</button></div></div>`;
  }).join("") : '<div class="vazio">Nenhum item ainda. Toque num produto acima.</div>';
  $("ed-itens").querySelectorAll("[data-editar]").forEach((b) => { b.onclick = () => abrirItem({ item: itens[+b.dataset.editar] }); });
  $("ed-itens").querySelectorAll("[data-remover]").forEach((b) => { b.onclick = () => removerItem(c.id, itens[+b.dataset.remover]); });
  const { totalGeral, totalVista } = calcularTotais(itens);
  $("ed-total").textContent = real(totalGeral);
  $("ed-vista").textContent = real(totalVista);
  $("ed-salvo").textContent = d ? `Rascunho guardado às ${hora(d)}` : "Rascunho guardado";
  $("btn-salvar-orc").disabled = !itens.length;
}
document.querySelectorAll("[data-produto]").forEach((b) => { b.onclick = () => abrirItem({ tipo: b.dataset.produto }); });

// Altera os itens do rascunho lendo a versão mais recente do banco, para duas pessoas não apagarem itens uma da outra
function alterarItens(clienteId, alterar) {
  const ref = doc(db, "clientes", clienteId);
  return runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw Object.assign(new Error("Cliente não encontrado"), { code: "not-found" });
    const ativo = snap.data().orcamentoAtivo || { status: "aberto", baseadoEm: null, dataCriacao: serverTimestamp() };
    const itens = [...(ativo.itens || [])];
    if (alterar(itens) === false) return false;
    t.update(ref, { orcamentoAtivo: { ...ativo, itens, atualizadoEm: serverTimestamp(), atualizadoPor: usuario.uid } });
    return true;
  });
}
async function removerItem(clienteId, alvo) {
  try {
    const ok = await alterarItens(clienteId, (itens) => {
      const i = itens.findIndex((x) => mesmoItem(alvo, x));
      if (i === -1) return false;
      itens.splice(i, 1);
    });
    if (ok === false) avisar($("ed-confirma"), "Esse item já tinha sido removido ou alterado em outra tela. A lista foi atualizada.");
  } catch (erro) {
    avisar($("ed-confirma"), `Não foi possível remover o item. ${erroTexto(erro)}`, "confirma");
  }
}

$("btn-salvar-orc").onclick = async () => {
  const id = atual.cliente, btn = $("btn-salvar-orc");
  btn.disabled = true; btn.textContent = "Salvando…";
  try {
    const novo = await salvarOrcamento(id);
    contarOrcs();
    ir("cliente-orc", { cliente: id, destaque: novo }, "replace");
  } catch (erro) {
    avisar($("ed-confirma"), erro.vazio ? "O rascunho está sem itens." : `O orçamento não foi salvo. ${erroTexto(erro)}`, "confirma");
  } finally {
    btn.textContent = "Salvar orçamento";
    btn.disabled = !(cliente(id)?.orcamentoAtivo?.itens || []).length;
  }
};
// Grava o orçamento no formato das páginas antigas, com número sequencial, e fecha o rascunho
async function salvarOrcamento(clienteId) {
  const ref = doc(db, "clientes", clienteId), orcRef = doc(collection(db, "orcamentos")), contRef = doc(db, "contadores", "orcamentos");
  const montar = (c, numero) => {
    const ativo = c.orcamentoAtivo || {}, itens = ativo.itens || [];
    if (!itens.length) throw Object.assign(new Error("Rascunho vazio"), { vazio: true });
    const { totalGeral, totalVista } = calcularTotais(itens);
    const dados = {
      clienteId,
      cliente: { nome: c.nome || "", telefone: c.telefone || "", cpf: c.cpfOuCnpj || "", endereco: c.endereco || "", bairro: c.bairro || "", cidade: c.cidade || "", email: c.email || "" },
      itens, totalGeral, totalVista,
      dataHora: new Date().toISOString(),
      usuarioId: usuario.uid,
      usuarioEmail: usuario.email || "",
      criadoEm: serverTimestamp(),
      regras: { markup: regras.markup, fatorVista: regras.fatorVista }
    };
    if (ativo.baseadoEm) dados.baseadoEm = ativo.baseadoEm;
    if (numero) dados.numero = numero;
    return dados;
  };
  const gravar = (comNumero) => runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) throw Object.assign(new Error("Cliente não encontrado"), { code: "not-found" });
    let numero = null;
    if (comNumero) {
      const cont = await t.get(contRef);
      numero = (cont.exists() ? Number(cont.data().ultimo) || 0 : 0) + 1;
    }
    const dados = montar(snap.data(), numero);
    if (comNumero) t.set(contRef, { ultimo: numero });
    t.set(orcRef, dados);
    t.update(ref, { orcamentoAtivo: deleteField() });
  });
  try {
    await gravar(true);
  } catch (erro) {
    // Sem as regras novas publicadas, a numeração fica bloqueada: salva sem número
    if (!semPermissao(erro)) throw erro;
    await gravar(false);
  }
  return orcRef.id;
}
$("btn-descartar").onclick = () => confirmar($("ed-confirma"), "Descartar este rascunho? Os itens ainda não salvos serão perdidos.", "Descartar", async () => {
  const id = atual.cliente;
  try {
    await updateDoc(doc(db, "clientes", id), { orcamentoAtivo: deleteField() });
    ir("cliente-orc", { cliente: id }, "replace");
  } catch (erro) {
    avisar($("ed-confirma"), `Não foi possível descartar. ${erroTexto(erro)}`, "confirma");
  }
});

// ---------- Janela de item ----------
const AMBIENTES = ["Sala", "Quarto", "Suíte", "Cozinha", "Escritório", "Varanda"];
const CAMPOS = ["f-ambiente", "f-descricao", "f-largura", "f-altura", "f-qtd", "f-tecido", "f-bk", "f-forro", "f-trilho", "f-persiana", "f-valor", "f-desconto", "f-barra", "f-mult"];
// Campos de material que cada produto usa (os outros não são gravados)
const MATERIAIS = {
  cortina: ["tecido", "trilho", "barra", "mult"],
  blackout: ["bk", "trilho"],
  cortinaBK: ["tecido", "bk", "trilho", "barra", "mult"],
  cortinaForro: ["tecido", "forro", "trilho", "barra", "mult"],
  persiana: ["persiana"],
  avulso: ["descricao", "valor"]
};
const COSTURA = ["cortina", "cortinaBK", "cortinaForro"];
let estadoItem = { tipo: "cortina", editando: null, salvando: false };

function marcar(id, invalido) { if (invalido) $(id).setAttribute("aria-invalid", "true"); else $(id).removeAttribute("aria-invalid"); }
function opcoes(id, mapa, sufixo) {
  const el = $(id), atualV = el.value;
  const nomes = Object.keys(mapa).sort((x, y) => x.localeCompare(y, "pt-BR"));
  // Um material que saiu da tabela continua aparecendo no item que já o usava
  if (atualV && !nomes.includes(atualV)) nomes.unshift(atualV);
  el.innerHTML = nomes.map((n) => `<option value="${esc(n)}">${esc(n)}${financeiro && n in mapa ? ` · ${real(mapa[n])}${sufixo}` : n in mapa ? "" : " (sem preço)"}</option>`).join("");
  if (atualV) el.value = atualV;
}
function preencherOpcoes() {
  opcoes("f-tecido", tabelas.tecidos, "/m"); opcoes("f-forro", tabelas.tecidos, "/m"); opcoes("f-bk", tabelas.tecidosBK, "/m");
  opcoes("f-trilho", tabelas.trilhos, "/m"); opcoes("f-persiana", tabelas.persianas, "/m²");
}
$("atalhos").innerHTML = AMBIENTES.map((a) => `<button type="button" data-amb="${a}">${a}</button>`).join("");
$("atalhos").onclick = (e) => { const b = e.target.closest("[data-amb]"); if (b) { $("f-ambiente").value = b.dataset.amb; atualizarItem(); } };

function mostrarTipo() {
  const t = estadoItem.tipo;
  document.querySelectorAll("#tipos button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tipo === t)));
  document.querySelectorAll("#form-item [data-tipos]").forEach((el) => { el.hidden = !el.dataset.tipos.split(" ").includes(t); });
  document.querySelectorAll("#form-item [data-so]").forEach((el) => { el.hidden = el.dataset.so !== t; });
}
$("tipos").onclick = (e) => { const b = e.target.closest("[data-tipo]"); if (b) { estadoItem.tipo = b.dataset.tipo; mostrarTipo(); atualizarItem(); } };

// Lê a janela: devolve { falta } (o que falta preencher), { erro } (falta preço) ou { e, r } (entrada e cálculo)
function lerItem() {
  const tipo = estadoItem.tipo, falta = [];
  const l = lerNumero($("f-largura").value), a = lerNumero($("f-altura").value);
  const qtd = $("f-qtd").value.trim() === "" ? 1 : lerNumero($("f-qtd").value);
  const desconto = $("f-desconto").value.trim() === "" ? 0 : lerNumero($("f-desconto").value);
  const barra = lerNumero($("f-barra").value), mult = lerNumero($("f-mult").value);
  const medidaOk = (x) => x > 0 && x <= 15;
  ["f-largura", "f-altura", "f-qtd", "f-desconto", "f-valor", "f-descricao"].forEach((id) => marcar(id, false));
  if (tipo !== "avulso") {
    if (!medidaOk(l)) { falta.push("largura"); if ($("f-largura").value) marcar("f-largura", true); }
    if (!medidaOk(a)) { falta.push("altura"); if ($("f-altura").value) marcar("f-altura", true); }
  } else {
    if ($("f-largura").value && !medidaOk(l)) { falta.push("largura válida"); marcar("f-largura", true); }
    if ($("f-altura").value && !medidaOk(a)) { falta.push("altura válida"); marcar("f-altura", true); }
  }
  if (!(Number.isInteger(qtd) && qtd >= 1 && qtd <= 99)) { falta.push("quantidade (1 a 99)"); marcar("f-qtd", true); }
  if (!(desconto >= 0)) { falta.push("desconto válido"); marcar("f-desconto", true); }
  if (COSTURA.includes(tipo) && !(barra >= 0 && barra <= 1 && mult >= 1 && mult <= 3)) falta.push("ajustes de costura válidos");
  const e = { tipo, ambiente: $("f-ambiente").value.trim(), largura: medidaOk(l) ? l : 0, altura: medidaOk(a) ? a : 0, qtd, desconto };
  const valores = { tecido: $("f-tecido").value, bk: $("f-bk").value, forro: $("f-forro").value, trilho: $("f-trilho").value, persiana: $("f-persiana").value, descricao: $("f-descricao").value.trim(), valor: lerNumero($("f-valor").value), barra, mult };
  for (const k of MATERIAIS[tipo]) e[k] = valores[k];
  if (tipo === "avulso") {
    if (!e.descricao) falta.push("descrição");
    if (!(e.valor > 0)) { falta.push("valor unitário"); if ($("f-valor").value) marcar("f-valor", true); }
  } else {
    for (const k of MATERIAIS[tipo]) if (["tecido", "bk", "forro", "trilho", "persiana"].includes(k) && !e[k]) falta.push(`${k === "bk" ? "tecido blackout" : k} (cadastre na página Preços)`);
  }
  if (falta.length) return { falta };
  try {
    return { e, r: calcularItem(e, tabelas, regras) };
  } catch (erro) {
    if (erro.faltaPreco) return { erro: `Falta o preço de "${erro.faltaPreco}" na tabela de preços. Avise o responsável pelos preços.` };
    throw erro;
  }
}

function atualizarItem() {
  const x = lerItem(), botoes = [$("j-confirmar"), $("j-outro")];
  if (!x.r) {
    $("resultado").innerHTML = `<p class="falta">${x.falta ? `Falta preencher: ${esc(x.falta.join(", "))}.` : esc(x.erro)}</p>`;
    $("conta").innerHTML = ""; $("avisos").innerHTML = "";
    botoes.forEach((b) => { b.disabled = true; });
    return;
  }
  const { e, r } = x;
  botoes.forEach((b) => { b.disabled = estadoItem.salvando; });
  const detalhe = e.qtd > 1 ? `<small>${e.qtd} × ${real(r.unit)}${e.desconto ? ` − ${real(e.desconto)} de desconto` : ""}</small>` : e.desconto ? `<small>${real(r.unit)} − ${real(e.desconto)} de desconto</small>` : "<small>em até 12x sem juros</small>";
  $("resultado").innerHTML = `<div class="nome-item">${esc(r.nome || TIPOS[e.tipo])}</div>
    <div class="valores"><div><small>No cartão</small><strong>${real(r.total)}</strong>${detalhe}</div><div class="vista"><small>À vista</small><strong>${real(r.vista)}</strong><small>PIX ou débito</small></div></div>`;
  // Avisos internos (regras do cálculo) só para o financeiro
  $("avisos").innerHTML = r.avisos.filter((a) => financeiro || !a.interno).map((a) => `<div class="aviso">${esc(a.texto)}</div>`).join("");
  if (!financeiro) { $("conta").innerHTML = ""; return; }
  let html = "";
  for (const g of r.grupos) {
    if (g.titulo) html += `<tr class="secao"><td colspan="2">${esc(g.titulo)}</td></tr>`;
    html += g.linhas.map((l) => `<tr><td>${esc(l.label)}</td><td>${real(l.valor)}</td></tr>`).join("");
  }
  html += r.conta.map((l) => `<tr${l.soma ? ' class="soma"' : ""}><td>${esc(l.label)}</td><td>${real(l.valor)}</td></tr>`).join("");
  html += `<tr class="soma"><td>Valor unitário</td><td>${real(r.unit)}</td></tr>`;
  if (e.qtd > 1) html += `<tr><td>Quantidade × ${e.qtd}</td><td>${real(centavos(r.unit * e.qtd))}</td></tr>`;
  if (e.desconto) html += `<tr><td>Desconto</td><td>− ${real(e.desconto)}</td></tr>`;
  if (e.qtd > 1 || e.desconto) html += `<tr class="soma"><td>Total do item</td><td>${real(r.total)}</td></tr>`;
  $("conta").innerHTML = html;
}
$("form-item").addEventListener("input", atualizarItem);
$("form-item").addEventListener("change", atualizarItem);

// Itens do sistema antigo guardam só o nome ("Sala - Cortina LINHO CRU - TRILHO SUÍÇO"), no mesmo formato de nomeItem.
// Reconhece produto e materiais pelos nomes das tabelas de preço; null se algum nome não estiver nas tabelas.
function reconhecerAntigo(produto) {
  const p = String(produto || "").trim();
  const nomes = (mapa) => Object.keys(mapa).sort((x, y) => y.length - x.length);
  const tirarFim = (texto, fim) => (texto.endsWith(fim) ? texto.slice(0, -fim.length) : null);
  // Antes do produto vem o ambiente e " - " (o sistema antigo deixava só "- " quando não havia ambiente)
  const ambiente = (resto) => {
    if (resto === null) return null;
    if (resto === "" || resto.trim() === "-") return "";
    return resto.endsWith(" - ") ? resto.slice(0, -3).trim() : null;
  };
  for (const pe of nomes(tabelas.persianas)) {
    const amb = ambiente(tirarFim(p, "Persiana " + pe));
    if (amb !== null) return { tipo: "persiana", ambiente: amb, persiana: pe };
  }
  for (const tr of nomes(tabelas.trilhos)) {
    const semTrilho = tirarFim(p, " - " + tr);
    if (semTrilho === null) continue;
    for (const [tipo, campo, rotulo, mapa] of [["cortinaBK", "bk", "Blackout", tabelas.tecidosBK], ["cortinaForro", "forro", "Forro", tabelas.tecidos]]) {
      for (const n of nomes(mapa)) {
        const semCamada = tirarFim(semTrilho, ` + ${rotulo} ${n}`);
        if (semCamada === null) continue;
        for (const te of nomes(tabelas.tecidos)) {
          const amb = ambiente(tirarFim(semCamada, "Cortina " + te));
          if (amb !== null) return { tipo, ambiente: amb, tecido: te, [campo]: n, trilho: tr };
        }
      }
    }
    for (const [tipo, campo, rotulo, mapa] of [["cortina", "tecido", "Cortina", tabelas.tecidos], ["blackout", "bk", "Blackout", tabelas.tecidosBK]]) {
      for (const n of nomes(mapa)) {
        const amb = ambiente(tirarFim(semTrilho, `${rotulo} ${n}`));
        if (amb !== null) return { tipo, ambiente: amb, [campo]: n, trilho: tr };
      }
    }
  }
  return null;
}

// Campos da janela a partir de um item gravado. Itens do sistema antigo voltam para o cálculo do produto
// quando o nome é reconhecido (antigo: "recalculado"); os demais abrem como item avulso (antigo: "avulso").
function camposDoItem(i) {
  const e = i.entrada;
  if (e && MATERIAIS[e.tipo]) {
    return { tipo: e.tipo, v: { "f-ambiente": e.ambiente, "f-descricao": e.descricao, "f-largura": paraCampo(e.largura || ""), "f-altura": paraCampo(e.altura || ""), "f-qtd": String(e.qtd || 1), "f-tecido": e.tecido, "f-bk": e.bk, "f-forro": e.forro, "f-trilho": e.trilho, "f-persiana": e.persiana, "f-valor": paraCampo(e.valor), "f-desconto": e.desconto ? paraCampo(e.desconto) : "", "f-barra": paraCampo(e.barra ?? 0.4), "f-mult": paraCampo(e.mult ?? 1.4) } };
  }
  const qtd = Number(i.qtd) || 1, l = Number(i.largura), a = Number(i.altura);
  const medidas = { "f-largura": l > 0 ? paraCampo(l) : "", "f-altura": a > 0 ? paraCampo(a) : "", "f-qtd": String(qtd), "f-barra": "0,4", "f-mult": "1,4" };
  const r = reconhecerAntigo(i.produto);
  if (r) return { tipo: r.tipo, antigo: "recalculado", v: { ...medidas, "f-ambiente": r.ambiente, "f-tecido": r.tecido, "f-bk": r.bk, "f-forro": r.forro, "f-trilho": r.trilho, "f-persiana": r.persiana } };
  return { tipo: "avulso", antigo: "avulso", v: { ...medidas, "f-descricao": i.produto, "f-valor": paraCampo(centavos((Number(i.total) || 0) / qtd)) } };
}
async function abrirItem({ tipo, item }) {
  // Para reconhecer um item antigo, as tabelas de preço precisam ter carregado
  if (item && !item.entrada && pTabelas) await pTabelas;
  estadoItem = { tipo: tipo || "cortina", editando: item || null, salvando: false };
  let v = { "f-qtd": "1", "f-barra": "0,4", "f-mult": "1,4" }, antigo = false;
  if (item) ({ tipo: estadoItem.tipo, v, antigo } = camposDoItem(item));
  // Selects primeiro sem valor, para a lista de opções não guardar o material do item anterior
  CAMPOS.forEach((id) => { const el = $(id); if (el.tagName === "SELECT") el.innerHTML = ""; });
  preencherOpcoes();
  for (const id of CAMPOS) {
    const el = $(id);
    if (el.tagName === "SELECT") { if (v[id]) { opcoesCom(el, v[id]); el.value = v[id]; } else el.selectedIndex = 0; }
    else el.value = v[id] ?? "";
  }
  $("j-antigo").innerHTML = antigo === "recalculado"
    ? `<div class="info"><span>Item feito no sistema antigo, gravado com ${real(Number(item.total) || 0)}. O valor abaixo foi recalculado com os preços de hoje. Se esse item tinha desconto, preencha o campo Desconto.</span></div>`
    : antigo ? '<div class="info"><span>Item feito no sistema antigo: dá para ajustar a descrição, o valor e a quantidade, ou refazer o item escolhendo o produto.</span></div>' : "";
  $("j-titulo").textContent = item ? "Editar item" : "Adicionar item";
  $("j-confirmar").innerHTML = item ? "Salvar alterações" : 'Adicionar<span class="so-largo">&nbsp;ao orçamento</span>';
  $("j-outro").hidden = !!item;
  $("calculo").open = false;
  $("ajustes").open = false;
  mostrarTipo(); atualizarItem();
  $("janela-item").hidden = false;
  $("form-item").querySelector(".corpo").scrollTop = 0;
  if (pTabelas) { await pTabelas; preencherOpcoes(); atualizarItem(); }
}
// Garante que o valor gravado exista como opção, mesmo que tenha saído da tabela
function opcoesCom(el, valor) {
  if (![...el.options].some((o) => o.value === valor)) el.insertAdjacentHTML("afterbegin", `<option value="${esc(valor)}">${esc(valor)} (sem preço)</option>`);
}
const fecharItem = () => { $("janela-item").hidden = true; };
$("j-fechar").onclick = fecharItem;

function montarItem(e, r, id) {
  const item = { id, tipo: e.tipo, ambiente: e.ambiente, produto: r.nome || TIPOS[e.tipo], largura: e.largura || 0, altura: e.altura || 0, qtd: e.qtd, unit: r.unit, total: r.total, desconto: e.desconto, entrada: e };
  if (r.custo !== null && r.custo !== undefined) item.custo = r.custo;
  return item;
}
async function guardarItem() {
  const x = lerItem();
  if (!x.r || estadoItem.salvando) return false;
  const alvo = estadoItem.editando, novo = montarItem(x.e, x.r, alvo?.id || novoId());
  estadoItem.salvando = true;
  const btn = $("j-confirmar"), rotulo = btn.innerHTML;
  btn.textContent = "Salvando…"; $("j-confirmar").disabled = $("j-outro").disabled = true;
  try {
    const ok = await alterarItens(atual.cliente, (itens) => {
      if (!alvo) { itens.push(novo); return; }
      const i = itens.findIndex((y) => mesmoItem(alvo, y));
      if (i === -1) return false;
      itens[i] = novo;
    });
    if (ok === false) { alert("Esse item foi removido ou alterado em outra tela. Confira a lista e tente de novo."); fecharItem(); return false; }
    return true;
  } catch (erro) {
    alert("O item não foi gravado. " + mensagemErro(erro));
    return false;
  } finally {
    estadoItem.salvando = false;
    btn.innerHTML = rotulo;
    atualizarItem();
  }
}
$("form-item").addEventListener("submit", async (e) => { e.preventDefault(); if (await guardarItem()) fecharItem(); });
// Mantém produto e materiais; limpa ambiente, medidas e desconto
$("j-outro").onclick = async () => {
  if (!(await guardarItem())) return;
  for (const id of ["f-ambiente", "f-descricao", "f-largura", "f-altura", "f-desconto", "f-valor"]) $(id).value = "";
  $("f-qtd").value = "1";
  atualizarItem();
  $("form-item").querySelector(".corpo").scrollTop = 0;
  $("f-ambiente").focus();
};

// ---------- Ver orçamento ----------
const EMPRESA = { nome: "Kazê Cortinas e Persianas", endereco: "Rua Quintino Bocaiúva, 1434 – Bosque", cidade: "Rio Branco – Acre", telefone: "(68) 99969-8220", cnpj: "15.051.769/0001-06" };
const VALIDADE_DIAS = 30;
const LOGO = new URL("logo_kaze_app.jpg", location.href).href;
let parcelas = 12;

// O que o cliente vê: sem medidas e sem CPF/e-mail; campo vazio não aparece
function folhaHTML(o, n) {
  const c = clienteDoOrc(o), t = totalDe(o), d = dataOrc(o), validade = new Date(d);
  validade.setDate(validade.getDate() + VALIDADE_DIAS);
  const endereco = [c.endereco, c.bairro, c.cidade].map((v) => String(v || "").trim()).filter(Boolean).join(", ");
  const contato = [c.telefone, endereco].filter((v) => String(v || "").trim()).map(esc).join(" · ");
  const parc = n > 1 ? `em até ${n}x de ${real(centavos(t / n))} sem juros` : "em 1x no cartão";
  return `<div class="f-topo"><img src="${LOGO}" alt="Kazê Cortinas e Persianas"><div class="f-empresa"><b>${EMPRESA.nome}</b><span>${EMPRESA.endereco}</span><span>${EMPRESA.cidade}</span><span>${EMPRESA.telefone} · CNPJ ${EMPRESA.cnpj}</span></div></div>
    <div class="f-titulo"><h2>ORÇAMENTO</h2><span>${numOrc(o)} · ${dataCurta(d)}</span></div>
    <div class="f-cliente"><span>Cliente</span><b>${esc(c.nome)}</b>${contato ? `<div>${contato}</div>` : ""}</div>
    <table class="f-itens"><thead><tr><th>Discriminação</th><th class="n">Qtd</th><th class="n">Valor</th></tr></thead><tbody>${(o.itens || []).map((i) => `<tr><td>${esc(i.produto)}</td><td class="n">${Number(i.qtd) || 1}</td><td class="n">${real(i.total)}</td></tr>`).join("")}</tbody></table>
    <div class="f-totais"><div class="f-linha"><div>Cartão de crédito<small>${parc}</small></div><b>${real(t)}</b></div><div class="f-linha f-vista"><div>À vista<small>PIX ou débito</small></div><b>${real(vistaDe(o))}</b></div></div>
    <div class="f-rodape">Orçamento válido por ${VALIDADE_DIAS} dias, até ${dataCurta(validade)}.</div>`;
}

const FORMAS = { cartao: "Cartão de crédito", pix: "PIX", debito: "Débito", dinheiro: "Dinheiro", transferencia: "Transferência" };
const formaTexto = (p) => (p.forma === "cartao" ? `Cartão em ${p.parcelas || 1}x` : FORMAS[p.forma] || p.forma || "");

function rVer(navegou) {
  const o = orcamentos.get(atual.orc);
  if (!o) {
    const id = atual.orc;
    if (carregado.orcamentos) buscarOrc(id).then((achou) => { if (!achou && atual.orc === id) ir("orcamentos", {}, "replace"); });
    return;
  }
  const c = clienteDoOrc(o), ped = pedidos.get(o.id);
  $("ver-voltar-cliente").textContent = c.nome;
  $("ver-voltar-cliente").onclick = () => (c.id ? ir("cliente-orc", { cliente: c.id }) : ir("orcamentos"));
  $("ver-migalha").textContent = numOrc(o);
  if (navegou) $("ver-confirma").innerHTML = "";
  if (ped) {
    const d = dataPed(ped);
    $("ver-aprovado").innerHTML = `<div class="aprovado"><span>✓ <b>Pedido aprovado</b>${d ? ` em ${dataCurta(d)} às ${hora(d)}` : ""} por ${esc(nomePessoa(ped.aprovadoPor, ped.aprovadoPorEmail))} · ${esc(formaTexto(ped))} · <b>${real(ped.valorFechado)}</b>${ped.observacao ? ` · ${esc(ped.observacao)}` : ""}</span>${financeiro ? '<button class="btn btn-secundario btn-p" type="button" id="ver-desaprovar">Cancelar aprovação</button>' : ""}</div>`;
    $("ver-desaprovar")?.addEventListener("click", () => confirmar($("ver-confirma"), `Cancelar a aprovação do ${numOrc(o)}? O pedido sai dos Dados; o orçamento continua salvo.`, "Cancelar aprovação", async () => {
      try { await deleteDoc(doc(db, "pedidos", o.id)); } catch (erro) { avisar($("ver-confirma"), `Não foi possível cancelar. ${erroTexto(erro)}`, "confirma"); }
    }));
  } else $("ver-aprovado").innerHTML = "";
  $("ver-aprovar").hidden = !!ped;
  $("ver-excluir").hidden = !!ped && !financeiro;
  $("ver-editar").onclick = () => (c.id ? comecarRascunho(c.id, o.id) : avisar($("ver-confirma"), "O cliente deste orçamento foi excluído. Cadastre-o de novo para fazer outro orçamento."));
  $("ver-excluir").onclick = () => {
    const extra = ped ? " O pedido aprovado continua guardado nos Dados." : "";
    confirmar($("ver-confirma"), `Excluir o ${numOrc(o)} de ${esc(c.nome)}?${extra} Não dá para desfazer.`, "Excluir", () => excluirOrcamento(o, $("ver-confirma")));
  };
  $("ver-parcelas").value = String(parcelas);
  $("folha").innerHTML = folhaHTML(o, parcelas);
  $("ver-medidas").innerHTML = (o.itens || []).map((i) => `<div class="item" style="grid-template-columns:minmax(0,1fr) auto;padding-right:12px"><div><b>${esc(i.produto)}</b><small>${detalheItem(i) || "sem medida"}</small></div><span class="valor">${real(i.total)}</span></div>`).join("");
}
$("ver-parcelas").onchange = (e) => { parcelas = +e.target.value; $("folha").innerHTML = folhaHTML(orcamentos.get(atual.orc), parcelas); };
$("ver-imprimir").onclick = () => window.print();

// Imagem: gerada a partir de uma cópia com largura fixa, para sair igual no celular e no computador
let imagem = null;
const DICA_SALVAR = "Se não baixar, toque e segure a imagem (no computador, botão direito) e escolha Salvar imagem.";
$("ver-imagem").onclick = async () => {
  const o = orcamentos.get(atual.orc), c = clienteDoOrc(o), btn = $("ver-imagem"), el = $("folha-img");
  btn.disabled = true; btn.textContent = "Gerando…";
  try {
    if (typeof html2canvas !== "function") throw new Error("gerador de imagem não carregou");
    el.innerHTML = folhaHTML(o, parcelas);
    await document.fonts.ready;
    await Promise.all([...el.querySelectorAll("img")].map((i) => i.decode().catch(() => {})));
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", logging: false });
    const blob = await new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error("imagem vazia"))), "image/png"));
    const d = dataOrc(o), nome = `${c.nome} - orçamento ${numOrc(o).replace(/^(Nº|Ref\.) /, "")} - ${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}.png`.replace(/[\\/:*?"<>|]/g, "");
    if (imagem) URL.revokeObjectURL(imagem.url);
    imagem = { blob, url: URL.createObjectURL(blob), nome, arquivo: new File([blob], nome, { type: "image/png" }) };
    $("img-gerada").src = imagem.url;
    $("ji-nome").textContent = nome;
    $("ji-msg").textContent = "";
    $("ji-compartilhar").hidden = !(navigator.canShare && navigator.canShare({ files: [imagem.arquivo] }));
    $("janela-imagem").hidden = false;
  } catch (erro) {
    console.error(erro);
    avisar($("ver-confirma"), "Não foi possível gerar a imagem. Tente de novo.", "confirma");
  } finally {
    el.innerHTML = "";
    btn.disabled = false; btn.textContent = "Salvar imagem";
  }
};
$("ji-baixar").onclick = () => {
  const a = document.createElement("a");
  a.href = imagem.url; a.download = imagem.nome;
  document.body.append(a); a.click(); a.remove();
  $("ji-msg").textContent = DICA_SALVAR;
};
// No celular: manda direto para o WhatsApp ou outro app
$("ji-compartilhar").onclick = async () => {
  try { await navigator.share({ files: [imagem.arquivo], title: imagem.nome }); }
  catch (erro) { if (erro.name !== "AbortError") $("ji-msg").textContent = DICA_SALVAR; }
};
const fecharImagem = () => { $("janela-imagem").hidden = true; };
$("ji-fechar").onclick = fecharImagem;
$("janela-imagem").addEventListener("click", (e) => { if (e.target === $("janela-imagem")) fecharImagem(); });

// ---------- Aprovar pedido ----------
let aprovar = null; // { o, forma }
function valorTabela() { return aprovar.forma === "cartao" ? totalDe(aprovar.o) : vistaDe(aprovar.o); }
function mostrarForma() {
  document.querySelectorAll("#form-aprovar [data-forma]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.forma === aprovar.forma)));
  $("ja-campo-parcelas").hidden = aprovar.forma !== "cartao";
  $("ja-campo-meio").hidden = aprovar.forma === "cartao";
  $("ja-valor").value = m2(valorTabela()).replace(/\./g, "");
  conferirValor();
}
function conferirValor() {
  const v = lerNumero($("ja-valor").value), tabela = valorTabela(), msg = $("ja-valor-msg");
  marcar("ja-valor", false); msg.className = "";
  if (!(v > 0)) { msg.textContent = $("ja-valor").value ? "Valor inválido." : "Informe o valor fechado."; msg.className = "erro"; return null; }
  const dif = centavos(tabela - v);
  msg.textContent = dif > 0 ? `Desconto de ${real(dif)} (${(dif / tabela * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%) sobre o valor do orçamento.` : dif < 0 ? `${real(-dif)} acima do valor do orçamento.` : "Mesmo valor do orçamento.";
  return v;
}
$("ver-aprovar").onclick = () => {
  const o = orcamentos.get(atual.orc);
  if (pedidosBloqueados) { avisar($("ver-confirma"), "A aprovação de pedidos ainda não está liberada no banco de dados. Falta publicar as regras novas (veja o README)."); return; }
  aprovar = { o, forma: "cartao" };
  const t = totalDe(o);
  $("ja-sub").textContent = `${numOrc(o)} · ${clienteDoOrc(o).nome}`;
  $("ja-cartao").textContent = real(t);
  $("ja-vista").textContent = real(vistaDe(o));
  $("ja-parcelas").innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}x de ${real(centavos(t / (i + 1)))}</option>`).join("");
  $("ja-parcelas").value = String(parcelas);
  $("ja-meio").value = "pix";
  $("ja-obs").value = "";
  $("ja-confirma").innerHTML = "";
  mostrarForma();
  $("janela-aprovar").hidden = false;
};
document.querySelectorAll("#form-aprovar [data-forma]").forEach((b) => { b.onclick = () => { aprovar.forma = b.dataset.forma; mostrarForma(); }; });
$("ja-valor").addEventListener("input", conferirValor);
const fecharAprovar = () => { $("janela-aprovar").hidden = true; };
$("ja-fechar").onclick = fecharAprovar;
$("ja-cancelar").onclick = fecharAprovar;
$("form-aprovar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const valor = conferirValor();
  if (valor === null) { marcar("ja-valor", true); $("ja-valor").focus(); return; }
  const btn = $("ja-confirmar");
  btn.disabled = true; btn.textContent = "Aprovando…";
  try {
    await aprovarPedido(aprovar.o, { forma: aprovar.forma === "cartao" ? "cartao" : $("ja-meio").value, parcelas: aprovar.forma === "cartao" ? +$("ja-parcelas").value : 1, valor: centavos(valor), valorTabela: valorTabela(), observacao: $("ja-obs").value.trim() });
    fecharAprovar();
  } catch (erro) {
    avisar($("ja-confirma"), erro.jaAprovado ? "Este orçamento já tinha sido aprovado." : `A aprovação não foi gravada. ${erroTexto(erro)}`, "confirma");
  } finally {
    btn.disabled = false; btn.textContent = "Confirmar aprovação";
  }
});
// pedidos/{id do orçamento}: um retrato do orçamento no momento da aprovação, com data e hora do servidor
async function aprovarPedido(o, escolha) {
  const ref = doc(db, "pedidos", o.id), c = clienteDoOrc(o);
  const dados = {
    orcamentoId: o.id,
    numero: o.numero ?? null,
    orcamentoFeitoEm: o.dataHora || null,
    orcamentoPor: o.usuarioId || null,
    clienteId: o.clienteId || null,
    cliente: { nome: c.nome || "", bairro: c.bairro || "", cidade: c.cidade || "" },
    itens: o.itens || [],
    totalCartao: totalDe(o),
    totalVista: vistaDe(o),
    forma: escolha.forma,
    parcelas: escolha.parcelas,
    valorTabela: escolha.valorTabela,
    valorFechado: escolha.valor,
    desconto: centavos(escolha.valorTabela - escolha.valor),
    observacao: escolha.observacao,
    status: "aprovado",
    aprovadoEm: serverTimestamp(),
    aprovadoPor: usuario.uid,
    aprovadoPorEmail: usuario.email || ""
  };
  await runTransaction(db, async (t) => {
    if ((await t.get(ref)).exists()) throw Object.assign(new Error("Já aprovado"), { jaAprovado: true });
    t.set(ref, dados);
  });
}

// ---------- Dados ----------
let periodo = "mes", falhouDesde = null;
function intervalo(p) {
  const h = new Date(), ano = h.getFullYear(), mes = h.getMonth();
  if (p === "mes") return [new Date(ano, mes, 1), null];
  if (p === "mesPassado") return [new Date(ano, mes - 1, 1), new Date(ano, mes, 1)];
  if (p === "90") return [new Date(h.getTime() - 90 * 864e5), null];
  if (p === "ano") return [new Date(ano, 0, 1), null];
  return [null, null];
}
const dentro = (d, [ini, fim]) => !!d && (!ini || d >= ini) && (!fim || d < fim);
const pct = (v) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
function tabelaHTML(cab, linhas) {
  if (!linhas.length) return '<div class="vazio">Nada no período.</div>';
  const cel = (tag, v, i) => `<${tag}${i ? ' class="num"' : ""}>${v}</${tag}>`;
  return `<table><thead><tr>${cab.map((c, i) => cel("th", c, i)).join("")}</tr></thead><tbody>${linhas.map((l) => `<tr>${l.map((v, i) => cel("td", v, i)).join("")}</tr>`).join("")}</tbody></table>`;
}
// Agrupa e soma: chave → { n, valor }
function agrupar(lista, chave, valor, n = () => 1) {
  const g = new Map();
  for (const x of lista) {
    const k = chave(x), atualG = g.get(k) || { n: 0, valor: 0 };
    atualG.n += n(x); atualG.valor = centavos(atualG.valor + valor(x));
    g.set(k, atualG);
  }
  return [...g.entries()].sort((a, b) => b[1].valor - a[1].valor);
}
function dadosDoPeriodo() {
  const iv = intervalo(periodo);
  const orcs = [...orcamentos.values()].filter((o) => dentro(dataOrc(o), iv));
  const peds = [...pedidos.values()].filter((p) => dentro(dataPed(p), iv)).sort((a, b) => dataPed(b) - dataPed(a));
  return { orcs, peds };
}
function rDados() {
  // Períodos mais antigos que os orçamentos em memória são lidos agora (uma vez por abertura do app)
  const ini = intervalo(periodo)[0], desde = ini ? ini.toISOString() : "", aviso = $("dados-carregando");
  const lido = lidosDesde === "" || (desde && desde >= lidosDesde);
  aviso.hidden = lido;
  if (!lido && falhouDesde !== desde) {
    aviso.textContent = "Lendo os orçamentos do período…";
    carregarDesde(ini).catch((erro) => { falhouDesde = desde; aviso.textContent = `Não foi possível ler os orçamentos do período. ${mensagemErro(erro)}`; });
  }
  const { orcs, peds } = dadosDoPeriodo();
  $("dados-aviso").innerHTML = pedidosBloqueados ? '<div class="info"><span>Os pedidos aprovados ainda não aparecem porque falta publicar as regras novas do banco de dados.</span></div>' : "";
  const clientesOrc = new Set(orcs.map((o) => o.clienteId));
  const fecharam = new Set(orcs.filter((o) => pedidos.has(o.id)).map((o) => o.clienteId));
  const vendido = centavos(peds.reduce((s, p) => s + (Number(p.valorFechado) || 0), 0));
  const tabela = peds.reduce((s, p) => s + (Number(p.valorTabela) || 0), 0);
  const prazos = peds.map((p) => (p.orcamentoFeitoEm ? (dataPed(p) - new Date(p.orcamentoFeitoEm)) / 864e5 : NaN)).filter((d) => d >= 0);
  const prazo = prazos.length ? prazos.reduce((s, d) => s + d, 0) / prazos.length : null;
  const card = (titulo, valor, detalhe) => `<div class="numero"><span>${titulo}</span><strong>${valor}</strong><small>${detalhe}</small></div>`;
  $("dados-numeros").innerHTML = [
    card("Orçamentos", orcs.length, `${real(orcs.reduce((s, o) => s + totalDe(o), 0))} para ${plural(clientesOrc.size, "cliente", "clientes")}`),
    card("Pedidos aprovados", peds.length, "aprovados no período"),
    card("Vendido", real(vendido), tabela > 0 ? `desconto médio de ${pct(Math.max(0, (tabela - vendido) / tabela))}` : "valor fechado"),
    card("Clientes que fecharam", clientesOrc.size ? pct(fecharam.size / clientesOrc.size) : "–", `${fecharam.size} de ${clientesOrc.size} com orçamento no período`),
    card("Ticket médio", peds.length ? real(vendido / peds.length) : "–", "por pedido"),
    card("Tempo até aprovar", prazo === null ? "–" : `${prazo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`, "do orçamento à aprovação, em média")
  ].join("");
  const itens = peds.flatMap((p) => p.itens || []);
  $("dados-produtos").innerHTML = tabelaHTML(["Produto", "Qtd", "Valor"], agrupar(itens, (i) => TIPOS[i.tipo] || "Outros (sistema antigo)", (i) => Number(i.total) || 0, (i) => Number(i.qtd) || 1).map(([k, g]) => [esc(k), g.n, real(g.valor)]));
  $("dados-formas").innerHTML = tabelaHTML(["Forma", "Pedidos", "Valor"], agrupar(peds, (p) => FORMAS[p.forma] || p.forma || "–", (p) => Number(p.valorFechado) || 0).map(([k, g]) => [esc(k), g.n, real(g.valor)]));
  const pessoas = new Map();
  for (const o of orcs) { const k = o.usuarioId || "?"; const x = pessoas.get(k) || { orc: 0, ped: 0, valor: 0, email: o.usuarioEmail }; x.orc++; pessoas.set(k, x); }
  for (const p of peds) { const k = p.orcamentoPor || "?"; const x = pessoas.get(k) || { orc: 0, ped: 0, valor: 0 }; x.ped++; x.valor = centavos(x.valor + (Number(p.valorFechado) || 0)); pessoas.set(k, x); }
  $("dados-pessoas").innerHTML = tabelaHTML(["Quem fez o orçamento", "Orçamentos", "Aprovados", "Vendido"], [...pessoas.entries()].sort((a, b) => b[1].valor - a[1].valor || b[1].orc - a[1].orc).map(([uid, x]) => [`${esc(nomePessoa(uid, x.email))}<br><small class="suave">${esc(emailPessoa(uid, x.email))}</small>`, x.orc, x.ped, real(x.valor)]));
  $("dados-bairros").innerHTML = tabelaHTML(["Bairro", "Pedidos", "Valor"], agrupar(peds, (p) => [p.cliente?.bairro, p.cliente?.cidade].filter(Boolean).join(", ") || "Sem bairro", (p) => Number(p.valorFechado) || 0).slice(0, 10).map(([k, g]) => [esc(k), g.n, real(g.valor)]));
  $("dados-qtd-pedidos").textContent = peds.length ? plural(peds.length, "pedido", "pedidos") : "";
  $("dados-pedidos").innerHTML = peds.length ? peds.map((p) => {
    const d = dataPed(p);
    return `<button class="linha" type="button" data-pedido="${esc(p.id)}"><div><div class="nome">${esc(p.cliente?.nome || "")}</div><div class="det">${d ? `${dataCurta(d)} às ${hora(d)}` : ""} · ${p.numero ? `Nº ${String(p.numero).padStart(4, "0")}` : `Ref. ${esc(p.id.slice(0, 6).toUpperCase())}`} · ${esc(formaTexto(p))} · por ${esc(nomePessoa(p.aprovadoPor, p.aprovadoPorEmail))}</div></div><div class="valor">${real(p.valorFechado)}</div></button>`;
  }).join("") : '<div class="vazio">Nenhum pedido aprovado no período.</div>';
  $("dados-pedidos").querySelectorAll("[data-pedido]").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.pedido;
      if (orcamentos.has(id) || (await buscarOrc(id))) ir("ver", { orc: id });
      else alert("O orçamento deste pedido foi excluído. O pedido continua nos dados.");
    };
  });
}
$("dados-periodos").onclick = (e) => {
  const b = e.target.closest("[data-periodo]");
  if (!b) return;
  periodo = b.dataset.periodo;
  document.querySelectorAll("#dados-periodos button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  rDados();
};
// Planilhas (CSV) do período, no formato que o Excel em português abre direto
const numCSV = (v) => (Number(v) || 0).toFixed(2).replace(".", ",");
const quandoCSV = (d) => (d ? `${dataCurta(d)} ${hora(d)}` : "");
function baixarCSV(nome, linhas) {
  const campo = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = "\ufeff" + linhas.map((l) => l.map(campo).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const h = new Date(), a = document.createElement("a");
  a.href = url; a.download = `kaze-${nome}-${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(h.getDate())}.csv`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("dados-csv").onclick = () => {
  const { peds } = dadosDoPeriodo();
  const linhas = [["Aprovado em", "Orçamento", "Orçamento feito em", "Dias até aprovar", "Cliente", "Bairro", "Cidade", "Forma", "Parcelas", "Valor do orçamento", "Valor fechado", "Desconto", "Itens", "Produtos", "Quem fez o orçamento", "Quem aprovou", "Observação"]];
  for (const p of peds) {
    const d = dataPed(p), feito = p.orcamentoFeitoEm ? new Date(p.orcamentoFeitoEm) : null;
    linhas.push([quandoCSV(d), p.numero || p.id, quandoCSV(feito), feito && d ? numCSV((d - feito) / 864e5) : "", p.cliente?.nome, p.cliente?.bairro, p.cliente?.cidade, FORMAS[p.forma] || p.forma, p.parcelas, numCSV(p.valorTabela), numCSV(p.valorFechado), numCSV(p.desconto), (p.itens || []).length, (p.itens || []).map((i) => i.produto).join(" | "), emailPessoa(p.orcamentoPor), p.aprovadoPorEmail, p.observacao]);
  }
  baixarCSV("pedidos", linhas);
};
// Orçamentos do período (sem telefone nem CPF), para conferir vendas antigas com os orçamentos
$("dados-csv-orc").onclick = async () => {
  const botao = $("dados-csv-orc");
  botao.disabled = true;
  try {
    await carregarDesde(intervalo(periodo)[0]);
    const orcs = dadosDoPeriodo().orcs.sort((a, b) => dataOrc(a) - dataOrc(b));
    const linhas = [["Orçamento", "Id", "Feito em", "Cliente", "Bairro", "Cidade", "Total no cartão", "Total à vista", "Itens", "Produtos", "Quem fez", "Pedido aprovado"]];
    for (const o of orcs) {
      const c = clienteDoOrc(o);
      linhas.push([numOrc(o), o.id, quandoCSV(dataOrc(o)), c.nome, c.bairro, c.cidade, numCSV(totalDe(o)), numCSV(vistaDe(o)), (o.itens || []).length, (o.itens || []).map((i) => i.produto).join(" | "), emailPessoa(o.usuarioId, o.usuarioEmail), pedidos.has(o.id) ? "Sim" : "Não"]);
    }
    baixarCSV("orcamentos", linhas);
  } catch (erro) {
    alert(`Não foi possível ler os orçamentos do período. ${mensagemErro(erro)}`);
  } finally {
    botao.disabled = false;
  }
};

// ---------- Janela do cliente ----------
const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");
function mascaraTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function mascaraDoc(v) {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  return d.replace(/(\d{2})(\d)/, "$1.$2").replace(/(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4").replace(/(\d{4})(\d)/, "$1-$2");
}
function cpfValido(c) {
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const n of [9, 10]) { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); if (((s * 10) % 11) % 10 !== +c[n]) return false; }
  return true;
}
function cnpjValido(c) {
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
  const dv = (n) => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const r = p.reduce((a, x, i) => a + +c[i] * x, 0) % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +c[12] && dv(13) === +c[13];
}
function msg(id, texto, tipo) { const el = $(id); el.textContent = texto; el.className = tipo || ""; }
function checarDoc() {
  const d = soDigitos($("c-doc").value);
  if (!d) { msg("c-doc-msg", "Opcional. É conferido automaticamente."); marcar("c-doc", false); return true; }
  if (d.length < 11 || (d.length > 11 && d.length < 14)) { msg("c-doc-msg", "CPF tem 11 números; CNPJ tem 14."); marcar("c-doc", false); return false; }
  const tipo = d.length === 11 ? "CPF" : "CNPJ", ok = d.length === 11 ? cpfValido(d) : cnpjValido(d);
  msg("c-doc-msg", ok ? `${tipo} válido` : `${tipo} inválido: confira os números`, ok ? "certo" : "erro");
  marcar("c-doc", !ok);
  return ok;
}
$("c-tel").addEventListener("input", (e) => { e.target.value = mascaraTelefone(e.target.value); });
$("c-doc").addEventListener("input", (e) => { e.target.value = mascaraDoc(e.target.value); checarDoc(); });
$("c-nome").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\s{2,}/g, " "); });

let editando = null, aoSalvarNovo = null;
const CAMPOS_CLIENTE = [["c-nome", "nome"], ["c-tel", "telefone"], ["c-doc", "cpfOuCnpj"], ["c-end", "endereco"], ["c-bairro", "bairro"], ["c-cidade", "cidade"], ["c-email", "email"]];
function abrirJanelaCliente(id, depoisDeSalvar = null) {
  editando = id || null;
  aoSalvarNovo = id ? null : depoisDeSalvar;
  $("jc-salvar").textContent = aoSalvarNovo ? "Salvar e começar orçamento" : "Salvar cliente";
  const c = id ? cliente(id) : { cidade: "Rio Branco" };
  $("jc-titulo").textContent = id ? "Editar cliente" : "Novo cliente";
  for (const [campo, chave] of CAMPOS_CLIENTE) $(campo).value = String(c[chave] ?? "");
  if (soDigitos($("c-tel").value).length >= 10) $("c-tel").value = mascaraTelefone($("c-tel").value);
  if (soDigitos($("c-doc").value)) $("c-doc").value = mascaraDoc($("c-doc").value);
  ["c-nome-msg", "c-tel-msg", "c-email-msg"].forEach((m) => msg(m, ""));
  ["c-nome", "c-tel", "c-email"].forEach((m) => marcar(m, false));
  checarDoc();
  $("jc-confirma").innerHTML = "";
  $("jc-excluir").hidden = !id;
  $("jc-orcamentos").hidden = !id;
  if (id) { carregarOrcsDoCliente(id); rotuloOrcsCliente(id); }
  $("jc-salvar").disabled = false;
  $("janela-cliente").hidden = false;
  if (!id) $("c-nome").focus();
}
function rotuloOrcsCliente(id) {
  $("jc-orcamentos").textContent = orcsCompletos.has(id) ? `Orçamentos (${orcsDoCliente(id).length})` : "Orçamentos";
}
const fecharJanelaCliente = () => { $("janela-cliente").hidden = true; };
$("btn-novo-cliente").onclick = () => abrirJanelaCliente(null);
$("jc-fechar").onclick = fecharJanelaCliente;
$("jc-cancelar").onclick = fecharJanelaCliente;
$("jc-orcamentos").onclick = () => { const id = editando; fecharJanelaCliente(); ir("cliente-orc", { cliente: id }); };
$("janela-cliente").addEventListener("click", (e) => { if (e.target === $("janela-cliente")) fecharJanelaCliente(); });
$("jc-excluir").onclick = () => {
  if (!orcsCompletos.has(editando)) { avisar($("jc-confirma"), "Carregando os orçamentos deste cliente. Tente de novo em instantes."); return; }
  const c = cliente(editando), orcs = orcsDoCliente(c.id), aprovados = orcs.filter((o) => pedidos.has(o.id)).length;
  if (aprovados && !financeiro) { avisar($("jc-confirma"), "Clientes com pedido aprovado não podem ser excluídos."); return; }
  const n = orcs.length;
  const extra = (n ? ` ${n === 1 ? "O orçamento salvo dele também será excluído." : `Os ${n} orçamentos salvos dele também serão excluídos.`}` : "") + (aprovados ? " Os pedidos aprovados continuam nos Dados." : "");
  confirmar($("jc-confirma"), `Excluir ${esc(c.nome)}?${extra} Não dá para desfazer.`, "Excluir cliente", async () => {
    try {
      const lote = writeBatch(db);
      orcs.forEach((o) => lote.delete(doc(db, "orcamentos", o.id)));
      lote.delete(doc(db, "clientes", c.id));
      await lote.commit();
      esquecerOrcs(orcs.map((o) => o.id));
      fecharJanelaCliente();
      if (atual.tela !== "clientes") ir("clientes", {}, "replace");
    } catch (erro) {
      avisar($("jc-confirma"), `Não foi possível excluir. ${erroTexto(erro)}`, "confirma");
    }
  });
};
$("form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  let ok = true;
  const nome = $("c-nome").value.trim(), tel = soDigitos($("c-tel").value), email = $("c-email").value.trim();
  if (nome.length < 3) { msg("c-nome-msg", "Informe o nome (pelo menos 3 letras).", "erro"); marcar("c-nome", true); ok = false; } else { msg("c-nome-msg", ""); marcar("c-nome", false); }
  if (tel.length < 10) { msg("c-tel-msg", "Telefone com DDD: 10 ou 11 números.", "erro"); marcar("c-tel", true); ok = false; } else { msg("c-tel-msg", ""); marcar("c-tel", false); }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg("c-email-msg", "E-mail incompleto. Ex.: nome@exemplo.com", "erro"); marcar("c-email", true); ok = false; } else { msg("c-email-msg", ""); marcar("c-email", false); }
  if (!checarDoc()) ok = false;
  if (!ok) return;
  const dados = { nome, telefone: $("c-tel").value, cpfOuCnpj: $("c-doc").value, endereco: $("c-end").value.trim(), bairro: $("c-bairro").value.trim(), cidade: $("c-cidade").value.trim(), email };
  const btn = $("jc-salvar"), rotulo = btn.textContent, depois = aoSalvarNovo;
  btn.disabled = true; btn.textContent = "Salvando…";
  try {
    let id = editando;
    if (editando) await updateDoc(doc(db, "clientes", editando), dados);
    else {
      const ref = doc(collection(db, "clientes"));
      await setDoc(ref, { ...dados, criadoPor: usuario.uid, criadoEm: serverTimestamp() });
      id = ref.id;
    }
    fecharJanelaCliente();
    if (depois) depois(id);
  } catch (erro) {
    avisar($("jc-confirma"), `Não foi possível salvar. ${erroTexto(erro)}`, "confirma");
  } finally {
    btn.disabled = false; btn.textContent = rotulo;
  }
});

// ---------- Teclado ----------
function fecharJanelas() { ["janela-imagem", "janela-cliente", "janela-escolher", "janela-item", "janela-aprovar"].forEach((id) => { $(id).hidden = true; }); }
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const aberta = ["janela-imagem", "janela-aprovar", "janela-item", "janela-cliente", "janela-escolher"].find((id) => !$(id).hidden);
  if (aberta) $(aberta).hidden = true;
});
