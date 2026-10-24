// Mensagens de erro amigáveis para falhas do Firebase
export function mensagemErro(err) {
  const codigo = (err && err.code) || "";
  if (codigo.includes("permission-denied")) return "Você não tem permissão para fazer isso.";
  if (codigo.includes("unavailable") || !navigator.onLine) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  if (codigo.includes("not-found")) return "O registro não foi encontrado. Ele pode ter sido excluído por outra pessoa.";
  if (codigo.includes("unauthenticated")) return "Sua sessão expirou. Entre novamente.";
  return "Ocorreu um erro inesperado. Tente de novo; se continuar, avise o responsável.";
}

// Qualquer falha não tratada vira um aviso na tela, em vez de sumir no console
window.addEventListener("unhandledrejection", (e) => {
  console.error(e.reason);
  alert(mensagemErro(e.reason));
});
