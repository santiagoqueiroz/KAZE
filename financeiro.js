// FINANCEIRO.JS — inicialização própria (ESM, Firebase v10.12.2)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where, orderBy,
  writeBatch, updateDoc, deleteDoc, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5kVoWRWZB6xtacyu6lH--QFXry_MPKps",
  authDomain: "kaze-8836b.firebaseapp.com",
  projectId: "kaze-8836b",
  storageBucket: "kaze-8836b.firebasestorage.app",
  messagingSenderId: "336054068300",
  appId: "1:336054068300:web:6125e8eecc08d667fac0e9"
};

// Usa o app [DEFAULT] se já existir; senão cria
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ===== helpers =====
const $ = (id) => document.getElementById(id);
const els = {
  totais: $("totais"),
  filtroStatus: $("filtroStatus"),
  filtroTipo: $("filtroTipo"),
  filtroCategoria: $("filtroCategoria"),
  mesInicio: $("mesInicio"),
  mesFim: $("mesFim"),
  btnAplicarFiltros: $("btnAplicarFiltros"),

  // Campos do formulário (agora dentro do modal)
  descricao: $("descricao"),
  categoria: $("categoria"),
  valor: $("valor"),
  data: $("data"),
  tipo: $("tipo"),
  formaPgto: $("formaPgto"),
  status: $("status"),
  recorrencia: $("recorrencia"),
  btnSalvar: $("btnSalvar"),

  // Tabela
  tbody: $("tbody"),

  // Modal
  modal: $("modalNovo"),
  btnAbrirModal: $("btnAbrirModal"),
  btnFecharModal: $("btnFecharModal"),
  btnCancelarModal: $("btnCancelarModal"),
  modalBackdrop: $("modalBackdrop"),
};

const COL_CATEGORIAS   = "categorias";
const COL_LANCAMENTOS  = "lancamentos";

function fmtMoney(n){ return (Number(n)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function ymd(d){ const x=new Date(d); const m=String(x.getMonth()+1).padStart(2,"0"); const dd=String(x.getDate()).padStart(2,"0"); return `${x.getFullYear()}-${m}-${dd}`; }
function monthRangeStr(ym){ const [y,m]=ym.split("-").map(Number); return [ymd(new Date(y,m-1,1)), ymd(new Date(y,m,0))]; }
function addMonths(dateStr,n){ const d=new Date(dateStr); d.setMonth(d.getMonth()+n); return ymd(d); }

// ===== modal controls =====
function openModal(){
  els.modal?.removeAttribute("inert");   // <<< novo
  els.modal?.classList.add("is-open");
  if(els.tipo) els.tipo.value = "despesa";
  setTimeout(()=>els.descricao?.focus(), 10);
}

function closeModal(){
  if (document.activeElement && els.modal.contains(document.activeElement)) {
    document.activeElement.blur();   // <<< novo: tira foco antes de ocultar
  }
  els.modal?.setAttribute("inert","");   // <<< novo
  els.modal?.classList.remove("is-open");
}

function wireModal(){
  els.btnAbrirModal?.addEventListener("click", openModal);
  els.btnFecharModal?.addEventListener("click", closeModal);
  els.btnCancelarModal?.addEventListener("click", closeModal);
  els.modalBackdrop?.addEventListener("click", closeModal);
  document.addEventListener("keydown", (e)=>{
    if(e.key === "Escape" && els.modal?.classList.contains("is-open")) closeModal();
  });
}

// ===== boot =====
async function boot(){
  setupDefaults();
  await loadCategorias();

  onAuthStateChanged(auth, (user)=>{
    if(!user){
      try{ window.location.href = "index.html"; }catch(e){}
      return;
    }
    refreshAll();
  });

  els.btnAplicarFiltros?.addEventListener("click", ()=>refreshAll());
  els.btnSalvar?.addEventListener("click", ()=>salvarLancamento());
  wireModal();
}

function setupDefaults(){
  const now=new Date();
  const ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  if(els.mesInicio) els.mesInicio.value=ym;
  if(els.mesFim) els.mesFim.value=ym;
  if(els.filtroTipo) els.filtroTipo.value="despesa";
  if(els.tipo) els.tipo.value="despesa";
}

// ===== categorias (somente 'despesa') =====
async function loadCategorias(){
  const chk = await getDocs(query(collection(db, COL_CATEGORIAS)));
  if(chk.empty){
    const batch = writeBatch(db);
    [
      { nome:"Aluguel", tipo:"despesa" },
      { nome:"Energia", tipo:"despesa" },
      { nome:"Água", tipo:"despesa" },
      { nome:"Fornecedores", tipo:"despesa" },
      { nome:"Impostos", tipo:"despesa" },
    ].forEach(obj=>{
      const ref = doc(collection(db, COL_CATEGORIAS));
      batch.set(ref, obj);
    });
    await batch.commit();
  }

  const snap = await getDocs(query(
    collection(db, COL_CATEGORIAS),
    where("tipo","==","despesa"),
    orderBy("nome")
  ));

  if(els.filtroCategoria){
    const opts = ['<option value="">Todas</option>']
      .concat(snap.docs.map(d=>`<option value="${d.id}">${d.data().nome}</option>`));
    els.filtroCategoria.innerHTML = opts.join("");
  }
  if(els.categoria){
    els.categoria.innerHTML = snap.docs.map(d=>`<option value="${d.id}">${d.data().nome}</option>`).join("");
  }
}

// ===== CRUD: lançamentos (despesa) =====
async function salvarLancamento(){
  const descricao = (els.descricao?.value||"").trim();
  const categoriaId = els.categoria?.value||"";
  const valor = Number(els.valor?.value||0);
  const data = els.data?.value||"";
  const tipo = "despesa";
  const formaPgto = (els.formaPgto?.value||"").trim();
  const status = els.status?.value||"a_pagar";
  const recorrencia = els.recorrencia?.value||"";

  if(!descricao || !categoriaId || !valor || !data){
    alert("Preencha Descrição, Categoria, Valor e Data.");
    return;
  }

  const catDoc = await getDoc(doc(db, COL_CATEGORIAS, categoriaId));
  const categoriaNome = catDoc.exists() ? (catDoc.data().nome||"") : "";

  const base = {
    descricao, categoriaId, categoriaNome,
    valor, data, tipo, formaPgto,
    status, criadoEm: Timestamp.now().toDate().toISOString()
  };

  const batch = writeBatch(db);
  batch.set(doc(collection(db, COL_LANCAMENTOS)), base);

  if(recorrencia === "mensal"){
    for(let i=1;i<12;i++){
      batch.set(doc(collection(db, COL_LANCAMENTOS)), { ...base, data: addMonths(base.data, i) });
    }
  }

  await batch.commit();

  // limpa campos
  if(els.descricao) els.descricao.value="";
  if(els.valor) els.valor.value="";
  if(els.formaPgto) els.formaPgto.value="";
  if(els.status) els.status.value="a_pagar";
  if(els.recorrencia) els.recorrencia.value="";
  if(els.data) els.data.value="";

  await refreshAll();
  closeModal();
  alert("Despesa(s) salva(s) com sucesso!");
}

async function marcarPago(id){
  await updateDoc(doc(db, COL_LANCAMENTOS, id), {
    status:"pago",
    pagoEm: Timestamp.now().toDate().toISOString()
  });
  await refreshAll();
}

async function excluirLancamento(id){
  await deleteDoc(doc(db, COL_LANCAMENTOS, id));
  await refreshAll();
}

function getPeriodo(){
  const iniYM = els.mesInicio?.value||"";
  const fimYM = els.mesFim?.value||iniYM||"";
  const [ini] = monthRangeStr(iniYM);
  const [, fim] = monthRangeStr(fimYM);
  return { ini, fim };
}

async function fetchLancamentos(){
  const { ini, fim } = getPeriodo();
  let qy = query(
    collection(db, COL_LANCAMENTOS),
    where("data", ">=", ini),
    where("data", "<=", fim),
    where("tipo", "==", "despesa"),
    orderBy("data","asc")
  );

  const st = els.filtroStatus?.value||"";
  const cat = els.filtroCategoria?.value||"";
  if(st){ qy = query(qy, where("status","==", st)); }
  if(cat){ qy = query(qy, where("categoriaId","==", cat)); }

  const snap = await getDocs(qy);
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}

async function refreshAll(){
  const data = await fetchLancamentos();
  renderTabela(data);
  renderTotais(data);
}

function renderTabela(items){
  if(!els.tbody) return;
  els.tbody.innerHTML = items.map(it=>{
    const pill = it.status === "pago"
      ? '<span class="status-pill pill-pago">pago</span>'
      : '<span class="status-pill pill-apagar">a pagar</span>';
    return `<tr>
      <td>${it.data}</td>
      <td>${it.descricao}</td>
      <td>${it.categoriaNome||"-"}</td>
      <td>despesa</td>
      <td>${fmtMoney(it.valor)}</td>
      <td>${pill}</td>
      <td>
        ${it.status!=="pago" ? `<button data-id="${it.id}" class="btn-pagar">Marcar pago</button>` : ""}
        <button data-id="${it.id}" class="btn-excluir">Excluir</button>
      </td>
    </tr>`;
  }).join("");

  els.tbody.querySelectorAll(".btn-pagar").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      marcarPago(id);
    });
  });

  els.tbody.querySelectorAll(".btn-excluir").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.getAttribute("data-id");
      if (confirm("Excluir esta despesa?")) excluirLancamento(id);
    });
  });
}

function renderTotais(items){
  if(!els.totais) return;
  const total = items.reduce((s,it)=>s+Number(it.valor||0),0);
  const aPagar = items.filter(it=>it.status!=="pago").reduce((s,it)=>s+Number(it.valor||0),0);
  const pagos = total - aPagar;
  els.totais.innerHTML = `
    <div class="badge"><b>Total:</b> ${fmtMoney(total)}</div>
    <div class="badge"><b>Pago:</b> ${fmtMoney(pagos)}</div>
    <div class="badge"><b>A pagar:</b> ${fmtMoney(aPagar)}</div>
  `;
}

// start
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", ()=>boot().catch(console.error));
}else{
  boot().catch(console.error);
}
