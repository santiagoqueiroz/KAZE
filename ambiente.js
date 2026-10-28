// Selo de ambiente: aparece só fora do site oficial (GitHub Pages)
(function () {
  if (location.hostname.endsWith("github.io")) return;

  // Páginas com um lugar reservado (app.html, no topo) recebem o selo ali; as demais, no canto da tela
  const lugar = document.getElementById("selo-ambiente-lugar");

  const css = document.createElement("style");
  css.textContent = `
    #selo-ambiente {
      position: fixed; right: 12px; bottom: 12px; z-index: 99999;
      background: #d9822b; color: #fff; border: none; border-radius: 999px;
      padding: 8px 14px; font: bold 13px 'Bahnschrift', sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25); cursor: pointer; opacity: 0.92;
    }
    #selo-ambiente:hover { opacity: 1; }
    #selo-ambiente.no-topo { position: static; padding: 4px 10px; font-size: 11px; box-shadow: none; display: inline-block !important; }
    @media print { #selo-ambiente { display: none !important; } }
  `;
  document.head.appendChild(css);

  const selo = document.createElement("button");
  selo.id = "selo-ambiente";
  selo.type = "button";
  selo.textContent = lugar ? "🚧 Testes" : "🚧 Em desenvolvimento";
  selo.onclick = () => alert(
    "Esta é a versão de testes do sistema KAZE.\n\n" +
    "Os dados são os mesmos do sistema oficial: o que for criado, editado ou excluído aqui vale de verdade."
  );
  if (lugar) {
    selo.classList.add("no-topo");
    lugar.appendChild(selo);
  } else {
    document.body.appendChild(selo);
  }
})();
