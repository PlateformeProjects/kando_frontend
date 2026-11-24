# Kando - Client Frontend Officiel

> **Dépôt pédagogique en lecture seule** pour l'équipe IT de **Logitrack**.  
> Ce client web sert d'application de test officielle pour valider le développement de votre API backend Node.js / Express / PostgreSQL (Cursus B2 DEV).

---

## 1. Présentation du projet

**Kando** est une application web de gestion de tâches de type Kanban conçue pour l'organisation interne de l'équipe IT de Logitrack.

Ce frontend a été volontairement développé selon les principes suivants :
- **Zéro outil de build & zéro dépendance npm** : HTML5 sémantique, CSS3 moderne (Flexbox, Grid, variables CSS, responsive) et JavaScript pur (modules ES6+ natifs `type="module"`).
- **Compatibilité immédiate** : Fonctionne directement via l'extension **Live Server** de VS Code ou n'importe quel serveur HTTP statique.
- **Transparence réseau & feedback immédiat** : Les requêtes HTTP, les codes de statut REST (200, 201, 204, 401, 404, 500) et les messages d'erreurs renvoyés par votre API Express sont affichés en temps réel via des bandeaux de notification (toasts).

---

## 2. Démarrage rapide

### Prérequis
- Un navigateur web récent (Google Chrome, Firefox, Edge, Safari).
- Votre API backend Node.js / Express démarrée et à l'écoute sur le port `3000`.

### Méthode 1 : Avec l'extension VS Code Live Server (Recommandée)
1. Ouvrez le dossier `kando_frontend` dans VS Code.
2. Faites un clic droit sur le fichier `index.html`.
3. Cliquez sur **Open with Live Server** (raccourci par défaut : port `5500`).
4. Votre navigateur s'ouvre sur `http://127.0.0.1:5500/index.html`.

### Méthode 2 : Avec Python 3
Dans un terminal, placez-vous à la racine du projet et exécutez :
```bash
python3 -m http.server 5500
```
Puis accédez à `http://localhost:5500`.

### Méthode 3 : Avec npx
```bash
npx serve -l 5500 .
```

---

## 3. Configuration de l'URL Backend

Le fichier **`js/config.js`** est le **seul fichier** de configuration du frontend :

```javascript
export const API_BASE_URL = "http://localhost:3000/api";
```

Si votre serveur Express tourne sur un autre port ou une autre adresse IP, modifiez uniquement la constante `API_BASE_URL` dans ce fichier.

---

## 4. Spécification Complète du Contrat d'Interface REST

Votre backend Express doit scrupuleusement respecter les routes, méthodes HTTP, statuts de réponse et formats JSON suivants.

### 4.1 Authentification (`/api/auth`)

#### `POST /api/auth/register`
- **Description** : Création d'un nouveau compte utilisateur.
- **Corps de la requête (Body JSON)** :
  ```json
  {
    "username": "alex_dev",
    "email": "alex@logitrack.internal",
    "password": "Password123!"
  }
  ```
- **Code HTTP attendu** : `201 Created`
- **Charge utile retournée (JSON)** :
  ```json
  {
    "id": 1,
    "username": "alex_dev",
    "email": "alex@logitrack.internal"
  }
  ```

#### `POST /api/auth/login`
- **Description** : Connexion et délivrance du jeton JWT.
- **Corps de la requête (Body JSON)** :
  ```json
  {
    "email": "alex@logitrack.internal",
    "password": "Password123!"
  }
  ```
- **Code HTTP attendu** : `200 OK`
- **Charge utile retournée (JSON)** :
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "alex_dev",
      "email": "alex@logitrack.internal"
    }
  }
  ```

> [!IMPORTANT]
> Pour toutes les routes ci-dessous, le frontend injecte automatiquement le header suivant :  
> `Authorization: Bearer <votre_token_jwt>`

---

### 4.2 Tableaux / Boards (`/api/boards`)

#### `GET /api/boards`
- **Description** : Liste tous les tableaux appartenant à l'utilisateur connecté.
- **Code HTTP attendu** : `200 OK`
- **Charge utile retournée (JSON)** :
  ```json
  [
    {
      "id": 1,
      "title": "Roadmap Q3",
      "user_id": 1,
      "created_at": "2026-11-24T08:00:00.000Z"
    }
  ]
  ```

#### `POST /api/boards`
- **Description** : Crée un nouveau tableau pour l'utilisateur connecté.
- **Corps de la requête (Body JSON)** :
  ```json
  {
    "title": "Nouveau tableau de sprint"
  }
  ```
- **Code HTTP attendu** : `201 Created`
- **Charge utile retournée (JSON)** :
  ```json
  {
    "id": 2,
    "title": "Nouveau tableau de sprint",
    "user_id": 1,
    "created_at": "2026-11-24T09:00:00.000Z"
  }
  ```

#### `GET /api/boards/:id`
- **Description** : Récupère les données complètes d'un tableau avec ses colonnes et ses cartes imbriquées.
- **Code HTTP attendu** : `200 OK`
- **Charge utile retournée (JSON)** :
  ```json
  {
    "id": 1,
    "title": "Roadmap Q3",
    "user_id": 1,
    "columns": [
      {
        "id": 10,
        "title": "À faire",
        "position": 0,
        "board_id": 1,
        "cards": [
          {
            "id": 101,
            "title": "Installer PostgreSQL",
            "description": "Créer la base et exécuter les migrations",
            "position": 0,
            "column_id": 10,
            "created_at": "2026-11-24T08:30:00.000Z"
          }
        ]
      },
      {
        "id": 11,
        "title": "En cours",
        "position": 1,
        "board_id": 1,
        "cards": []
      }
    ]
  }
  ```
  *(Les colonnes et les cartes doivent idéalement être triées par `position` croissante côté SQL).*

#### `DELETE /api/boards/:id`
- **Description** : Supprime un tableau et supprime en cascade ses colonnes et cartes.
- **Code HTTP attendu** : `204 No Content` (aucun corps de réponse).

---

### 4.3 Colonnes (`/api/columns` et `/api/boards/:boardId/columns`)

#### `POST /api/boards/:boardId/columns`
- **Description** : Crée une colonne rattachée au tableau `:boardId`.
- **Corps de la requête (Body JSON)** :
  ```json
  {
    "title": "En revue",
    "position": 2
  }
  ```
- **Code HTTP attendu** : `201 Created`
- **Charge utile retournée (JSON)** :
  ```json
  {
    "id": 12,
    "title": "En revue",
    "position": 2,
    "board_id": 1
  }
  ```

#### `PATCH /api/columns/:id`
- **Description** : Met à jour le titre ou la position d'une colonne.
- **Corps de la requête (Body JSON)** :
  ```json
  {
    "title": "Terminé"
  }
  ```
- **Code HTTP attendu** : `200 OK`
- **Charge utile retournée (JSON)** : Colonne mise à jour.

#### `DELETE /api/columns/:id`
- **Description** : Supprime la colonne et ses cartes associées.
- **Code HTTP attendu** : `204 No Content` (aucun corps de réponse).

---

### 4.4 Cartes (`/api/cards` et `/api/columns/:columnId/cards`)

#### `POST /api/columns/:columnId/cards`
- **Description** : Crée une carte (tâche) dans la colonne `:columnId`.
- **Corps de la requête (Body JSON)** :
  ```json
  {
    "title": "Écrire les tests unitaires",
    "description": "Tester le middleware d'authentification JWT",
    "position": 0
  }
  ```
- **Code HTTP attendu** : `201 Created`
- **Charge utile retournée (JSON)** :
  ```json
  {
    "id": 102,
    "title": "Écrire les tests unitaires",
    "description": "Tester le middleware d'authentification JWT",
    "position": 0,
    "column_id": 10,
    "created_at": "2026-11-24T09:15:00.000Z"
  }
  ```

#### `PATCH /api/cards/:id`
- **Description** : Modifie le titre et/ou la description d'une carte.
- **Corps de la requête (Body JSON)** :
  ```json
  {
    "title": "Nouveau titre de tâche",
    "description": "Nouvelle description mise à jour"
  }
  ```
- **Code HTTP attendu** : `200 OK`
- **Charge utile retournée (JSON)** : Carte mise à jour.

#### `DELETE /api/cards/:id`
- **Description** : Supprime définitivement une carte.
- **Code HTTP attendu** : `204 No Content` (aucun corps de réponse).

#### `PATCH /api/cards/:id/move` (Glisser-Déposer / Drag & Drop)
- **Description** : Déplace une carte vers une autre colonne et/ou modifie son rang dans la colonne cible.
- **Corps de la requête (Body JSON)** :
  ```json
  {
    "column_id": 11,
    "position": 0
  }
  ```
  *(Les champs `column_id` et `position` sont des nombres entiers).*
- **Code HTTP attendu** : `200 OK`
- **Charge utile retournée (JSON)** : Carte mise à jour.

---

### 4.5 Recherche (Bonus avec Dégradation Gracieuse)

#### `GET /api/boards/:id/cards?search=terme`
- **Description** : Recherche plein texte dans les cartes d'un tableau (titre ou description).
- **Code HTTP attendu** : `200 OK`
- **Charge utile retournée (JSON)** : Tableau JSON des cartes correspondantes.
- **Comportement frontend en cas d'absence (`404 Not Found`)** :  
  Si votre backend ne dispose pas encore de cet endpoint bonus, le frontend l'intercepte silencieusement (sans afficher de toast d'erreur) et applique automatiquement un filtre côté client sur les données déjà chargées.

---

## 5. Arborescence des Fichiers

```text
kando_frontend/
├── index.html          # Structure HTML5 sémantique, modales et conteneurs
├── css/
│   └── style.css       # Système de design moderne (Linear/Trello), variables et animations
├── js/
│   ├── config.js       # URL de base de l'API backend Express (unique fichier paramétrable)
│   ├── api.js          # Client HTTP fetch centralisé (JWT, gestion 204/401/erreurs, toasts)
│   ├── auth.js         # Gestion des formulaires de connexion/inscription et du token
│   ├── board.js        # Logique Kanban, colonnes, cartes, Drag & Drop natif et recherche
│   └── app.js          # Chef d'orchestre : démarrage, contrôle de session et bascule de vues
└── README.md           # Documentation officielle et contrat d'interface REST
```

---

## 6. Conseils de Débogage & Pièges Fréquents (Backend)

1. **Configuration CORS dans Express** :  
   Pour autoriser les requêtes venant de Live Server (`http://127.0.0.1:5500`), n'oubliez pas d'installer et activer le middleware `cors` :
   ```javascript
   import cors from "cors";
   app.use(cors());
   ```

2. **Parser JSON dans Express** :  
   Assurez-vous d'avoir déclaré le middleware pour lire les corps de requêtes JSON :
   ```javascript
   app.use(express.json());
   ```

3. **Format des réponses d'erreur** :  
   Pour que le client Kando affiche clairement vos messages d'erreurs en rouge dans les toasts, renvoyez vos erreurs sous la forme :
   ```javascript
   res.status(400).json({ error: "Description détaillée de l'erreur" });
   // ou
   res.status(400).json({ message: "Description détaillée de l'erreur" });
   ```

4. **Statuts HTTP de suppression (204)** :  
   Lors d'une suppression réussie, terminez votre route avec `res.status(204).send()` ou `res.sendStatus(204)` sans envoyer de corps JSON.

5. **Gestion du token JWT** :  
   Dans votre middleware d'authentification, extrayez le token depuis l'en-tête :
   ```javascript
   const authHeader = req.headers.authorization;
   const token = authHeader && authHeader.split(" ")[1];
   ```
   Si le token est invalide ou expiré, renvoyez impérativement le code HTTP `401 Unauthorized`.
