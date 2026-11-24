/**
 * Kando - Module Tableau Kanban (Board)
 * Gestion des tableaux, colonnes, cartes, glisser-déposer (Drag & Drop) natif et recherche.
 *
 * RÔLE PÉDAGOGIQUE POUR LES ÉTUDIANTS B2 DEV :
 * - Implémente l'ensemble des routes REST spécifiées dans le cahier des charges :
 *     * Tableaux : GET /api/boards, POST /api/boards, GET /api/boards/:id, DELETE /api/boards/:id
 *     * Colonnes : POST /api/boards/:boardId/columns, PATCH /api/columns/:id, DELETE /api/columns/:id
 *     * Cartes   : POST /api/columns/:columnId/cards, PATCH /api/cards/:id, DELETE /api/cards/:id, PATCH /api/cards/:id/move
 *     * Recherche: GET /api/boards/:id/cards?search=... (avec repli gracieux côté client si 404)
 * - Traite le Drag & Drop natif HTML5 avec calcul d'index entier 'position' (0, 1, 2...).
 */

import { api, showToast } from "./api.js";

// État local du module Kanban
let boardsList = [];
let activeBoardId = null;
let currentBoardData = null;
let currentSearchQuery = "";
let draggedCardInfo = null;
let searchDebounceTimer = null;

/**
 * Fonction utilitaire d'échappement HTML pour prévenir les failles XSS
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
 * Ouvre une fenêtre modale par son identifiant
 * @param {string} modalId
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add("modal-open");
  const firstInput = modal.querySelector("input:not([type=hidden]), textarea");
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 50);
  }
}

/**
 * Ferme une fenêtre modale
 * @param {string} modalId
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove("modal-open");
  const form = modal.querySelector("form");
  if (form) form.reset();
}

/**
 * Affiche la modale générique de confirmation avant suppression
 * @param {string} title
 * @param {string} message
 * @param {() => Promise<void> | void} onConfirm
 */
export function showConfirmModal(title, message, onConfirm) {
  const modal = document.getElementById("modal-confirm");
  const titleEl = document.getElementById("modal-confirm-title");
  const msgEl = document.getElementById("modal-confirm-message");
  const confirmBtn = document.getElementById("modal-confirm-btn");

  if (!modal || !titleEl || !msgEl || !confirmBtn) {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }

  titleEl.textContent = title;
  msgEl.textContent = message;

  // Remplace le listener du bouton de confirmation
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  newConfirmBtn.addEventListener("click", async () => {
    closeModal("modal-confirm");
    await onConfirm();
  });

  openModal("modal-confirm");
}

/**
 * Initialise le module Kanban (écouteurs globaux, formulaires de modales, recherche)
 */
export function initBoard() {
  setupBoardUIEventListeners();
  setupModalsEventListeners();
}

/**
 * Réinitialise l'état local du tableau lors d'une déconnexion
 */
export function resetBoardState() {
  boardsList = [];
  activeBoardId = null;
  currentBoardData = null;
  currentSearchQuery = "";
  draggedCardInfo = null;

  const boardSelect = document.getElementById("board-select");
  if (boardSelect) boardSelect.innerHTML = "";

  const container = document.getElementById("kanban-columns-container");
  if (container) container.innerHTML = "";

  const searchInput = document.getElementById("search-cards-input");
  if (searchInput) searchInput.value = "";
}

/**
 * Charge la liste de tous les tableaux de l'utilisateur connecté (GET /api/boards)
 */
export async function loadUserBoards() {
  try {
    // Appel API attendu : GET /api/boards
    // Réponse attendue (200) : tableau JSON [{ id, title, user_id, created_at }, ...]
    const boards = await api.get("/boards");
    boardsList = Array.isArray(boards) ? boards : [];

    renderBoardsDropdown();

    if (boardsList.length === 0) {
      activeBoardId = null;
      currentBoardData = null;
      renderEmptyState();
      return;
    }

    // Récupère l'éventuel tableau précédemment sélectionné en session, sinon le premier
    const savedBoardId = Number(sessionStorage.getItem("kando_active_board_id"));
    const boardExists = boardsList.some((b) => Number(b.id) === savedBoardId);

    const initialBoardId = boardExists ? savedBoardId : boardsList[0].id;
    await selectBoard(initialBoardId);
  } catch (err) {
    console.error("[Kando Board] Erreur lors du chargement des tableaux :", err);
    renderEmptyState("Impossible de charger les tableaux. Vérifiez la connexion à l'API.");
  }
}

/**
 * Met à jour le menu déroulant des tableaux dans le header
 */
function renderBoardsDropdown() {
  const select = document.getElementById("board-select");
  const deleteBoardBtn = document.getElementById("btn-delete-board");

  if (!select) return;

  if (boardsList.length === 0) {
    select.innerHTML = `<option value="">Aucun tableau</option>`;
    select.disabled = true;
    if (deleteBoardBtn) deleteBoardBtn.disabled = true;
    return;
  }

  select.disabled = false;
  if (deleteBoardBtn) deleteBoardBtn.disabled = false;

  select.innerHTML = boardsList
    .map(
      (b) =>
        `<option value="${b.id}" ${Number(b.id) === Number(activeBoardId) ? "selected" : ""}>
          ${escapeHtml(b.title)}
        </option>`
    )
    .join("");
}

/**
 * Sélectionne et charge un tableau donné par son ID (GET /api/boards/:id)
 * @param {number|string} boardId
 */
export async function selectBoard(boardId) {
  if (!boardId) return;

  activeBoardId = Number(boardId);
  sessionStorage.setItem("kando_active_board_id", String(activeBoardId));

  // Met à jour le selecteur visuel
  const select = document.getElementById("board-select");
  if (select) select.value = String(activeBoardId);

  await refreshActiveBoard();
}

/**
 * Rafraîchit les données du tableau actif (GET /api/boards/:id) et réaffiche la vue
 */
export async function refreshActiveBoard() {
  if (!activeBoardId) return;

  try {
    // Appel API attendu : GET /api/boards/:id
    // Réponse attendue (200) : { id, title, user_id, columns: [ { id, title, position, board_id, cards: [ ... ] } ] }
    const boardData = await api.get(`/boards/${activeBoardId}`);
    currentBoardData = boardData;

    renderBoard(currentBoardData);

    // Si une recherche est en cours, réapplique le filtre
    if (currentSearchQuery.trim()) {
      handleSearch(currentSearchQuery);
    }
  } catch (err) {
    console.error(`[Kando Board] Erreur lors du chargement du tableau #${activeBoardId} :`, err);
  }
}

/**
 * Affiche l'écran d'accueil sans tableau ou en cas d'absence de données
 * @param {string} [customMessage]
 */
function renderEmptyState(customMessage) {
  const container = document.getElementById("kanban-columns-container");
  const boardHeaderBar = document.getElementById("board-sub-bar");
  if (boardHeaderBar) boardHeaderBar.classList.add("hidden");

  if (!container) return;

  container.innerHTML = `
    <div class="empty-state-card">
      <div class="empty-state-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2"/>
          <path d="M9 3v18M15 3v18"/>
        </svg>
      </div>
      <h2>${customMessage ? "Information" : "Aucun tableau pour le moment"}</h2>
      <p>${customMessage || "Créez votre premier tableau Kanban pour commencer à organiser les tâches de votre équipe."}</p>
      <button type="button" class="btn btn-primary" id="btn-create-first-board">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Créer un nouveau tableau
      </button>
    </div>
  `;

  const btnFirst = document.getElementById("btn-create-first-board");
  if (btnFirst) {
    btnFirst.addEventListener("click", () => openModal("modal-board"));
  }
}

/**
 * Construit et injecte le DOM du tableau Kanban (colonnes et cartes)
 * @param {object} board
 */
function renderBoard(board) {
  const container = document.getElementById("kanban-columns-container");
  const boardHeaderBar = document.getElementById("board-sub-bar");
  const currentBoardTitleEl = document.getElementById("current-board-title-text");

  if (!container) return;

  if (boardHeaderBar) boardHeaderBar.classList.remove("hidden");
  if (currentBoardTitleEl) currentBoardTitleEl.textContent = board.title || "Tableau";

  // Sécurité pédagogique : trie explicitement les colonnes par 'position' croissante
  const columns = Array.isArray(board.columns) ? [...board.columns] : [];
  columns.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));

  // Construction des colonnes HTML
  const columnsHtml = columns
    .map((col) => {
      // Trie également les cartes de chaque colonne par 'position' croissante
      const cards = Array.isArray(col.cards) ? [...col.cards] : [];
      cards.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));

      const cardsHtml = cards.map((card) => createCardHtml(card, col.id)).join("");

      return `
        <div class="kanban-column" data-column-id="${col.id}" data-column-position="${col.position ?? 0}">
          <!-- En-tête de colonne -->
          <div class="kanban-column-header">
            <div class="kanban-column-title-wrap">
              <h3 class="kanban-column-title" title="Cliquer pour modifier" data-action="edit-column-title" data-column-id="${col.id}">
                ${escapeHtml(col.title)}
              </h3>
              <span class="cards-count-badge" title="Nombre de cartes dans cette colonne">${cards.length}</span>
            </div>
            <div class="column-actions">
              <button type="button" class="btn-icon" data-action="edit-column-title" data-column-id="${col.id}" title="Renommer la colonne">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
                </svg>
              </button>
              <button type="button" class="btn-icon btn-icon-danger" data-action="delete-column" data-column-id="${col.id}" data-column-title="${escapeHtml(col.title)}" title="Supprimer la colonne">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Zone scrollable des cartes (cible de drop) -->
          <div class="kanban-cards-list" data-column-id="${col.id}">
            ${cardsHtml}
          </div>

          <!-- Pied de colonne : bouton d'ajout de carte -->
          <div class="kanban-column-footer">
            <button type="button" class="btn btn-add-card" data-action="open-add-card" data-column-id="${col.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Ajouter une carte
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // Bouton d'ajout d'une nouvelle colonne positionné à droite
  const addColumnButtonHtml = `
    <div class="add-column-wrapper">
      <button type="button" class="btn btn-add-column" id="btn-open-add-column">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Ajouter une colonne
      </button>
    </div>
  `;

  container.innerHTML = columnsHtml + addColumnButtonHtml;

  // Attachement des écouteurs de Drag & Drop natif et des actions de boutons
  attachDragAndDropHandlers();
  attachBoardActionHandlers();
}

/**
 * Génère le balisage HTML d'une carte Kanban avec attributs draggable
 * @param {object} card
 * @param {number|string} columnId
 * @returns {string}
 */
function createCardHtml(card, columnId) {
  const hasDescription = Boolean(card.description && card.description.trim());
  const descriptionPreview = hasDescription
    ? `<p class="kanban-card-desc">${escapeHtml(card.description)}</p>`
    : "";

  return `
    <div class="kanban-card"
         draggable="true"
         data-card-id="${card.id}"
         data-column-id="${columnId}"
         data-position="${card.position ?? 0}">
      <div class="kanban-card-main">
        <h4 class="kanban-card-title">${escapeHtml(card.title)}</h4>
        ${descriptionPreview}
      </div>
      <div class="kanban-card-actions">
        <button type="button" class="btn-icon" data-action="edit-card" data-card-id="${card.id}" title="Modifier la carte">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
          </svg>
        </button>
        <button type="button" class="btn-icon btn-icon-danger" data-action="delete-card" data-card-id="${card.id}" data-card-title="${escapeHtml(card.title)}" title="Supprimer la carte">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

/**
 * Configure les écouteurs d'événements du Drag & Drop natif HTML5 sur les cartes et conteneurs
 */
function attachDragAndDropHandlers() {
  const cards = document.querySelectorAll(".kanban-card");
  const dropzones = document.querySelectorAll(".kanban-cards-list");

  // Événements sur les cartes déplaçables (dragstart, dragend)
  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      draggedCardInfo = {
        cardId: Number(card.dataset.cardId),
        sourceColumnId: Number(card.dataset.columnId),
        sourcePosition: Number(card.dataset.position)
      };

      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", JSON.stringify(draggedCardInfo));

      // Ajout de la classe visuelle
      setTimeout(() => card.classList.add("is-dragging"), 0);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      cleanDragIndicators();
      draggedCardInfo = null;
    });
  });

  // Événements sur les colonnes cibles (dragover, dragenter, dragleave, drop)
  dropzones.forEach((zone) => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      zone.classList.add("drag-over");

      const afterElement = getDragAfterElement(zone, e.clientY);
      const indicator = getOrCreateDragIndicator(zone);

      if (afterElement == null) {
        zone.appendChild(indicator);
      } else {
        zone.insertBefore(indicator, afterElement);
      }
    });

    zone.addEventListener("dragleave", (e) => {
      // Vérifie si la sortie est bien en dehors du conteneur
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove("drag-over");
      }
    });

    zone.addEventListener("drop", async (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");

      let payload = draggedCardInfo;
      if (!payload) {
        try {
          const raw = e.dataTransfer.getData("text/plain");
          payload = JSON.parse(raw);
        } catch {
          payload = null;
        }
      }

      if (!payload || !payload.cardId) {
        cleanDragIndicators();
        return;
      }

      const targetColumnId = Number(zone.dataset.columnId);
      const afterElement = getDragAfterElement(zone, e.clientY);

      // Calcul du nouvel index entier 'position' (0, 1, 2...)
      // On compte les cartes existantes dans cette colonne (hors celle en cours de drag)
      const siblingCards = [...zone.querySelectorAll(".kanban-card:not(.is-dragging)")];

      let newPosition = 0;
      if (afterElement == null) {
        // Déposée à la fin de la colonne
        newPosition = siblingCards.length;
      } else {
        const targetIndex = siblingCards.indexOf(afterElement);
        newPosition = targetIndex >= 0 ? targetIndex : 0;
      }

      cleanDragIndicators();

      // Optimisation : si la carte n'a pas bougé de colonne ni de position, on ne fait rien
      if (
        payload.sourceColumnId === targetColumnId &&
        payload.sourcePosition === newPosition
      ) {
        return;
      }

      try {
        // Appel API STRICT attendu : PATCH /api/cards/:id/move
        // Payload attendu : { column_id: Number, position: Number } (nombres entiers)
        // Réponse attendue (200) : carte mise à jour
        await api.patch(`/cards/${payload.cardId}/move`, {
          column_id: Number(targetColumnId),
          position: Number(newPosition)
        });

        showToast("Carte déplacée avec succès.", "success", 2000);

        // Rafraîchissement des données du tableau
        await refreshActiveBoard();
      } catch (err) {
        console.error("[Kando Drag&Drop] Échec du déplacement de la carte :", err);
        // En cas d'erreur de déplacement, on recharge l'état serveur
        await refreshActiveBoard();
      }
    });
  });
}

/**
 * Détermine la carte directement située sous la position du curseur vertical
 * pour calculer l'emplacement d'insertion précis
 * @param {HTMLElement} container
 * @param {number} y
 * @returns {HTMLElement | null}
 */
function getDragAfterElement(container, y) {
  const draggableElements = [
    ...container.querySelectorAll(".kanban-card:not(.is-dragging)")
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY }
  ).element;
}

/**
 * Crée ou réutilise l'indicateur visuel de drop (ligne bleue Linear)
 * @param {HTMLElement} container
 * @returns {HTMLElement}
 */
function getOrCreateDragIndicator(container) {
  let indicator = document.querySelector(".drop-indicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.className = "drop-indicator";
  }
  return indicator;
}

/**
 * Nettoie tous les indicateurs visuels temporaires de drag
 */
function cleanDragIndicators() {
  document.querySelectorAll(".drop-indicator").forEach((el) => el.remove());
  document.querySelectorAll(".kanban-cards-list").forEach((el) => {
    el.classList.remove("drag-over");
  });
}

/**
 * Attache les écouteurs sur les boutons d'action du tableau (création, édition, suppression)
 */
function attachBoardActionHandlers() {
  const container = document.getElementById("kanban-columns-container");
  if (!container) return;

  // 1. Bouton "Ajouter une colonne"
  const btnAddCol = document.getElementById("btn-open-add-column");
  if (btnAddCol) {
    btnAddCol.addEventListener("click", () => {
      const form = document.getElementById("form-column");
      const titleInput = document.getElementById("column-modal-title");
      const heading = document.getElementById("modal-column-heading");
      if (form) form.reset();
      if (heading) heading.textContent = "Ajouter une colonne";
      if (titleInput) titleInput.value = "";
      delete form.dataset.editColumnId;
      openModal("modal-column");
    });
  }

  // 2. Gestion de la délégation d'événements pour les boutons d'action des colonnes et des cartes
  container.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) return;

    const action = target.dataset.action;

    // --- Action : Ouvrir la modale d'ajout de carte ---
    if (action === "open-add-card") {
      const columnId = target.dataset.columnId;
      const form = document.getElementById("form-card");
      const heading = document.getElementById("modal-card-heading");
      if (form) form.reset();
      if (heading) heading.textContent = "Ajouter une nouvelle tâche";
      delete form.dataset.editCardId;
      form.dataset.columnId = columnId;
      openModal("modal-card");
      return;
    }

    // --- Action : Renommer une colonne ---
    if (action === "edit-column-title") {
      const columnId = target.dataset.columnId;
      const col = currentBoardData?.columns?.find((c) => Number(c.id) === Number(columnId));
      const currentTitle = col?.title || "";

      const form = document.getElementById("form-column");
      const titleInput = document.getElementById("column-modal-title");
      const heading = document.getElementById("modal-column-heading");

      if (form && titleInput) {
        form.reset();
        heading.textContent = "Renommer la colonne";
        titleInput.value = currentTitle;
        form.dataset.editColumnId = columnId;
        openModal("modal-column");
      }
      return;
    }

    // --- Action : Supprimer une colonne ---
    if (action === "delete-column") {
      const columnId = target.dataset.columnId;
      const columnTitle = target.dataset.columnTitle || "cette colonne";

      showConfirmModal(
        "Supprimer la colonne",
        `Êtes-vous certain de vouloir supprimer la colonne "${columnTitle}" ainsi que toutes ses cartes associées ? Cette action est irréversible.`,
        async () => {
          try {
            // Appel API attendu : DELETE /api/columns/:id
            // Réponse attendue (204 No Content)
            await api.delete(`/columns/${columnId}`);
            showToast("Colonne supprimée avec succès.", "success");
            await refreshActiveBoard();
          } catch (err) {
            console.error("[Kando] Erreur lors de la suppression de la colonne :", err);
          }
        }
      );
      return;
    }

    // --- Action : Modifier une carte (modale) ---
    if (action === "edit-card") {
      const cardId = target.dataset.cardId;
      // Recherche de la carte dans l'état local
      let foundCard = null;
      let foundColId = null;

      if (currentBoardData?.columns) {
        for (const col of currentBoardData.columns) {
          const card = col.cards?.find((c) => Number(c.id) === Number(cardId));
          if (card) {
            foundCard = card;
            foundColId = col.id;
            break;
          }
        }
      }

      if (!foundCard) return;

      const form = document.getElementById("form-card");
      const heading = document.getElementById("modal-card-heading");
      const titleInput = document.getElementById("card-modal-title");
      const descInput = document.getElementById("card-modal-desc");

      if (form && titleInput && descInput) {
        form.reset();
        heading.textContent = "Modifier la tâche";
        titleInput.value = foundCard.title || "";
        descInput.value = foundCard.description || "";
        form.dataset.editCardId = String(foundCard.id);
        form.dataset.columnId = String(foundColId);
        openModal("modal-card");
      }
      return;
    }

    // --- Action : Supprimer une carte ---
    if (action === "delete-card") {
      const cardId = target.dataset.cardId;
      const cardTitle = target.dataset.cardTitle || "cette tâche";

      showConfirmModal(
        "Supprimer la tâche",
        `Voulez-vous vraiment supprimer la tâche "${cardTitle}" ?`,
        async () => {
          try {
            // Appel API attendu : DELETE /api/cards/:id
            // Réponse attendue (204 No Content)
            await api.delete(`/cards/${cardId}`);
            showToast("Tâche supprimée avec succès.", "success");
            await refreshActiveBoard();
          } catch (err) {
            console.error("[Kando] Erreur lors de la suppression de la carte :", err);
          }
        }
      );
      return;
    }
  });
}

/**
 * Configure les écouteurs sur le header et la barre de commandes (sélection, création/suppression de tableau, recherche)
 */
function setupBoardUIEventListeners() {
  const select = document.getElementById("board-select");
  const btnNewBoard = document.getElementById("btn-new-board");
  const btnDeleteBoard = document.getElementById("btn-delete-board");
  const searchInput = document.getElementById("search-cards-input");
  const btnClearSearch = document.getElementById("btn-clear-search");

  // Changement de tableau actif via la liste déroulante
  if (select) {
    select.addEventListener("change", async (e) => {
      const newId = e.target.value;
      if (newId) {
        await selectBoard(newId);
      }
    });
  }

  // Ouverture de la modale de création de tableau
  if (btnNewBoard) {
    btnNewBoard.addEventListener("click", () => {
      const form = document.getElementById("form-board");
      if (form) form.reset();
      openModal("modal-board");
    });
  }

  // Suppression du tableau actif
  if (btnDeleteBoard) {
    btnDeleteBoard.addEventListener("click", () => {
      if (!activeBoardId || !currentBoardData) return;

      const boardTitle = currentBoardData.title || "ce tableau";

      showConfirmModal(
        "Supprimer le tableau entier",
        `Êtes-vous certain de vouloir supprimer définitivement le tableau "${boardTitle}" ainsi que toutes ses colonnes et cartes ?`,
        async () => {
          try {
            // Appel API attendu : DELETE /api/boards/:id
            // Réponse attendue (204 No Content)
            await api.delete(`/boards/${activeBoardId}`);
            showToast(`Tableau "${boardTitle}" supprimé avec succès.`, "success");

            // Recharge la liste des tableaux
            await loadUserBoards();
          } catch (err) {
            console.error("[Kando] Erreur lors de la suppression du tableau :", err);
          }
        }
      );
    });
  }

  // Bonus Recherche intégrée avec debounce de 300ms
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.trim();
      currentSearchQuery = query;

      if (btnClearSearch) {
        btnClearSearch.classList.toggle("hidden", query.length === 0);
      }

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        handleSearch(query);
      }, 300);
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      currentSearchQuery = "";
      btnClearSearch.classList.add("hidden");
      renderBoard(currentBoardData);
    });
  }
}

/**
 * Traite la recherche de cartes avec repli gracieux (Graceful Degradation)
 * 1. Tente d'appeler la route bonus backend : GET /api/boards/:id/cards?search=...
 * 2. Si le backend répond 404 (non implémenté), filtre automatiquement les cartes côté client
 *    SANS lever d'erreur bloquante dans l'interface utilisateur.
 * @param {string} query
 */
async function handleSearch(query) {
  if (!activeBoardId || !currentBoardData) return;

  // Si la recherche est vide, on réaffiche le tableau complet
  if (!query) {
    renderBoard(currentBoardData);
    return;
  }

  try {
    // 1. Tentative d'appel du point d'entrée bonus du backend
    // L'option silentFail404: true empêche l'affichage du toast d'erreur si la route n'existe pas encore
    const matchingCards = await api.get(
      `/boards/${activeBoardId}/cards?search=${encodeURIComponent(query)}`,
      { silentFail404: true }
    );

    if (Array.isArray(matchingCards)) {
      renderFilteredBoard(matchingCards, query, false);
      return;
    }
  } catch (err) {
    // Si l'erreur est un 404, on passe en mode dégradation gracieuse côté client
    if (err.status === 404) {
      performClientSideSearch(query);
      return;
    }
    console.error("[Kando Search] Erreur lors de la recherche distante :", err);
  }

  // Repli par défaut
  performClientSideSearch(query);
}

/**
 * Filtrage client des cartes si l'endpoint bonus renvoie 404
 * @param {string} query
 */
function performClientSideSearch(query) {
  if (!currentBoardData || !Array.isArray(currentBoardData.columns)) return;

  const lowerQuery = query.toLowerCase();
  const matchingCards = [];

  for (const col of currentBoardData.columns) {
    if (Array.isArray(col.cards)) {
      for (const card of col.cards) {
        const titleMatch = card.title?.toLowerCase().includes(lowerQuery);
        const descMatch = card.description?.toLowerCase().includes(lowerQuery);
        if (titleMatch || descMatch) {
          matchingCards.push({ ...card, column_id: card.column_id || col.id });
        }
      }
    }
  }

  renderFilteredBoard(matchingCards, query, true);
}

/**
 * Affiche les cartes filtrées dans le tableau avec un indicateur visuel
 * @param {Array<object>} matchingCards
 * @param {string} query
 * @param {boolean} isClientSideFallback
 */
function renderFilteredBoard(matchingCards, query, isClientSideFallback) {
  if (!currentBoardData) return;

  // Création d'une copie virtuelle du tableau ne conservant que les cartes correspondantes
  const matchingCardIds = new Set(matchingCards.map((c) => Number(c.id)));

  const filteredBoard = {
    ...currentBoardData,
    columns: currentBoardData.columns.map((col) => ({
      ...col,
      cards: (col.cards || []).filter((c) => matchingCardIds.has(Number(c.id)))
    }))
  };

  renderBoard(filteredBoard);

  // Ajout d'une notification discrète d'information sur le filtre actif
  const totalFound = matchingCards.length;
  const filterBadgeType = isClientSideFallback
    ? "Filtre local actif"
    : "Recherche serveur";

  showToast(
    `${filterBadgeType} : ${totalFound} résultat(s) pour "${query}"`,
    "info",
    2500
  );
}

/**
 * Configure les gestionnaires de soumission des formulaires des fenêtres modales
 */
function setupModalsEventListeners() {
  // Fermeture des modales au clic sur les boutons d'annulation ou la croix
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const modalId = btn.dataset.closeModal;
      if (modalId) closeModal(modalId);
    });
  });

  // Fermeture au clic sur le fond sombre de la modale
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.classList.remove("modal-open");
      }
    });
  });

  // Fermeture à la touche Échap
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      document.querySelectorAll(".modal-overlay.modal-open").forEach((m) => {
        m.classList.remove("modal-open");
      });
    }
  });

  // 1. Formulaire de création de tableau (POST /api/boards)
  const formBoard = document.getElementById("form-board");
  if (formBoard) {
    formBoard.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("board-title-input");
      const title = input?.value.trim();
      if (!title) return;

      try {
        // Appel API attendu : POST /api/boards
        // Payload attendu : { title }
        // Réponse attendue (201) : { id, title, user_id, created_at }
        const createdBoard = await api.post("/boards", { title });

        showToast(`Tableau "${createdBoard.title}" créé avec succès !`, "success");
        closeModal("modal-board");

        // Recharge les tableaux et sélectionne le nouveau
        await loadUserBoards();
        if (createdBoard?.id) {
          await selectBoard(createdBoard.id);
        }
      } catch (err) {
        console.error("[Kando Board] Erreur création de tableau :", err);
      }
    });
  }

  // 2. Formulaire de création / renommage de colonne
  const formColumn = document.getElementById("form-column");
  if (formColumn) {
    formColumn.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById("column-modal-title");
      const title = titleInput?.value.trim();
      if (!title) return;

      const editColumnId = formColumn.dataset.editColumnId;

      try {
        if (editColumnId) {
          // Mode Modification : PATCH /api/columns/:id
          // Payload attendu : { title, position } (ou partiel { title })
          // Réponse attendue (200) : colonne mise à jour
          await api.patch(`/columns/${editColumnId}`, { title });
          showToast("Colonne renommée avec succès.", "success");
        } else {
          // Mode Création : POST /api/boards/:boardId/columns
          // Payload attendu : { title, position }
          // Réponse attendue (201) : { id, title, position, board_id }
          const currentColumns = currentBoardData?.columns || [];
          const nextPosition = currentColumns.length;

          await api.post(`/boards/${activeBoardId}/columns`, {
            title,
            position: nextPosition
          });

          showToast(`Colonne "${title}" ajoutée avec succès.`, "success");
        }

        closeModal("modal-column");
        await refreshActiveBoard();
      } catch (err) {
        console.error("[Kando Column] Erreur lors de l'enregistrement de la colonne :", err);
      }
    });
  }

  // 3. Formulaire de création / édition de carte (tâche)
  const formCard = document.getElementById("form-card");
  if (formCard) {
    formCard.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titleInput = document.getElementById("card-modal-title");
      const descInput = document.getElementById("card-modal-desc");

      const title = titleInput?.value.trim();
      const description = descInput?.value.trim() || "";

      if (!title) {
        showToast("Le titre de la tâche est obligatoire.", "warning");
        return;
      }

      const editCardId = formCard.dataset.editCardId;
      const columnId = formCard.dataset.columnId;

      try {
        if (editCardId) {
          // Mode Modification : PATCH /api/cards/:id
          // Payload attendu : { title, description }
          // Réponse attendue (200) : carte mise à jour
          await api.patch(`/cards/${editCardId}`, {
            title,
            description
          });

          showToast("Tâche modifiée avec succès.", "success");
        } else {
          // Mode Création : POST /api/columns/:columnId/cards
          // Payload attendu : { title, description, position }
          // Réponse attendue (201) : { id, title, description, position, column_id, created_at }
          const targetCol = currentBoardData?.columns?.find(
            (c) => Number(c.id) === Number(columnId)
          );
          const nextPosition = targetCol?.cards ? targetCol.cards.length : 0;

          await api.post(`/columns/${columnId}/cards`, {
            title,
            description,
            position: nextPosition
          });

          showToast("Tâche ajoutée avec succès.", "success");
        }

        closeModal("modal-card");
        await refreshActiveBoard();
      } catch (err) {
        console.error("[Kando Card] Erreur lors de l'enregistrement de la tâche :", err);
      }
    });
  }
}
