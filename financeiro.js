// ===== FINANCEIRO.JS =====

// Espera Firebase (do main.js) já inicializado.
// Se seu main.js não expõe 'firebase' global, ajuste para usar app/db/auth exportados.

(function () {
  // Helpers de Firestore
  const db = firebase.firestore();
  const auth = firebase.auth();

  // Seletores
  const els = {
    totais: document.getElementById('totais'),
    filtroStatus: document.getElementById('filtroStatus'),
    filtroTipo: document.getElementById('filtroTipo'),
    filtroCategoria: document.getElementById('filtroCategoria'),
    mesInicio: document.getElementById('mesInicio'),
    mesFim: document.getElementById('mesFim'),
    btnAplicarFiltros: document.getElementById('btnAplicarFiltros'),
    descricao: document.getElementById('descricao'),
    categoria: document.getElementById('categoria'),
    valor: document.getElementById('valor'),
    data: document.getElementById('data'),
    tipo: document.getElementById('tipo'),
    formaPgto: document.getElementById('formaPgto'),
    status: document.getElementById('status'),
    recorrencia: document.getElementById('recorrencia'),
    btnSalvar: document.getElementById('btnSalvar'),
    tbody: document.getElementById('tbody'),
    chartCategorias: document.getElementById('chartCategorias'),
    chartMensal: document.getElementById('chartMensal'),
  };

  // Autorização mínima: exige login
  auth.onAuthStateChanged((user) => {
    if (!user) {
      alert('Faça login para acessar o Financeiro.');
      window.location.href = 'index.html';
      return;
    }
    // Carrega dados iniciais
    setupDefaults();
    loadCategorias().then(() => {
      refreshAll(); // tabela, totais, calendário, gráficos
    });
  });

  // ---------- Coleções ----------
  const COL_CATEGORIAS = 'categorias';    // { nome, tipo: 'despesa'|'receita' }
  const COL_LANCAMENTOS = 'lancamentos';  // { data (YYYY-MM-DD), descricao, categoriaId, categoriaNome, tipo, valor, status, formaPgto, pagoEm? }

  // ---------- Util ----------
  function fmtMoney(n) {
    return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function ymd(date) {
    const d = new Date(date);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  function monthRangeStr(ym) {
    // ym = '2025-09'
    const [y, m] = ym.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return [ymd(first), ymd(last)];
  }
  function addMonths(dateStr, n) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + n);
    return ymd(d);
  }

  // ---------- Defaults filtros ----------
  function setupDefaults() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
    els.mesInicio.value = ym;
    els.mesFim.value = ym;

    els.btnAplicarFiltros.addEventListener('click', refreshAll);
    els.btnSalvar.addEventListener('click', salvarLancamento);
  }

  // ---------- Categorias ----------
  async function loadCategorias() {
    // Cria padrões se tabela vazia
    const snap = await db.collection(COL_CATEGORIAS).limit(1).get();
    if (snap.empty) {
      const defaults = [
        { nome: 'Salários', tipo: 'despesa' },
        { nome: 'Aluguel', tipo: 'despesa' },
        { nome: 'Energia', tipo: 'despesa' },
        { nome: 'Fornecedores', tipo: 'despesa' },
        { nome: 'Vendas', tipo: 'receita' },
        { nome: 'Serviços', tipo: 'receita' }
      ];
      const batch = db.batch();
      defaults.forEach(d => {
        const ref = db.collection(COL_CATEGORIAS).doc();
        batch.set(ref, d);
      });
      await batch.commit();
    }

    // Popular selects de categoria (filtro e cadastro)
    const all = await db.collection(COL_CATEGORIAS).orderBy('nome').get();
    const opts = ['<option value="">Todas</option>']
      .concat(all.docs.map(doc => `<option value="${doc.id}">${doc.data().nome}</option>`));
    els.filtroCategoria.innerHTML = opts.join('');
    const opts2 = all.docs.map(doc => `<option value="${doc.id}">${doc.data().nome}</option>`);
    els.categoria.innerHTML = opts2.join('');
  }

  // ---------- CRUD Lançamentos ----------
  async function salvarLancamento() {
    const descricao = els.descricao.value.trim();
    const categoriaId = els.categoria.value;
    const valor = Number(els.valor.value);
    const data = els.data.value;
    const tipo = els.tipo.value;
    const formaPgto = els.formaPgto.value.trim();
    const status = els.status.value;
    const recorrencia = els.recorrencia.value;

    if (!descricao || !categoriaId || !valor || !data) {
      alert('Preencha Descrição, Categoria, Valor e Data.');
      return;
    }

    // pegar nome/tipo da categoria
    const catDoc = await db.collection(COL_CATEGORIAS).doc(categoriaId).get();
    const categoriaNome = catDoc.exists ? catDoc.data().nome : '';

    const base = {
      descricao, categoriaId, categoriaNome,
      valor, data, tipo, formaPgto,
      status, criadoEm: new Date().toISOString()
    };

    const batch = db.batch();
    // lançamento principal
    batch.set(db.collection(COL_LANCAMENTOS).doc(), base);

    // recorrência mensal simples (gera mais 11 meses)
    if (recorrencia === 'mensal') {
      for (let i = 1; i < 12; i++) {
        const docRef = db.collection(COL_LANCAMENTOS).doc();
        batch.set(docRef, { ...base, data: addMonths(base.data, i) });
      }
    }

    await batch.commit();

    // limpa form
    els.descricao.value = '';
    els.valor.value = '';
    els.formaPgto.value = '';
    els.status.value = 'a_pagar';
    els.recorrencia.value = '';
    // mantém categoria, data, tipo

    await refreshAll();
    alert('Lançamento(s) salvo(s) com sucesso!');
  }

  async function marcarPago(id) {
    await db.collection(COL_LANCAMENTOS).doc(id).update({
      status: 'pago',
      pagoEm: new Date().toISOString()
    });
    await refreshAll();
  }

  // ---------- Query + render ----------
  function getPeriodo() {
    const { value: iniYM } = els.mesInicio;
    const { value: fimYM } = els.mesFim;
    const [ini, ] = monthRangeStr(iniYM);
    const [, fim] = monthRangeStr(fimYM);
    return { ini, fim };
  }

  async function fetchLancamentos() {
    const { ini, fim } = getPeriodo();
    let q = db.collection(COL_LANCAMENTOS)
      .where('data', '>=', ini)
      .where('data', '<=', fim);

    const st = els.filtroStatus.value;
    const tp = els.filtroTipo.value;
    const cat = els.filtroCategoria.value;

    if (st) q = q.where('status', '==', st);
    if (tp) q = q.where('tipo', '==', tp);
    if (cat) q = q.where('categoriaId', '==', cat);

    const snap = await q.orderBy('data', 'asc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function refreshAll() {
    const data = await fetchLancamentos();
    renderTabela(data);
    renderTotais(data);
    renderCalendar(data);
    renderCharts(data);
  }

  function renderTabela(items) {
    els.tbody.innerHTML = items.map(it => {
      const pill = it.status === 'pago'
        ? `<span class="status-pill pill-pago">pago</span>`
        : `<span class="status-pill pill-apagar">a pagar</span>`;
      return `
        <tr>
          <td>${it.data}</td>
          <td>${it.descricao}</td>
          <td>${it.categoriaNome || '-'}</td>
          <td>${it.tipo}</td>
          <td>${fmtMoney(it.valor)}</td>
          <td>${pill}</td>
          <td class="row-actions">
            ${it.status !== 'pago' ? `<button data-id="${it.id}" class="btn-pagar">Marcar pago</button>` : ''}
          </td>
        </tr>
      `;
    }).join('');

    // bind ações
    [...document.querySelectorAll('.btn-pagar')].forEach(btn => {
      btn.addEventListener('click', () => marcarPago(btn.getAttribute('data-id')));
    });
  }

  function renderTotais(items) {
    const totalDesp = items.filter(i => i.tipo === 'despesa').reduce((s,i) => s + Number(i.valor||0), 0);
    const totalRec  = items.filter(i => i.tipo === 'receita').reduce((s,i) => s + Number(i.valor||0), 0);
    const totalApagar = items.filter(i => i.status === 'a_pagar' && i.tipo === 'despesa').reduce((s,i)=>s+Number(i.valor||0),0);
    const saldo = totalRec - totalDesp;

    els.totais.innerHTML = `
      <span class="badge">Receitas: <b>${fmtMoney(totalRec)}</b></span>
      <span class="badge">Despesas: <b>${fmtMoney(totalDesp)}</b></span>
      <span class="badge">A pagar (desp.): <b>${fmtMoney(totalApagar)}</b></span>
      <span class="badge">Saldo: <b>${fmtMoney(saldo)}</b></span>
    `;
  }

  // ---------- Calendário ----------
  let calendar;
  function renderCalendar(items) {
    const events = items.map(i => ({
      title: `${i.descricao} — ${fmtMoney(i.valor)}`,
      start: i.data,
      color: i.status === 'pago' ? '#e6ffed' : (new Date(i.data) < new Date() ? '#ffe6e6' : undefined)
    }));

    // cria/atualiza
    const el = document.getElementById('calendar');
    if (!calendar) {
      calendar = new FullCalendar.Calendar(el, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
        events,
      });
      calendar.render();
    } else {
      calendar.removeAllEvents();
      calendar.addEventSource(events);
    }
  }

  // ---------- Gráficos ----------
  let chartCat, chartMensal;
  function groupBy(arr, keyFn) {
    return arr.reduce((acc, it) => {
      const k = keyFn(it);
      acc[k] = (acc[k] || 0) + Number(it.valor||0);
      return acc;
    }, {});
  }
  function renderCharts(items) {
    // Pizza por categoria (só despesas)
    const despesas = items.filter(i => i.tipo === 'despesa');
    const porCat = groupBy(despesas, it => it.categoriaNome || 'Sem categoria');

    const catLabels = Object.keys(porCat);
    const catData = Object.values(porCat);

    if (chartCat) chartCat.destroy();
    chartCat = new Chart(els.chartCategorias, {
      type: 'pie',
      data: { labels: catLabels, datasets: [{ data: catData }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    });

    // Barras Receitas x Despesas por mês (YYYY-MM)
    function ymStr(d){ return d.data.slice(0,7); }
    const somaDespMes = groupBy(despesas, ymStr);
    const receitas = items.filter(i => i.tipo === 'receita');
    const somaRecMes = groupBy(receitas, ymStr);
    const meses = Array.from(new Set([...Object.keys(somaDespMes), ...Object.keys(somaRecMes)])).sort();

    const dadosDes = meses.map(m => somaDespMes[m] || 0);
    const dadosRec = meses.map(m => somaRecMes[m] || 0);

    if (chartMensal) chartMensal.destroy();
    chartMensal = new Chart(els.chartMensal, {
      type: 'bar',
      data: {
        labels: meses,
        datasets: [
          { label: 'Despesas', data: dadosDes },
          { label: 'Receitas', data: dadosRec }
        ]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });
  }

})();
