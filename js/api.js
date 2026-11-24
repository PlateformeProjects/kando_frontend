/**
 * Kando - Client HTTP Centralisé
 * Wrapper standardisé autour de l'API Fetch native pour les échanges avec le backend Express.
 * Inclut également un moteur Mock intégré pour le mode Démo autonome (sans backend).
 *
 * RÔLE PÉDAGOGIQUE POUR LES ÉTUDIANTS B2 DEV :
 * - Injecte automatiquement le token JWT d'authentification dans l'en-tête Authorization.
 * - Sérialise automatiquement les payloads en JSON avec le bon Content-Type.
 * - Traite les codes HTTP conformément aux standards REST (204 No Content, 401 Unauthorized, etc.).
 * - Extrait les messages d'erreurs renvoyés par votre API pour faciliter le débogage.
 */

import { API_BASE_URL } from "./config.js";

/**
 * Données initiales réalistes pour le mode Démo autonome (Équipe IT Logitrack)
 */
const INITIAL_DEMO_DATA = {
  boards: [
    {
      id: 1,
      title: "Roadmap Q3 - Infrastructure Logitrack",
      user_id: 1,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      columns: [
        {
          id: 10,
          title: "À faire",
          position: 0,
          board_id: 1,
          cards: [
            {
              id: 101,
              title: "Mise en place de la réplication PostgreSQL",
              description: "Configurer le streaming de réplication entre le serveur primaire et le replica chaud.",
              position: 0,
              column_id: 10,
              created_at: new Date(Date.now() - 86400000 * 3).toISOString()
            },
            {
              id: 102,
              title: "Mise en conformité RGPD des logs applicatifs",
              description: "Anonymiser les adresses IP et supprimer les traces contenant des mots de passe.",
              position: 1,
              column_id: 10,
              created_at: new Date(Date.now() - 86400000 * 2).toISOString()
            },
            {
              id: 103,
              title: "Ajout du rate-limiting sur l'API",
              description: "Protéger les routes d'authentification contre le brute-force avec express-rate-limit.",
              position: 2,
              column_id: 10,
              created_at: new Date(Date.now() - 86400000 * 1).toISOString()
            }
          ]
        },
        {
          id: 11,
          title: "En cours",
          position: 1,
          board_id: 1,
          cards: [
            {
              id: 104,
              title: "Développement du backend Node.js / Express",
              description: "Implémenter toutes les routes REST pour les tableaux, colonnes et cartes selon la spec.",
              position: 0,
              column_id: 11,
              created_at: new Date(Date.now() - 86400000 * 4).toISOString()
            },
            {
              id: 105,
              title: "Audit de sécurité des dépendances npm",
              description: "Exécuter npm audit et corriger les vulnérabilités signalées.",
              position: 1,
              column_id: 11,
              created_at: new Date(Date.now() - 86400000 * 2).toISOString()
            }
          ]
        },
        {
          id: 12,
          title: "En revue",
          position: 2,
          board_id: 1,
          cards: [
            {
              id: 106,
              title: "Middleware de validation des entrées",
              description: "Valider les formats de requêtes avec Joi ou express-validator.",
              position: 0,
              column_id: 12,
              created_at: new Date(Date.now() - 86400000 * 3).toISOString()
            }
          ]
        },
        {
          id: 13,
          title: "Terminé",
          position: 3,
          board_id: 1,
          cards: [
            {
              id: 107,
              title: "Architecture de la base de données relationnelle",
              description: "Modélisation du schéma PostgreSQL avec clés étrangères et contraintes ON DELETE CASCADE.",
              position: 0,
              column_id: 13,
              created_at: new Date(Date.now() - 86400000 * 7).toISOString()
            },
            {
              id: 108,
              title: "Configuration de l'environnement Docker",
              description: "Mise en place de docker-compose pour PostgreSQL 16 et pgAdmin.",
              position: 1,
              column_id: 13,
              created_at: new Date(Date.now() - 86400000 * 6).toISOString()
            }
          ]
        }
      ]
    },
    {
      id: 2,
      title: "Sprint 14 - API Logistique",
      user_id: 1,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      columns: [
        {
          id: 20,
          title: "À faire",
          position: 0,
          board_id: 2,
          cards: [
            {
              id: 201,
              title: "Optimisation des requêtes de géolocalisation des colis",
              description: "Ajouter des index composites sur colis_id et date_statut.",
              position: 0,
              column_id: 20,
              created_at: new Date().toISOString()
            }
          ]
        },
        {
          id: 21,
          title: "En cours",
          position: 1,
          board_id: 2,
          cards: []
        },
        {
          id: 22,
          title: "Terminé",
          position: 2,
          board_id: 2,
          cards: []
        }
      ]
    }
  ]
};

/**
 * Détecte si l'application est exécutée en mode Démo autonome
 * @returns {boolean}
 */
export function isDemoMode() {
  return (
    window.KANDO_DEMO_MODE === true ||
    window.location.pathname.endsWith("demo.html") ||
    window.location.search.includes("demo=true")
  );
}

/**
 * Réinitialise les données du mode Démo autonome aux valeurs d'origine
 */
export function resetDemoData() {
  localStorage.setItem("kando_demo_db", JSON.stringify(INITIAL_DEMO_DATA));
  localStorage.setItem("kando_demo_token", "kando-demo-jwt-token");
  localStorage.setItem(
    "kando_demo_user",
    JSON.stringify({
      id: 1,
      username: "alex_dev",
      email: "alex@logitrack.internal"
    })
  );
  showToast("Données de démonstration réinitialisées avec succès.", "success");
}

/**
 * Charge la base de données simulée pour le mode Démo
 * @returns {object}
 */
function getDemoDb() {
  const raw = localStorage.getItem("kando_demo_db");
  if (!raw) {
    localStorage.setItem("kando_demo_db", JSON.stringify(INITIAL_DEMO_DATA));
    return JSON.parse(JSON.stringify(INITIAL_DEMO_DATA));
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem("kando_demo_db", JSON.stringify(INITIAL_DEMO_DATA));
    return JSON.parse(JSON.stringify(INITIAL_DEMO_DATA));
  }
}

/**
 * Sauvegarde la base de données simulée du mode Démo
 * @param {object} db
 */
function saveDemoDb(db) {
  localStorage.setItem("kando_demo_db", JSON.stringify(db));
}

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

  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => removeToast(toast));

  container.appendChild(toast);

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
 * Intercepteur Mock API simulant l'ensemble des réponses REST attendues du backend Express
 * @param {string} endpoint
 * @param {object} options
 * @returns {Promise<any>}
 */
async function handleMockApiRequest(endpoint, options = {}) {
  // Petite latence artificielle réaliste de 60ms
  await new Promise((resolve) => setTimeout(resolve, 60));

  const method = (options.method || "GET").toUpperCase();
  const db = getDemoDb();
  let body = options.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      // texte brut
    }
  }

  // 1. Authentification
  if (endpoint === "/auth/login" && method === "POST") {
    const user = {
      id: 1,
      username: body?.email ? body.email.split("@")[0] : "alex_dev",
      email: body?.email || "alex@logitrack.internal"
    };
    return { token: "kando-demo-jwt-token", user };
  }

  if (endpoint === "/auth/register" && method === "POST") {
    return {
      id: Date.now(),
      username: body?.username || "alex_dev",
      email: body?.email || "alex@logitrack.internal"
    };
  }

  // 2. Tableaux (Boards)
  if (endpoint === "/boards" && method === "GET") {
    return db.boards.map((b) => ({
      id: b.id,
      title: b.title,
      user_id: b.user_id,
      created_at: b.created_at
    }));
  }

  if (endpoint === "/boards" && method === "POST") {
    const newId = Date.now();
    const newBoard = {
      id: newId,
      title: body.title,
      user_id: 1,
      created_at: new Date().toISOString(),
      columns: [
        { id: newId + 1, title: "À faire", position: 0, board_id: newId, cards: [] },
        { id: newId + 2, title: "En cours", position: 1, board_id: newId, cards: [] },
        { id: newId + 3, title: "Terminé", position: 2, board_id: newId, cards: [] }
      ]
    };
    db.boards.push(newBoard);
    saveDemoDb(db);
    return {
      id: newBoard.id,
      title: newBoard.title,
      user_id: newBoard.user_id,
      created_at: newBoard.created_at
    };
  }

  // GET /boards/:id/cards?search=...
  const searchMatch = endpoint.match(/^\/boards\/(\d+)\/cards\?search=(.*)$/);
  if (searchMatch && method === "GET") {
    const boardId = Number(searchMatch[1]);
    const term = decodeURIComponent(searchMatch[2]).toLowerCase();
    const board = db.boards.find((b) => b.id === boardId);
    if (!board) return [];

    const found = [];
    for (const col of board.columns) {
      for (const card of col.cards || []) {
        if (
          card.title.toLowerCase().includes(term) ||
          (card.description && card.description.toLowerCase().includes(term))
        ) {
          found.push(card);
        }
      }
    }
    return found;
  }

  // GET /boards/:id
  const boardIdMatch = endpoint.match(/^\/boards\/(\d+)$/);
  if (boardIdMatch && method === "GET") {
    const boardId = Number(boardIdMatch[1]);
    const board = db.boards.find((b) => b.id === boardId);
    if (!board) {
      const err = new Error("Tableau introuvable");
      err.status = 404;
      throw err;
    }
    return board;
  }

  // DELETE /boards/:id
  if (boardIdMatch && method === "DELETE") {
    const boardId = Number(boardIdMatch[1]);
    db.boards = db.boards.filter((b) => b.id !== boardId);
    saveDemoDb(db);
    return null; // 204
  }

  // 3. Colonnes
  // POST /boards/:boardId/columns
  const addColMatch = endpoint.match(/^\/boards\/(\d+)\/columns$/);
  if (addColMatch && method === "POST") {
    const boardId = Number(addColMatch[1]);
    const board = db.boards.find((b) => b.id === boardId);
    if (!board) throw new Error("Tableau introuvable");

    const newCol = {
      id: Date.now(),
      title: body.title,
      position: Number(body.position ?? board.columns.length),
      board_id: boardId,
      cards: []
    };
    board.columns.push(newCol);
    saveDemoDb(db);
    return newCol;
  }

  // PATCH /columns/:id
  const colIdMatch = endpoint.match(/^\/columns\/(\d+)$/);
  if (colIdMatch && method === "PATCH") {
    const colId = Number(colIdMatch[1]);
    for (const b of db.boards) {
      const col = b.columns.find((c) => c.id === colId);
      if (col) {
        if (body.title !== undefined) col.title = body.title;
        if (body.position !== undefined) col.position = Number(body.position);
        saveDemoDb(db);
        return col;
      }
    }
    throw new Error("Colonne introuvable");
  }

  // DELETE /columns/:id
  if (colIdMatch && method === "DELETE") {
    const colId = Number(colIdMatch[1]);
    for (const b of db.boards) {
      b.columns = b.columns.filter((c) => c.id !== colId);
    }
    saveDemoDb(db);
    return null; // 204
  }

  // 4. Cartes
  // POST /columns/:columnId/cards
  const addCardMatch = endpoint.match(/^\/columns\/(\d+)\/cards$/);
  if (addCardMatch && method === "POST") {
    const colId = Number(addCardMatch[1]);
    for (const b of db.boards) {
      const col = b.columns.find((c) => c.id === colId);
      if (col) {
        const newCard = {
          id: Date.now(),
          title: body.title,
          description: body.description || "",
          position: Number(body.position ?? col.cards.length),
          column_id: colId,
          created_at: new Date().toISOString()
        };
        col.cards.push(newCard);
        saveDemoDb(db);
        return newCard;
      }
    }
    throw new Error("Colonne cible introuvable");
  }

  // PATCH /cards/:id/move
  const moveCardMatch = endpoint.match(/^\/cards\/(\d+)\/move$/);
  if (moveCardMatch && method === "PATCH") {
    const cardId = Number(moveCardMatch[1]);
    const targetColId = Number(body.column_id);
    const targetPos = Number(body.position);

    let movedCard = null;

    // Retirer la carte de son ancienne colonne
    for (const b of db.boards) {
      for (const col of b.columns) {
        const idx = col.cards.findIndex((c) => c.id === cardId);
        if (idx !== -1) {
          movedCard = col.cards.splice(idx, 1)[0];
          break;
        }
      }
      if (movedCard) break;
    }

    if (!movedCard) throw new Error("Carte introuvable");

    // L'insérer dans la colonne cible à la position voulue
    movedCard.column_id = targetColId;

    for (const b of db.boards) {
      const targetCol = b.columns.find((c) => c.id === targetColId);
      if (targetCol) {
        if (!Array.isArray(targetCol.cards)) targetCol.cards = [];
        targetCol.cards.splice(targetPos, 0, movedCard);
        // Réindexation des positions
        targetCol.cards.forEach((c, i) => {
          c.position = i;
        });
        saveDemoDb(db);
        return movedCard;
      }
    }

    throw new Error("Colonne cible introuvable");
  }

  // PATCH /cards/:id
  const cardIdMatch = endpoint.match(/^\/cards\/(\d+)$/);
  if (cardIdMatch && method === "PATCH") {
    const cardId = Number(cardIdMatch[1]);
    for (const b of db.boards) {
      for (const col of b.columns) {
        const card = col.cards?.find((c) => c.id === cardId);
        if (card) {
          if (body.title !== undefined) card.title = body.title;
          if (body.description !== undefined) card.description = body.description;
          if (body.position !== undefined) card.position = Number(body.position);
          saveDemoDb(db);
          return card;
        }
      }
    }
    throw new Error("Carte introuvable");
  }

  // DELETE /cards/:id
  if (cardIdMatch && method === "DELETE") {
    const cardId = Number(cardIdMatch[1]);
    for (const b of db.boards) {
      for (const col of b.columns) {
        if (Array.isArray(col.cards)) {
          col.cards = col.cards.filter((c) => c.id !== cardId);
        }
      }
    }
    saveDemoDb(db);
    return null; // 204
  }

  // Fallback si non géré
  console.warn(`[Kando Mock] Route non simulée : ${method} ${endpoint}`);
  return {};
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
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  // En mode Démo autonome, on utilise le moteur mock local sans contacter de backend
  if (isDemoMode()) {
    return await handleMockApiRequest(cleanEndpoint, options);
  }

  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const headers = {
    Accept: "application/json",
    ...(options.headers || {})
  };

  // 1. Injection automatique du token JWT pour toutes les requêtes authentifiées
  const tokenKey = "kando_token";
  const token = localStorage.getItem(tokenKey);
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

    // 3. Gestion du statut HTTP 204 No Content
    if (response.status === 204) {
      return null;
    }

    // 4. Gestion du statut HTTP 401 Unauthorized
    if (response.status === 401) {
      localStorage.removeItem("kando_token");
      localStorage.removeItem("kando_user");

      showToast(
        "Session expirée ou non autorisée (401). Veuillez vous reconnecter.",
        "warning"
      );

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
            backendErrorMsg = errorData.errors
              .map((e) => e.msg || e.message || JSON.stringify(e))
              .join(", ");
          } else {
            backendErrorMsg = JSON.stringify(errorData);
          }
        }
      } catch (parseError) {
        backendErrorMsg = response.statusText || `Erreur serveur (${response.status})`;
      }

      const finalErrorMessage = backendErrorMsg || `Erreur HTTP ${response.status}`;

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
    if (
      networkError.name === "TypeError" &&
      networkError.message.toLowerCase().includes("fetch")
    ) {
      const serverErrMsg = `Erreur réseau : impossible de joindre le serveur sur ${API_BASE_URL}. Vérifiez que votre backend Express tourne sur le port 3000 et que CORS est bien configuré (cors middleware).`;
      showToast(serverErrMsg, "error", 6000);
      throw new Error(serverErrMsg);
    }

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
