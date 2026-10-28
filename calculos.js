// Cálculo do preço de um item do orçamento.
// São as mesmas fórmulas de cortina.js, blackout.js, cortina+bk.js, cortina+forro.js e persianas.js,
// sem depender da tela: recebe as medidas, as tabelas de preço e as regras, e devolve o valor e a conta detalhada.

export const TIPOS = {
  cortina: "Cortina",
  blackout: "Blackout",
  cortinaBK: "Cortina + Blackout",
  cortinaForro: "Cortina + Forro",
  persiana: "Persiana",
  avulso: "Item avulso"
};

const arred = (v) => Math.round(v * 100) / 100;
const ceiling = (v, passo) => Math.ceil(v / passo) * passo;
const fmtReal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const fmtM = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const real = (v) => fmtReal.format(v);
const m = (v) => fmtM.format(v);
const curto = (v) => m(v).replace(/,00$/, "").replace(/(,\d)0$/, "$1");
const tiras = (n) => `${curto(n)} ${n === 1 ? "tira" : "tiras"}`;

// Erro de cadastro: falta um preço na página Preços
function faltaPreco(nome) {
  return Object.assign(new Error(`Falta o preço de "${nome}" na página Preços.`), { faltaPreco: nome });
}
function preco(tabela, nome) {
  const v = Number(tabela?.[nome]);
  if (!Number.isFinite(v)) throw faltaPreco(nome);
  return v;
}

function calcTrilho(l, nome, t) {
  const p = (n) => preco(t.parametros, n);
  const precoTrilho = preco(t.trilhos, nome);
  // Igual ao sistema antigo: só vale para o nome escrito em maiúsculas, como na tabela de preços
  if (nome.includes("VARÃO SUÍÇO")) {
    const tubo = ceiling(l, 0.5);
    let sup = 2;
    if (l > 1.9 && l <= 3.5) sup = 3;
    else if (l > 3.5 && l <= 4.8) sup = 4;
    else if (l > 4.8) sup = 4 + Math.ceil((l - 4.8) / 1.5);
    return { label: `${nome}: ${m(tubo)} m + ${sup} suportes + 2 tampas`, valor: arred(tubo * precoTrilho + sup * p("SUPORTE") + 2 * p("TAMPA")) };
  }
  const metros = ceiling(l, 0.5);
  return { label: `${nome}: ${m(metros)} m × ${real(precoTrilho)}`, valor: arred(metros * precoTrilho) };
}

function partesCortina(e, t, avisos) {
  const { largura: l, altura: a } = e;
  const p = (n) => preco(t.parametros, n);
  const pt = preco(t.tecidos, e.tecido);
  const base = arred(l * 3.1 + 0.7);
  const div = e.tecido.toUpperCase().includes("VELUDO 1,40") ? 1.4 : 3;
  const nTiras = (base / div) % 1 < 0.4 ? Math.floor(base / div) : Math.ceil(base / div);
  const alturaTira = arred(a + 0.12 + e.barra);
  const metragem = a > 2.6 ? arred(nTiras * alturaTira) : base;
  const mult = a > 3.5 ? e.mult : 1;
  if (a > 2.6) avisos.push({ interno: true, texto: `Altura acima de 2,60 m: tecido calculado em ${tiras(nTiras)} de ${m(alturaTira)} m.` });
  if (mult !== 1) avisos.push({ interno: true, texto: `Altura acima de 3,50 m: barra multiplicada por ${curto(mult)}.` });
  const desl = Math.ceil((l / 0.1 + 1) * 2), kits = Math.ceil(l * 0.5);
  return {
    metragem, base, mult,
    linhas: [
      { label: `Tecido ${e.tecido}: ${m(metragem)} m × ${real(pt)}`, valor: arred(metragem * pt) },
      calcTrilho(l, e.trilho, t),
      { label: `Entretela: ${m(base)} m × ${real(p("ENTRETELA"))}`, valor: arred(base * p("ENTRETELA")) },
      { label: `Deslizante: ${desl} × ${real(p("DESLIZANTE"))}`, valor: arred(desl * p("DESLIZANTE")) },
      { label: `Terminal: 2 × ${real(p("TERMINAL"))}`, valor: arred(2 * p("TERMINAL")) },
      { label: `Costura: ${m(metragem)} m × ${real(p("COSTURA"))}`, valor: arred(metragem * p("COSTURA")) },
      { label: `Barra: ${m(base)} m × ${real(p("BARRA"))}${mult !== 1 ? " × " + curto(mult) : ""}`, valor: arred(base * p("BARRA") * mult) },
      { label: "Instalação", valor: p("INSTALAÇÃO") },
      { label: `Bucha e parafuso: ${kits} × ${real(p("BUCHA E PARAFUSO"))}`, valor: arred(kits * p("BUCHA E PARAFUSO")) }
    ]
  };
}

// Linhas marcadas "comum" saem quando o blackout vai junto com a cortina (já estão na cortina)
function linhasBlackout(e, t, avisos) {
  const { largura: l, altura: a } = e;
  const p = (n) => preco(t.parametros, n);
  const pt = preco(t.tecidosBK, e.bk);
  let base, qtd, nTiras = 1;
  const alturaFinal = arred(a + 0.10 + 0.15);
  if (a <= 2.8) { base = arred(l + 0.8); qtd = base; }
  else if (a <= 3.0) { base = arred(l + 0.8 + (a - 2.8) * 2); qtd = base; }
  else {
    const bruto = (l + 0.8) / 2.8, dec = bruto % 1;
    nTiras = dec <= 0.14 ? Math.floor(bruto) : dec <= 0.5 ? Math.floor(bruto) + 0.5 : Math.ceil(bruto);
    qtd = arred(alturaFinal * nTiras);
    base = arred(l + 0.8);
    avisos.push({ interno: true, texto: `Blackout acima de 3,00 m: ${tiras(nTiras)} de ${m(alturaFinal)} m.` });
  }
  const desl = Math.ceil(base / 0.08);
  return [
    { label: `Tecido ${e.bk}: ${m(qtd)} m × ${real(pt)}`, valor: arred(qtd * pt) },
    { ...calcTrilho(l, e.trilho, t), comum: true },
    { label: `Entretela BK: ${m(base)} m × ${real(p("ENTRETELA BK"))}`, valor: arred(base * p("ENTRETELA BK")) },
    { label: `Deslizante: ${desl} × ${real(p("DESLIZANTE"))}`, valor: arred(desl * p("DESLIZANTE")) },
    { label: `Terminal: 2 × ${real(p("TERMINAL"))}`, valor: arred(2 * p("TERMINAL")) },
    { label: `Costura: ${m(qtd)} m × ${real(p("COSTURA"))}`, valor: arred(qtd * p("COSTURA")) },
    { label: `Barra: ${m(base)} m × ${real(p("BARRA"))}`, valor: arred(base * p("BARRA")), comum: true },
    { label: "Instalação", valor: p("INSTALAÇÃO"), comum: true },
    { label: `Bucha e parafuso: ${Math.ceil(l)} × ${real(p("BUCHA E PARAFUSO"))}`, valor: arred(Math.ceil(l) * p("BUCHA E PARAFUSO")), comum: true }
  ];
}

// Custo → + 6% Simples → × markup → ÷ custo cartão.
// somaCrua: cortina + forro somava o custo sem arredondar no sistema antigo;
// mantido igual para os centavos baterem com os orçamentos já feitos.
function venda(grupos, regras, somaCrua = false) {
  const soma = grupos.flatMap((g) => g.linhas).reduce((s, x) => s + x.valor, 0);
  const custo = arred(soma), bruto = somaCrua ? soma : custo;
  const simples = arred(bruto * 0.06), base = arred(bruto + simples);
  const comMarkup = arred(base * regras.markup), unit = arred(comMarkup / regras.fatorVista);
  return {
    grupos, custo, unit,
    conta: [
      { label: "Custo (soma)", valor: custo, soma: true },
      { label: "Simples Nacional 6%", valor: simples },
      { label: `Markup × ${curto(regras.markup)}`, valor: comMarkup },
      { label: `Ajuste cartão ÷ ${regras.fatorVista.toLocaleString("pt-BR")}`, valor: unit }
    ]
  };
}

export function nomeItem(e) {
  const corpo = {
    cortina: () => `Cortina ${e.tecido} - ${e.trilho}`,
    blackout: () => `Blackout ${e.bk} - ${e.trilho}`,
    cortinaBK: () => `Cortina ${e.tecido} + Blackout ${e.bk} - ${e.trilho}`,
    cortinaForro: () => `Cortina ${e.tecido} + Forro ${e.forro} - ${e.trilho}`,
    persiana: () => `Persiana ${e.persiana}`,
    avulso: () => e.descricao
  }[e.tipo]();
  return [e.ambiente, corpo].filter(Boolean).join(" - ");
}

// e: { tipo, ambiente, descricao, largura, altura, qtd, desconto, tecido, bk, forro, trilho, persiana, valor, barra, mult }
// t: { tecidos, tecidosBK, trilhos, parametros, persianas } (nome → preço)
// regras: { markup, fatorVista }
export function calcularItem(e, t, regras) {
  const avisos = [];
  let r;
  if (e.tipo === "cortina") r = venda([{ titulo: "", linhas: partesCortina(e, t, avisos).linhas }], regras);
  else if (e.tipo === "blackout") r = venda([{ titulo: "", linhas: linhasBlackout(e, t, avisos) }], regras);
  else if (e.tipo === "cortinaBK") {
    const c = partesCortina(e, t, avisos);
    r = venda([
      { titulo: "Cortina", linhas: c.linhas },
      { titulo: "Blackout (sem trilho, barra, instalação e bucha)", linhas: linhasBlackout(e, t, avisos).filter((x) => !x.comum) }
    ], regras);
  } else if (e.tipo === "cortinaForro") {
    const c = partesCortina(e, t, avisos), pf = preco(t.tecidos, e.forro), pc = preco(t.parametros, "COSTURA"), pb = preco(t.parametros, "BARRA");
    r = venda([
      { titulo: "Cortina", linhas: c.linhas },
      { titulo: "Forro", linhas: [
        { label: `Tecido ${e.forro}: ${m(c.metragem)} m × ${real(pf)}`, valor: arred(c.metragem * pf) },
        { label: `Costura do forro: ${m(c.metragem)} m × ${real(pc)}`, valor: arred(c.metragem * pc) },
        { label: `Barra do forro: ${m(c.base)} m × ${real(pb)}${c.mult !== 1 ? " × " + curto(c.mult) : ""}`, valor: arred(c.base * pb * c.mult) }
      ] }
    ], regras, true);
  } else if (e.tipo === "persiana") {
    const pm2 = preco(t.persianas, e.persiana), bruta = e.largura * e.altura, area = Math.max(bruta, 1.5);
    if (bruta < 1.5) avisos.push({ interno: false, texto: `Área de ${m(bruta)} m² abaixo do mínimo: cobrada como 1,50 m².` });
    // bruto: o sistema antigo (persianas.js) só arredondava no fim, com toFixed, depois de tirar o desconto
    r = { grupos: [{ titulo: "", linhas: [{ label: `${e.persiana}: ${m(area)} m² × ${real(pm2)}/m²`, valor: arred(area * pm2) }] }], custo: null, unit: arred(area * pm2), bruto: area * pm2, conta: [] };
  } else {
    r = { grupos: [{ titulo: "", linhas: [{ label: "Valor informado", valor: arred(e.valor) }] }], custo: null, unit: arred(e.valor), conta: [] };
  }
  const { bruto, ...resto } = r;
  const semArred = Math.max(0, (bruto ?? r.unit) * e.qtd - e.desconto);
  const total = bruto === undefined ? arred(semArred) : Number(semArred.toFixed(2));
  return { ...resto, avisos, total, vista: arred(total * regras.fatorVista), nome: nomeItem(e) };
}
