// FINANCEIRO.JS — Firebase v10.x
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc,
  query, where, orderBy, writeBatch, updateDoc, deleteDoc,
  Timestamp
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

const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ===== helpers =====
const $ = (id) => document.getElementById(id);
const els = {
  // filtros
  totais: $("totais"),
  filtroStatus: $("filtroStatus"),
  filtroTipo: $("filtroTipo"),
  filtroCategoria: $("filtroCategoria"),
  mesInicio: $("mesInicio"),
  mesFim: $("mesFim"),
  btnAplicarFiltros: $("btnAplicarFiltros"),

  // modal lançamento
  modal: $("modalNovo"),
  modalBackdrop: $("modalBackdrop"),
  btnAbrirModal: $("btnAbrirModal"),
  btnCancelarModal: $("btnCancelarModal"),
  btnSalvar: $("btnSalvar"),
  descricao: $("descricao"),
  categoria: $("categoria"),
  valor: $("valor"),
  data: $("data"),
  tipo: $("tipo"),
  formaPgto: $("formaPgto"),
  status: $("status"),
  recorrencia: $("recorrencia"),
  btnEditarCategorias: $("btnEditarCategorias"),

  // lista
  tbody: $("tbody"),

  // modal categorias
  modalCategorias: $("modalCategorias"),
  catBackdrop: $("catBackdrop"),
  listaCategorias: $("listaCategorias"),
  novaCategoriaNome: $("novaCategoriaNome"),
  btnAddCategoria: $("btnAddCategoria"),
  btnFecharCategorias: $("btnFecharCategorias"),
};

const COL_CATEGORIAS   = "categorias";
const COL_LANCAMENTOS  = "lancamentos";

function fmtMoney(n){ return (Number(n)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }
function ymd(d){ const x=new Date(d); const m=String(x.getMonth()+1).padStart(2,"0"); const dd=String(x.getDate()).padStart(2,"0"); return `${x.getFullYear()}-${m}-${dd}`; }
function monthRangeStr(ym){ const [y,m]=ym.split("-").map(Number); return [ymd(new Date(y,m-1,1)), ymd(new Date(y,m,0))]; }
function addMonths(dateStr,n){ const d=new Date(dateStr); d.setMonth(d.getMonth()+n); return ymd(d); }

// ===== modal controls (genérico) =====
function openModal(node){
  node?.removeAttribute("inert");
  node?.classList.add("is-open");
}
function closeModal(node){
  if (document.activeElement && node?.contains(document.activeElement)) {
    document.activeElement.blur();
  }
  node?.setAttribute("inert","");
  node?.classList.remove("is-open");
}

// ===== boot =====
async function boot(){
  setupDefaults();
  await seedCategoriasIfEmpty();
  await populateCategoriasSelect();

  onAuthStateChanged(auth, (user)=>{
    if(!user){
      try{ window.location.href = "index.html"; }catch(e){}
      return;
    }
    refreshAll();
  });

  // filtros
  els.btnAplicarFiltros?.addEventListener("click", ()=>refreshAll());

  // modal lançamento
  els.btnAbrirModal?.addEventListener("click", ()=>{ openModal(els.modal); setTimeout(()=>els.descricao?.focus(), 10); });
  els.btnCancelarModal?.addEventListener("click", ()=>closeModal(els.modal));
  els.modalBackdrop?.addEventListener("click", ()=>closeModal(els.modal));
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && els.modal?.classList.contains("is-open")) closeModal(els.modal); });
  els.btnSalvar?.addEventListener("click", ()=>salvarLancamento());

  // modal categorias
  els.btnEditarCategorias?.addEventListener("click", async ()=>{
    await renderCategoriasManager();
    openModal(els.modalCategorias);
    setTimeout(()=>els.novaCategoriaNome?.focus(), 10);
  });
  els.btnFecharCategorias?.addEventListener("click", ()=>closeModal(els.modalCategorias));
  els.catBackdrop?.addEventListener("click", ()=>closeModal(els.modalCategorias));
  document.addEventListener("keydown", (e)=>{ if(e.key==="Escape" && els.modalCategorias?.classList.contains("is-open")) closeModal(els.modalCategorias); });
  els.btnAddCategoria?.addEventListener("click", ()=>addCategoria());
}

function setupDefaults(){
  const now = new Date();
  const firstOfCurrent = new Date(now.getFullYear(), now.getMonth(), 1);

  const start = new Date(firstOfCurrent); // mês anterior
  start.setMonth(start.getMonth() - 1);

  const end = new Date(firstOfCurrent);   // mês atual + 3
  end.setMonth(end.getMonth() + 3);

  const fmtMonth = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

  if (els.mesInicio) els.mesInicio.value = fmtMonth(start);
  if (els.mesFim)    els.mesFim.value    = fmtMonth(end);

  if (els.filtroTipo) els.filtroTipo.value = "despesa";
  if (els.tipo)       els.tipo.value       = "despesa";
}


// ===== categorias =====
async function seedCategoriasIfEmpty(){
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
}
async function getCategoriasDespesa(){
  const snap = await getDocs(query(
    collection(db, COL_CATEGORIAS),
    where("tipo","==","despesa"),
    orderBy("nome")
  ));
  return snap.docs.map(d=>({ id:d.id, ...d.data() }));
}
async function populateCategoriasSelect(){
  const list = await getCategoriasDespesa();
  if(els.filtroCategoria){
    const opts = ['<option value="">Todas</option>']
      .concat(list.map(d=>`<option value="${d.id}">${d.nome}</option>`));
    els.filtroCategoria.innerHTML = opts.join("");
  }
  if(els.categoria){
    els.categoria.innerHTML = list.map(d=>`<option value="${d.id}">${d.nome}</option>`).join("");
  }
}

async function renderCategoriasManager(){
  const list = await getCategoriasDespesa();
  if(!els.listaCategorias) return;

  els.listaCategorias.innerHTML = list.length
    ? list.map(c => `
      <div class="cat-row" data-id="${c.id}">
        <input class="cat-nome" value="${c.nome}"/>
        <button type="button" class="btn-salvar-cat" data-id="${c.id}">Salvar</button>
        <button type="button" class="btn-excluir-cat" data-id="${c.id}">Excluir</button>
      </div>
    `).join("")
    : `<div class="muted">Nenhuma categoria cadastrada.</div>`;

  // Wire per-row buttons
  els.listaCategorias.querySelectorAll(".btn-salvar-cat").forEach(b=>{
    b.addEventListener("click", async ()=>{
      const id = b.getAttribute("data-id");
      const row = els.listaCategorias.querySelector(`.cat-row[data-id="${id}"]`);
      const nome = row.querySelector(".cat-nome").value.trim();
      if(!nome) return;
      await updateDoc(doc(db, COL_CATEGORIAS, id), { nome });
      await populateCategoriasSelect();
      await renderCategoriasManager();
    });
  });
  els.listaCategorias.querySelectorAll(".btn-excluir-cat").forEach(b=>{
    b.addEventListener("click", async ()=>{
      const id = b.getAttribute("data-id");
      if(!confirm("Excluir esta categoria?")) return;
      await deleteDoc(doc(db, COL_CATEGORIAS, id));
      await populateCategoriasSelect();
      await renderCategoriasManager();
    });
  });
}

async function addCategoria(){
  const nome = (els.novaCategoriaNome?.value||"").trim();
  if(!nome) return;
  await addDoc(collection(db, COL_CATEGORIAS), { nome, tipo:"despesa" });
  els.novaCategoriaNome.value = "";
  await populateCategoriasSelect();
  await renderCategoriasManager();
}

// ===== CRUD: lançamentos =====
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
  closeModal(els.modal);
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
