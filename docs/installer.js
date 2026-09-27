/* Invite d'installation.

   Sur Android et sur ordinateur, le navigateur émet `beforeinstallprompt` et
   l'installation tient en un bouton. iOS n'expose aucune API équivalente :
   Safari réserve le geste à son menu de partage, et les autres navigateurs
   iOS ne savent pas installer du tout, faute d'accès au moteur. Il faut donc
   décrire la manœuvre plutôt que la proposer. */

import { TEXTES, gabarit } from "./i18n.js";

/** iPhone et iPad, quel que soit le navigateur : tous passent par WebKit. */
export function estIOS(ua, tactile = 0) {
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  // iPadOS 13 et suivants se présentent comme un Mac : seul le tactile les
  // distingue d'un ordinateur de bureau.
  return /Macintosh/.test(ua) && tactile > 1;
}

/** Safari, le seul navigateur iOS capable d'installer réellement la page. */
export function estSafari(ua) {
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Chromium/.test(ua);
}

/** Message d'installation propre à iOS. */
export function messageIOS(ua, langue = "fr") {
  const geste = TEXTES[langue].inst.geste;
  return estSafari(ua)
    ? gabarit(TEXTES[langue].inst.safari, { geste })
    : gabarit(TEXTES[langue].inst.autres, { geste });
}

/** Vrai si la page tourne déjà comme une application installée. */
export function dejaInstallee() {
  return matchMedia("(display-mode: standalone)").matches
    || matchMedia("(display-mode: minimal-ui)").matches
    || navigator.standalone === true;
}

/** Met en place l'invite. Le bloc reste caché tant qu'aucune installation
    n'est possible, pour ne pas promettre ce que le navigateur ne fera pas.
    `lireLangue` est une fonction pour suivre un changement de langue. */
export function initInstallation({ bloc, texte, bouton, lireLangue = () => "fr" }) {
  if (dejaInstallee()) return;

  const montrer = (message, avecBouton) => {
    texte.textContent = message;
    bouton.hidden = !avecBouton;
    bloc.hidden = false;
  };

  if (estIOS(navigator.userAgent, navigator.maxTouchPoints)) {
    montrer(messageIOS(navigator.userAgent, lireLangue()), false);
    return;
  }

  let invite = null;
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // sinon le navigateur affiche sa propre bannière
    invite = e;
    montrer(TEXTES[lireLangue()].inst.garder, true);
  });

  bouton.addEventListener("click", async () => {
    if (!invite) return;
    bouton.disabled = true;
    invite.prompt();
    const { outcome } = await invite.userChoice;
    invite = null;
    if (outcome === "accepted") bloc.hidden = true;
    else {
      // Refus : on n'insiste pas, le navigateur ne réémettra pas l'invite.
      montrer(TEXTES[lireLangue()].inst.annulee, false);
    }
  });

  addEventListener("appinstalled", () => { bloc.hidden = true; });
}
