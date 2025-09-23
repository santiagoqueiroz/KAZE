// FINANCEIRO.JS — somente DESPESAS
// Compatível com Firebase *compat* carregado via <script src="...-compat.js">
// Não mexe no main.js. Este arquivo apenas aguarda o Firebase inicializar.

(function(){
  // ===== util para aguardar o Firebase default app estar pronto =====
  function waitForFirebaseApp(maxMs = 7000){
    return new Promise((resolve, reject)=>{
      const started = Date.now();
      const t = setInterval(()=>{
        const ok = typeof window !== 'undefined'
          && window.firebase
          && firebase.apps && firebase.apps.length > 0;
        if(ok){ clearInterval(t); resolve(firebase.app()); }
        else if(Date.now() - started > maxMs){
          clearInterval(t);
          reject(new Error('[financeiro.js] Firebase não inicializado (no-app). Verifique se firebase-app-compat.js foi carregado e se firebase.initializeApp(...) já rodou.'));
        }
      }, 120);
    });
  }

  // ===== helpers =====
  function fmtMoney(n){ return (Number(n)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
  function ymd(date){ const d=new Date(date); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${d.getFullYear()}-${m}-${day}`; }
  function monthRangeStr(ym){ const [y,m]=ym.split('-').map(Number); const first=new Date(y,m-1,1); const last=new Date(y,m,0); return [ymd(first), ymd(last)]; }
  function addMonths(dateStr,n){ const d=new Date(dateStr); d.setMonth(d.getMonth()+n); return ymd(d); }

  // ===== elementos =====
  const els = {
    totais: document.getElementById('totais'),
    filtroStatus: document.getElementById('filtroStatus'),
    filtroTipo: document.getElementById('filtroTipo'), // oculto, fixo "despesa"
    filtroCategoria: document.getElementById('filtroCategoria'),
    mesInicio: document.getElementById('mesInicio'),
    mesFim: document.getElementById('mesFim'),
    btnAplicarFiltros: document.getElementById('btnAplicarFiltros'),

    descricao: document.getElementById('descricao'),
    categoria: document.getElementById('categoria'),
    valor: document.getElementById('valor'),
    data: document.getElementById('data'),
    tipo: document.getElementById('tipo'), // hidden = 'despesa'
    formaPgto: document.getElementById('formaPgto'),
    status: document.getElementById('status'),
    recorrencia: document.getElementById('recorrencia'),
    btnSalvar: document.getElementById('btnSalvar'),

    tbody: document.getElementById('tbody'),
    chartCategorias: document.getElementById('chartCategorias'),
    chartMensal: document.getElementById('chartMensal'),
  };

  const COL_CATEGORIAS = 'categorias';
  const COL_LANCAMENTOS = 'lancamentos';

  // ===== fluxo principal =====
  async function boot(){
    const app = await waitForFirebaseApp();
    const db = firebase.firestore(app);
    const auth = firebase.auth(app);

    setupDefaults();
    await loadCategorias(db);

    auth.onAuthStateChanged((user)=>{
      if(!user){
        console.warn('[financeiro.js] Usuário não autenticado. Redirecionando para login.');
        try{ window.location.href = 'index.html'; }catch(e){}
        return;
      }
      refreshAll(db);
    });

    // ações
    els.btnAplicarFiltros && els.btnAplicarFiltros.addEventListener('click', ()=>refreshAll(db));
    els.btnSalvar && els.btnSalvar.addEventListener('click', ()=>salvarLancamento(db));
  }

  function setupDefaults(){
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    if(els.mesInicio) els.mesInicio.value = ym;
    if(els.mesFim) els.mesFim.value = ym;
    if(els.filtroTipo) els.filtroTipo.value = 'despesa';
    if(els.tipo) els.tipo.value = 'despesa';
  }

  // ===== categorias (somente tipo: 'despesa') =====
  async function loadCategorias(db){
    // cria defaults se estiver vazio
    const chk = await db.collection(COL_CATEGORIAS).limit(1).get();
    if(chk.empty){
      const defaults = [
        { nome:'Aluguel', tipo:'despesa' },
        { nome:'Energia', tipo:'despesa' },
        { nome:'Água', tipo:'despesa' },
        { nome:'Fornecedores', tipo:'despesa' },
        { nome:'Impostos', tipo:'despesa' },
      ];
      const batch = db.batch();
      defaults.forEach(d=>{ batch.set(db.collection(COL_CATEGORIAS).doc(), d); });
      await batch.commit();
    }

    const snap = await db.collection(COL_CATEGORIAS)
      .where('tipo','==','despesa')
      .orderBy('nome')
      .get();

    if(els.filtroCategoria){
      const opts = ['<option value="">Todas</option>']
        .concat(snap.docs.map(doc=>`<option value="${doc.id}">${doc.data().nome}</option>`));
      els.filtroCategoria.innerHTML = opts.join('');
    }
    if(els.categoria){
      els.categoria.innerHTML = snap.docs.map(doc=>`<option value="${doc.id}">${doc.data().nome}</option>`).join('');
    }
  }

  // ===== CRUD: lançamentos (somente DESPESA) =====
  async function salvarLancamento(db){
    const descricao = (els.descricao?.value||'').trim();
    const categoriaId = els.categoria?.value||'';
    const valor = Number(els.valor?.value||0);
    const data = els.data?.value||'';
    const tipo = 'despesa';
    const formaPgto = (els.formaPgto?.value||'').trim();
    const status = els.status?.value||'a_pagar';
    const recorrencia = els.recorrencia?.value||'';

    if(!descricao || !categoriaId || !valor || !data){
      alert('Preencha Descrição, Categoria, Valor e Data.');
      return;
    }

    const catDoc = await db.collection(COL_CATEGORIAS).doc(categoriaId).get();
    const categoriaNome = catDoc.exists ? (catDoc.data().nome||'') : '';

    const base = {
      descricao, categoriaId, categoriaNome,
      valor, data, tipo, formaPgto,
      status, criadoEm: new Date().toISOString()
    };

    const batch = db.batch();
    batch.set(db.collection(COL_LANCAMENTOS).doc(), base);

    if(recorrencia === 'mensal'){
      for(let i=1;i<12;i++){
        batch.set(db.collection(COL_LANCAMENTOS).doc(), { ...base, data: addMonths(base.data, i) });
      }
    }

    await batch.commit();

    // limpa
    if(els.descricao) els.descricao.value='';
    if(els.valor) els.valor.value='';
    if(els.formaPgto) els.formaPgto.value='';
    if(els.status) els.status.value='a_pagar';
    if(els.recorrencia) els.recorrencia.value='';

    await refreshAll(db);
    alert('Despesa(s) salva(s) com sucesso!');
  }

  async function marcarPago(db,id){
    await db.collection(COL_LANCAMENTOS).doc(id).update({
      status:'pago',
      pagoEm:new Date().toISOString()
    });
    await refreshAll(db);
  }

  function getPeriodo(){
    const iniYM = els.mesInicio?.value||'';
    const fimYM = els.mesFim?.value||iniYM||'';
    const [ini] = monthRangeStr(iniYM);
    const [, fim] = monthRangeStr(fimYM);
    return { ini, fim };
  }

  async function fetchLancamentos(db){
    const { ini, fim } = getPeriodo();
    let q = db.collection(COL_LANCAMENTOS)
      .where('data','>=',ini)
      .where('data','<=',fim)
      .where('tipo','==','despesa');

    const st = els.filtroStatus?.value||'';
    const cat = els.filtroCategoria?.value||'';
    if(st) q = q.where('status','==',st);
    if(cat) q = q.where('categoriaId','==',cat);

    const snap = await q.orderBy('data','asc').get();
    return snap.docs.map(d=>({ id:d.id, ...d.data() }));
  }

  async function refreshAll(db){
    const data = await fetchLancamentos(db);
    renderTabela(db, data);
    renderTotais(data);
    // gráficos/calendário podem ser implementados depois sem afetar o cadastro
  }

  function renderTabela(db, items){
    if(!els.tbody) return;
    els.tbody.innerHTML = items.map(it=>{
      const pill = it.status === 'pago'
        ? '<span class="status-pill pill-pago">pago</span>'
        : '<span class="status-pill pill-apagar">a pagar</span>';
      return `<tr>
        <td>${it.data}</td>
        <td>${it.descricao}</td>
        <td>${it.categoriaNome||'-'}</td>
        <td>despesa</td>
        <td>${fmtMoney(it.valor)}</td>
        <td>${pill}</td>
        <td>
          ${it.status!=="pago" ? `<button data-id="${it.id}" class="btn-pagar">Marcar pago</button>` : ''}
        </td>
      </tr>`;
    }).join('');

    // bind botões pagar
    els.tbody.querySelectorAll('.btn-pagar').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        marcarPago(db, id);
      });
    });
  }

  function renderTotais(items){
    if(!els.totais) return;
    const total = items.reduce((s,it)=>s+Number(it.valor||0),0);
    const aPagar = items.filter(it=>it.status!=='pago').reduce((s,it)=>s+Number(it.valor||0),0);
    const pagos = total - aPagar;
    els.totais.innerHTML = `
      <div class="badge"><b>Total:</b> ${fmtMoney(total)}</div>
      <div class="badge"><b>Pago:</b> ${fmtMoney(pagos)}</div>
      <div class="badge"><b>A pagar:</b> ${fmtMoney(aPagar)}</div>
    `;
  }

  // inicialização
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>{
      boot().catch(err=>console.error(err));
    });
  } else {
    boot().catch(err=>console.error(err));
  }
})();
