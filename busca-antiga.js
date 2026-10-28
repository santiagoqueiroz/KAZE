// Campo de busca de cliente para as páginas antigas (no lugar das listas que liam todos os clientes).
// Com o campo vazio mostra os últimos clientes pesquisados neste aparelho.
import { db } from "./firebase-config.js";
import { esc } from "./seguranca.js";
import { mensagemErro } from "./erros.js";
import { consultarClientes, podeBuscar, termoDe, lerRecentes, lembrarCliente, guardarLido } from "./busca-clientes.js";
import { collection, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CSS = `
.kz-busca-campo { width: 100%; box-sizing: border-box; padding: 10px 12px; font: inherit; font-size: 16px; border: 1px solid #bbb; border-radius: 8px; margin: 6px 0; }
.kz-busca-lista { display: grid; gap: 4px; margin-bottom: 12px; }
.kz-busca-lista button { display: block; width: 100%; text-align: left; padding: 8px 12px; border: 1px solid #ddd; border-radius: 8px; background: #fff; color: #222; font: inherit; cursor: pointer; }
.kz-busca-lista button:hover, .kz-busca-lista button.kz-escolhido { border-color: #915c83; background: #f6eef4; }
.kz-busca-lista small { display: block; color: #666; }
.kz-busca-aviso { color: #666; font-size: 14px; padding: 4px 2px; }`;
function estilo() {
  if (document.getElementById("kz-busca-css")) return;
  const s = document.createElement("style");
  s.id = "kz-busca-css"; s.textContent = CSS;
  document.head.appendChild(s);
}
export const detalheCliente = (c) => [c.telefone, [c.bairro, c.cidade].filter(Boolean).join(", ")].filter(Boolean).join(" · ");

// Monta o campo e a lista dentro de "container". aoEscolher(cliente) recebe o cadastro completo.
// aoListar(clientes), se passado, recebe cada lista mostrada (para páginas que desenham a própria tabela).
export function caixaBuscaCliente(container, aoEscolher, { aoListar = null } = {}) {
  estilo();
  container.innerHTML = '<input type="search" class="kz-busca-campo" placeholder="Buscar cliente: nome, telefone ou CPF/CNPJ" aria-label="Buscar cliente" autocomplete="off"><div class="kz-busca-lista" aria-live="polite"></div>';
  const campo = container.querySelector("input"), lista = container.querySelector(".kz-busca-lista");
  let pedido = 0, espera = null, escolhido = null;
  const aviso = (t) => { lista.innerHTML = `<div class="kz-busca-aviso">${t}</div>`; if (aoListar) aoListar([]); };
  function mostrar(clientes, titulo = "", rodape = "") {
    if (aoListar) { aoListar(clientes); lista.innerHTML = titulo || rodape ? `<div class="kz-busca-aviso">${titulo || rodape}</div>` : ""; return; }
    lista.innerHTML = (titulo ? `<div class="kz-busca-aviso">${titulo}</div>` : "") + clientes.map((c) =>
      `<button type="button" data-id="${esc(c.id)}"${c.id === escolhido ? ' class="kz-escolhido"' : ""}>${esc(c.nome || "(sem nome)")}<small>${esc(detalheCliente(c))}</small></button>`).join("") + (rodape ? `<div class="kz-busca-aviso">${rodape}</div>` : "");
    lista.querySelectorAll("button").forEach((b) => {
      b.onclick = () => {
        const c = clientes.find((x) => x.id === b.dataset.id);
        escolhido = c.id;
        lista.querySelectorAll("button").forEach((x) => x.classList.toggle("kz-escolhido", x === b));
        lembrarCliente(c); guardarLido(c);
        aoEscolher(c);
      };
    });
  }
  async function vazio(n) {
    try {
      const r = await lerRecentes();
      if (n !== pedido) return;
      if (r.length) mostrar(r, "Últimos pesquisados neste aparelho:");
      else aviso("Digite o nome, o telefone ou o CPF/CNPJ do cliente.");
    } catch (e) { if (n === pedido) aviso("Digite o nome, o telefone ou o CPF/CNPJ do cliente."); }
  }
  campo.addEventListener("input", () => {
    clearTimeout(espera);
    const n = ++pedido, t = termoDe(campo.value);
    if (!t) return vazio(n);
    if (!podeBuscar(t)) return aviso("Continue digitando: pelo menos 2 letras ou 4 números.");
    aviso("Buscando…");
    espera = setTimeout(async () => {
      try {
        const r = await consultarClientes(campo.value);
        if (n !== pedido) return;
        if (!r.clientes.length) return aviso(`Nenhum cliente encontrado para "${esc(campo.value.trim())}".`);
        mostrar(r.clientes, "", r.cheia ? "Há mais clientes com esse nome. Digite mais para achar o certo." : "");
      } catch (e) {
        console.error(e);
        if (n === pedido) aviso("Não foi possível buscar. " + esc(mensagemErro(e)));
      }
    }, 400);
  });
  vazio(pedido);
  return { campo, recarregar: () => campo.dispatchEvent(new Event("input")) };
}

// Orçamentos para as páginas de consulta: os mais recentes ou os de um cliente
export async function orcamentosRecentes(n = 10) {
  const s = await getDocs(query(collection(db, "orcamentos"), orderBy("dataHora", "desc"), limit(n)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function orcamentosDoCliente(id) {
  const s = await getDocs(query(collection(db, "orcamentos"), where("clienteId", "==", id)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.dataHora || "").localeCompare(String(a.dataHora || "")));
}
// Preenche um <select> de orçamentos (rótulo: cliente - data hora)
export function preencherOrcamentos(select, orcamentos, primeira) {
  select.innerHTML = "";
  select.append(new Option(primeira, ""));
  for (const o of orcamentos) {
    const d = new Date(o.dataHora), nome = o.cliente?.nome || "Sem nome";
    const quando = isNaN(d) ? "sem data" : `${d.toLocaleDateString("pt-BR")} ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    select.append(new Option(`${nome} - ${quando}`, o.id));
  }
}
