// Quem é do financeiro: vê a área Financeiro (Preços e Dados) e o cálculo detalhado dos itens.
// Os demais usuários (vendas) não veem esses botões.
// Mesma lista de isPriceEditor() em firestore.rules: ao mudar aqui, mude lá também.
export const FINANCEIRO_UIDS = [
  "P2oPjDGLhzUPNgzGv1fFUrYktyv2", // santiagoqueiroz@gmail.com
  "geH02TKyVHYZ5l6SNc9lfTb2Obr1"  // fernandamika.y@gmail.com
];

export const ehFinanceiro = (usuario) => !!usuario && FINANCEIRO_UIDS.includes(usuario.uid);

// Contas da equipe (as mesmas de isEquipe() em firestore.rules), para mostrar quem fez cada orçamento
const EQUIPE = {
  "Of6EQJcUgmVmTgY9DHMmpCuz2ZI2": "kazecortinas@gmail.com",
  "P2oPjDGLhzUPNgzGv1fFUrYktyv2": "santiagoqueiroz@gmail.com",
  "geH02TKyVHYZ5l6SNc9lfTb2Obr1": "fernandamika.y@gmail.com",
  "kURbAVp5HLg8SLafs675GT6vS5S2": "exemplo@kaze.com",
  "oD4HblNE01alR2GWhCKL5RdZQ3r2": "fernanda@kaze.com"
};
const NOMES = {
  "P2oPjDGLhzUPNgzGv1fFUrYktyv2": "Santiago",
  "geH02TKyVHYZ5l6SNc9lfTb2Obr1": "Fernanda"
};

export const emailPessoa = (uid, email) => EQUIPE[uid] || email || "";

// Nome curto: o cadastrado acima ou o começo do e-mail
export function nomePessoa(uid, email) {
  if (NOMES[uid]) return NOMES[uid];
  const inicio = emailPessoa(uid, email).split("@")[0];
  return inicio ? inicio[0].toUpperCase() + inicio.slice(1) : "Outra conta";
}
