export function initApp() {
  const root = document.querySelector("#app");
  if (!root) return;

  root.innerHTML = `
    <h2>Doorstart (work in progress)</h2>
    <p class="muted">
      We gaan deze app ombouwen naar een viewer op basis van de geharveste dataset
      (<code>data/2026/municipality_groningen.json</code>).
    </p>
    <p class="muted">
      Tot die tijd: de bestaande live-app staat ongewijzigd onder <code>old/</code>.
    </p>
  `;
}

