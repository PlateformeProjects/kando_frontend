/**
 * Kando - Client HTTP Centralisé
 * Wrapper standardisé autour de l'API Fetch native pour les échanges avec le backend Express.
 *
 * RÔLE PÉDAGOGIQUE POUR LES ÉTUDIANTS B2 DEV :
 * - Injecte automatiquement le token JWT d'authentification dans l'en-tête Authorization.
 * - Sérialise automatiquement les payloads en JSON avec le bon Content-Type.
 * - Traite les codes HTTP conformément aux standards REST (204 No Content, 401 Unauthorized, etc.).
 * - Extrait les messages d'erreurs renvoyés par votre API pour faciliter le débogage.
 */

import { API_BASE_URL } from "./config.js";

/**
 * Gestionnaire d'affichage des notifications Toast dans l'interface utilisateur.
 * Supporte les types : 'info', 'success', 'warning', 'error'.
 * Utilise exclusivement des icônes vectorielles SVG (aucune émoticône Unicode).
 *
 * @param {string} message - Message textuel à afficher
 * @param {'info' | 'success' | 'warning' | 'error'} type - Niveau de sévérité du toast
 * @param {number} [duration=4500] - Durée d'affichage en millisecondes
 */
export function showToast(message, type = "info", duration = 4500) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "alert");

  // Définition des icônes SVG selon le type (conformité stricte SVG sans emoji)
  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  } else if (type === "warning") {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
  } else {
    // info
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `
    <div class="toast-body">
      ${iconSvg}
      <span class="toast-message">${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Fermer la notification">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;

  // Fermeture manuelle au clic
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => removeToast(toast));

  // Ajout au conteneur
  container.appendChild(toast);

  // Suppression automatique après le délai imparti
  const timer = setTimeout(() => {
    removeToast(toast);
  }, duration);

  toast._timer = timer;
}

/**
 * Supprime proprement un élément toast avec animation de disparition
 * @param {HTMLElement} toast
 */
function removeToast(toast) {
  if (!toast || toast.classList.contains("toast-closing")) return;
  clearTimeout(toast._timer);
  toast.classList.add("toast-closing");
  toast.addEventListener("animationend", () => {
    toast.remove();
  });
}

/**
 * Fonction utilitaire d'échappement HTML pour prévenir les injections XSS
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (typeof str !== "string") return String(str ?? "");
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Fonction centrale d'exécution des requêtes HTTP vers l'API.
 *
 * @param {string} endpoint - Point d'entrée de l'API (ex: '/boards' ou '/cards/1')
 * @param {object} [options={}] - Options de la requête fetch
 * @param {string} [options.method='GET'] - Méthode HTTP (GET, POST, PATCH, DELETE)
 * @param {object|null} [options.body] - Corps de la requête à sérialiser en JSON
 * @param {object} [options.headers] - En-têtes HTTP personnalisés
 * @param {boolean} [options.silentFail404=false] - Si true, n'affiche pas de toast d'erreur lors d'un 404 (utilisé pour la recherche bonus)
 * @returns {Promise<any>} Données JSON retournées par l'API, ou null lors d'un 204 No Content
 */
export async function apiRequest(endpoint, options = {}) {
  // Construction de l'URL cible
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  // Initialisation des en-têtes
  const headers = {
    Accept: "application/json",
    ...(options.headers || {})
  };

  // 1. Injection automatique du token JWT pour toutes les requêtes authentifiées
  const token = localStorage.getItem("kando_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // 2. Gestion du corps de requête et du Content-Type
  let body = options.body;
  if (body !== undefined && body !== null) {
    if (typeof body === "object" && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      body
    });

    // 3. Gestion du statut HTTP 204 No Content (ex: DELETE /api/boards/:id ou DELETE /api/cards/:id)
    if (response.status === 204) {
      return null;
    }

    // 4. Gestion du statut HTTP 401 Unauthorized (token manquant, invalide ou expiré)
    if (response.status === 401) {
      localStorage.removeItem("kando_token");
      localStorage.removeItem("kando_user");

      showToast(
        "Session expirée ou non autorisée (401). Veuillez vous reconnecter.",
        "warning"
      );

      // Notification globale pour basculer automatiquement sur la vue Authentification
      window.dispatchEvent(new CustomEvent("kando:auth-expired"));

      throw new Error("Authentification requise ou expirée (401)");
    }

    // 5. Gestion des erreurs HTTP (400, 403, 404, 500, etc.)
    if (!response.ok) {
      let backendErrorMsg = "";

      try {
        const errorData = await response.json();
        if (errorData) {
          if (typeof errorData.error === "string") {
            backendErrorMsg = errorData.error;
          } else if (typeof errorData.message === "string") {
            backendErrorMsg = errorData.message;
          } else if (typeof errorData.error === "object" && errorData.error?.message) {
            backendErrorMsg = errorData.error.message;
          } else if (Array.isArray(errorData.errors)) {
            // Format d'erreurs fréquent dans express-validator
            backendErrorMsg = errorData.errors
              .map((e) => e.msg || e.message || JSON.stringify(e))
              .join(", ");
          } else {
            backendErrorMsg = JSON.stringify(errorData);
          }
        }
      } catch (parseError) {
        // En cas de réponse HTML générée par Express sur une erreur non captée (ex: Error 500)
        backendErrorMsg = response.statusText || `Erreur serveur (${response.status})`;
      }

      const finalErrorMessage = backendErrorMsg || `Erreur HTTP ${response.status}`;

      // Si le statut est 404 et que silentFail404 est activé (cas du bonus de recherche), on n'affiche pas de toast
      if (!(response.status === 404 && options.silentFail404)) {
        showToast(`Erreur ${response.status} : ${finalErrorMessage}`, "error");
      }

      const err = new Error(finalErrorMessage);
      err.status = response.status;
      throw err;
    }

    // 6. Succès : extraction de la charge utile JSON
    return await response.json();
  } catch (networkError) {
    // Détection d'une absence de serveur ou d'un échec CORS (TypeError: Failed to fetch)
    if (
      networkError.name === "TypeError" &&
      networkError.message.toLowerCase().includes("fetch")
    ) {
      const serverErrMsg = `Erreur réseau : impossible de joindre le serveur sur ${API_BASE_URL}. Vérifiez que votre backend Express tourne sur le port 3000 et que CORS est bien configuré (cors middleware).`;
      showToast(serverErrMsg, "error", 6000);
      throw new Error(serverErrMsg);
    }

    // Si c'est déjà une Error levée avec son statut HTTP, on la propage
    throw networkError;
  }
}

/**
 * Objet API centralisé exposant les méthodes REST standards
 */
export const api = {
  get: (endpoint, options = {}) =>
    apiRequest(endpoint, { ...options, method: "GET" }),

  post: (endpoint, body, options = {}) =>
    apiRequest(endpoint, { ...options, method: "POST", body }),

  patch: (endpoint, body, options = {}) =>
    apiRequest(endpoint, { ...options, method: "PATCH", body }),

  delete: (endpoint, options = {}) =>
    apiRequest(endpoint, { ...options, method: "DELETE" }),

  request: apiRequest
};
