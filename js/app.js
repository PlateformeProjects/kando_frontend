/**
 * Kando - Point d'Entrée Principal (Application Orchestrator)
 * Initialise l'application, gère les bascules de vues (Auth vs Kanban) et écoute les événements de session.
 *
 * RÔLE PÉDAGOGIQUE POUR LES ÉTUDIANTS B2 DEV :
 * Ce module coordonne les modules 'auth.js' et 'board.js' :
 * 1. Vérifie la présence du token JWT au démarrage de la page.
 * 2. Si le token est présent : affiche le header et le tableau Kanban, charge les tableaux de l'utilisateur.
 * 3. Si aucun token n'est trouvé : affiche l'écran de connexion / inscription.
 * 4. Réagit aux événements de connexion, déconnexion et expiration de session (401).
 */

import { initAuth, isAuthenticated, getCurrentUser, switchAuthTab } from "./auth.js";
import { initBoard, loadUserBoards, resetBoardState } from "./board.js";

/**
 * Met à jour l'affichage de l'interface en fonction de l'état de connexion de l'utilisateur
 * @param {boolean} loggedIn
 */
function updateAppView(loggedIn) {
  const authView = document.getElementById("auth-view");
  const mainApp = document.getElementById("kanban-app");
  const appHeader = document.getElementById("app-header");
  const userDisplay = document.getElementById("user-display");

  if (loggedIn) {
    // Mode connecté : affichage du header et de l'espace Kanban
    if (authView) authView.classList.add("hidden");
    if (mainApp) mainApp.classList.remove("hidden");
    if (appHeader) appHeader.classList.remove("hidden");

    // Affichage des informations de l'utilisateur connecté
    const user = getCurrentUser();
    if (userDisplay && user) {
      userDisplay.textContent = user.username || user.email || "Utilisateur";
      userDisplay.title = user.email ? `Connecté avec ${user.email}` : "";
    }
  } else {
    // Mode déconnecté : affichage exclusif du formulaire d'authentification
    if (authView) authView.classList.remove("hidden");
    if (mainApp) mainApp.classList.add("hidden");
    if (appHeader) appHeader.classList.add("hidden");

    if (userDisplay) {
      userDisplay.textContent = "";
    }

    // Bascule par défaut sur l'onglet de connexion
    switchAuthTab("login");
  }
}

/**
 * Configure les abonnements aux événements personnalisés de cycle de vie de l'application
 */
function setupGlobalEventSubscriptions() {
  // 1. Événement déclenché après une connexion réussie (POST /api/auth/login)
  window.addEventListener("kando:login-success", async (e) => {
    updateAppView(true);
    await loadUserBoards();
  });

  // 2. Événement déclenché lors d'une déconnexion volontaire
  window.addEventListener("kando:logout", () => {
    resetBoardState();
    updateAppView(false);
  });

  // 3. Événement déclenché lors de la réception d'un code HTTP 401 Unauthorized
  window.addEventListener("kando:auth-expired", () => {
    resetBoardState();
    updateAppView(false);
  });
}

/**
 * Fonction de démarrage exécutée dès le chargement complet du DOM
 */
async function bootstrap() {
  console.log("[Kando] Démarrage du client frontend officiel...");

  // Initialisation des modules métier
  initAuth();
  initBoard();
  setupGlobalEventSubscriptions();

  // Contrôle de l'état initial d'authentification
  if (isAuthenticated()) {
    updateAppView(true);
    await loadUserBoards();
  } else {
    updateAppView(false);
  }
}

// Lancement automatique au chargement du document
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
