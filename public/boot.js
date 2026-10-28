// Roda antes do React: aplica o tema salvo (evita piscar claro/escuro) e marca
// o início da tela de abertura. Fica em arquivo próprio para a política de
// segurança (CSP) não precisar liberar scripts embutidos no HTML.
(function () {
  window.__SPLASH_START__ = Date.now();
  try {
    var stored = localStorage.getItem("engemase-ui-theme") || "system";
    var resolved =
      stored === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : stored;
    var root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
  } catch (e) {}
})();
