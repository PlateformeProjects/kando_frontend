/**
 * Kando - Module d'Authentification
 * Gère l'inscription, la connexion, la déconnexion et la persistance de session JWT.
 * Supporte le stockage isolé pour le mode Démo autonome.
 *
 * RÔLE PÉDAGOGIQUE POUR LES ÉTUDIANTS B2 DEV :
 * - Appelle les routes POST /api/auth/register et POST /api/auth/login.
 * - Stocke le token JWT et les informations utilisateur dans le localStorage.
 * - Fournit les mécanismes de bascule d'onglets (Connexion / Inscription) et de déconnexion.
 */

import { api, showToast, isDemoMode } from "./api.js";

/**
 * Retourne les clés de stockage selon le mode actif (standard vs démo)
 */
export function getStorageKeys() {
  if (isDemoMode()) {
    return {
      TOKEN: "kando_demo_token",
      USER: "kando_demo_user"
    };
  }
  return {
    TOKEN: "kando_token",
    USER: "kando_user"
  };
}

/**
 * Clés de stockage par défaut
 */
export const STORAGE_KEYS = {
  TOKEN: "kando_token",
  USER: "kando_user"
};

/**
 * Vérifie si un utilisateur est actuellement authentifié
 * @returns {boolean}
 */
export function isAuthenticated() {
  const keys = getStorageKeys();
  return Boolean(localStorage.getItem(keys.TOKEN));
}

/**
 * Récupère l'objet utilisateur actuellement connecté
 * @returns {{ id: number, username: string, email: string } | null}
 */
export function getCurrentUser() {
  const keys = getStorageKeys();
  const userJson = localStorage.getItem(keys.USER);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson);
  } catch {
    return null;
  }
}

/**
 * Déconnecte l'utilisateur en cours, nettoie le stockage local et déclenche l'événement global
 */
export function logout() {
  const keys = getStorageKeys();
  localStorage.removeItem(keys.TOKEN);
  localStorage.removeItem(keys.USER);

  showToast("Vous avez été déconnecté avec succès.", "info");

  // Notification globale pour réinitialiser la vue vers l'authentification
  window.dispatchEvent(new CustomEvent("kando:logout"));
}

/**
 * Bascule l'affichage entre les onglets 'login' et 'register'
 * @param {'login' | 'register'} tabName
 */
export function switchAuthTab(tabName) {
  const tabLogin = document.getElementById("tab-login-btn");
  const tabRegister = document.getElementById("tab-register-btn");
  const formLogin = document.getElementById("form-login");
  const formRegister = document.getElementById("form-register");

  if (!tabLogin || !tabRegister || !formLogin || !formRegister) return;

  if (tabName === "register") {
    tabLogin.classList.remove("active");
    tabRegister.classList.add("active");
    formLogin.classList.add("hidden");
    formRegister.classList.remove("hidden");
    const regUsername = document.getElementById("register-username");
    if (regUsername) regUsername.focus();
  } else {
    tabRegister.classList.remove("active");
    tabLogin.classList.add("active");
    formRegister.classList.add("hidden");
    formLogin.classList.remove("hidden");
    const loginEmail = document.getElementById("login-email");
    if (loginEmail) loginEmail.focus();
  }
}

/**
 * Initialise les écouteurs d'événements pour les formulaires de connexion et d'inscription
 */
export function initAuth() {
  const formLogin = document.getElementById("form-login");
  const formRegister = document.getElementById("form-register");
  const tabLoginBtn = document.getElementById("tab-login-btn");
  const tabRegisterBtn = document.getElementById("tab-register-btn");
  const logoutBtn = document.getElementById("btn-logout");
  const demoQuickLoginBtn = document.getElementById("btn-demo-quick-login");

  // 1. Gestion des clics sur les onglets
  if (tabLoginBtn) {
    tabLoginBtn.addEventListener("click", () => switchAuthTab("login"));
  }
  if (tabRegisterBtn) {
    tabRegisterBtn.addEventListener("click", () => switchAuthTab("register"));
  }

  // 2. Bouton de déconnexion dans le header
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  // 3. Bouton optionnel de connexion rapide en mode démo
  if (demoQuickLoginBtn) {
    demoQuickLoginBtn.addEventListener("click", () => {
      const keys = getStorageKeys();
      const demoUser = {
        id: 1,
        username: "alex_dev",
        email: "alex@logitrack.internal"
      };
      localStorage.setItem(keys.TOKEN, "kando-demo-jwt-token");
      localStorage.setItem(keys.USER, JSON.stringify(demoUser));

      showToast("Connexion démo rapide réussie.", "success");
      window.dispatchEvent(
        new CustomEvent("kando:login-success", {
          detail: { user: demoUser, token: "kando-demo-jwt-token" }
        })
      );
    });
  }

  // 4. Soumission du formulaire d'inscription (POST /api/auth/register)
  if (formRegister) {
    formRegister.addEventListener("submit", async (e) => {
      e.preventDefault();

      const usernameInput = document.getElementById("register-username");
      const emailInput = document.getElementById("register-email");
      const passwordInput = document.getElementById("register-password");
      const submitBtn = formRegister.querySelector('button[type="submit"]');

      const username = usernameInput?.value.trim();
      const email = emailInput?.value.trim();
      const password = passwordInput?.value;

      if (!username || !email || !password) {
        showToast("Veuillez renseigner tous les champs requis.", "warning");
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset.originalText = submitBtn.textContent;
          submitBtn.textContent = "Création du compte...";
        }

        const createdUser = await api.post("/auth/register", {
          username,
          email,
          password
        });

        showToast(
          `Compte créé avec succès pour ${createdUser.username || username} ! Vous pouvez maintenant vous connecter.`,
          "success",
          5000
        );

        formRegister.reset();
        switchAuthTab("login");

        const loginEmailInput = document.getElementById("login-email");
        const loginPasswordInput = document.getElementById("login-password");
        if (loginEmailInput) {
          loginEmailInput.value = email;
        }
        if (loginPasswordInput) {
          loginPasswordInput.focus();
        }
      } catch (err) {
        console.error("[Kando Auth] Erreur lors de l'inscription :", err);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || "S'inscrire";
        }
      }
    });
  }

  // 5. Soumission du formulaire de connexion (POST /api/auth/login)
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();

      const emailInput = document.getElementById("login-email");
      const passwordInput = document.getElementById("login-password");
      const submitBtn = formLogin.querySelector('button[type="submit"]');

      const email = emailInput?.value.trim();
      const password = passwordInput?.value;

      if (!email || !password) {
        showToast("Veuillez saisir votre email et votre mot de passe.", "warning");
        return;
      }

      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.dataset.originalText = submitBtn.textContent;
          submitBtn.textContent = "Connexion en cours...";
        }

        const data = await api.post("/auth/login", {
          email,
          password
        });

        if (!data || !data.token) {
          throw new Error("Réponse invalide du serveur : token JWT manquant.");
        }

        const keys = getStorageKeys();
        localStorage.setItem(keys.TOKEN, data.token);

        const userPayload = data.user || {
          id: data.id || null,
          email: email,
          username: data.username || email.split("@")[0]
        };
        localStorage.setItem(keys.USER, JSON.stringify(userPayload));

        showToast(
          `Connexion réussie. Bienvenue sur Kando, ${userPayload.username} !`,
          "success"
        );

        formLogin.reset();

        window.dispatchEvent(
          new CustomEvent("kando:login-success", {
            detail: { user: userPayload, token: data.token }
          })
        );
      } catch (err) {
        console.error("[Kando Auth] Erreur lors de la connexion :", err);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || "Se connecter";
        }
      }
    });
  }
}
