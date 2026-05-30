# Rapport de Présentation : Système de Suivi de Production (ScanTrack)

## 1. Vue d'Ensemble
L'application **ScanTrack** est une solution full-stack dédiée au contrôle de la production en usine. Elle permet de gérer le cycle de vie des Ordres de Fabrication (OF), du chargement des données à la clôture de la production, tout en assurant une traçabilité totale via le scan de numéros de série.

---

## 2. Guide des Interfaces et Fonctionnement

### A. Interface Opérateur (Poste de Scan)
C'est le cœur opérationnel de l'application. Elle a été conçue pour être **rapide, intuitive et anti-erreur**.

*   **Menu de Sélection** : L'opérateur sélectionne son OF via un menu déroulant filtré. Les OF terminés ou avec une quantité de "0" ne sont pas affichés.
*   **Champ de Scan** : Un champ de saisie focalisé attend le scan du code-barres.
*   **Sécurité des Plages (SN Range)** : 
    *   *Fonctionnement* : Le système vérifie en arrière-plan si le numéro scanné appartient à la plage définie par l'ingénierie.
    *   *Confidentialité* : Si un scan échoue, l'opérateur reçoit un message "CODE NON AUTORISÉ", sans voir les limites de la plage, garantissant ainsi l'intégrité du processus.

### B. Interface Superviseur (Gestion de Production)
C'est l'outil de pilotage pour le chef d'atelier.

*   **Importation Massive** : Via le bouton "Importer CSV", le superviseur peut charger les ordres de production. Le système valide automatiquement le contenu (OF, Référence, Quantité).
*   **Gestion des Etats** : 
    *   **En attente** : OF importé mais pas encore commencé.
    *   **En Production** : OF dont au moins une unité a été scannée.
    *   **Clôturé** : OF dont l'objectif de quantité est atteint.

### C. Dashboard KPI (Analytique)
Un tableau de bord visuel pour une lecture immédiate de la performance.

*   **Compteurs Globaux** : Visualisation instantanée des OF Clôturés, En Production et En Attente.
*   **Tendances de Production** : Un graphique linéaire suit le nombre de scans effectués sur les 7 derniers jours, permettant d'identifier les pics de charge ou les ralentissements.

### D. Interface Engineering (Configuration Critique)
L'espace réservé aux experts pour le paramétrage "Master".

*   **Contrôle d'Accès** : Section sécurisée pour modifier le mot de passe d'accès.
*   **Bornes de Sécurité** : Définition des numéros `Start SN` et `End SN`. Ces valeurs sont les garde-fous qui bloquent les mauvais scans sur les postes opérateurs.

---

## 3. Flux Logique du Système

1.  **Engineering** : Définit les plages de sécurité (ex: 50000 à 60000).
2.  **Superviseur** : Importe le fichier CSV des commandes du jour.
3.  **Opérateur** : Sélectionne un OF et commence à scanner les unités produites. Le système valide chaque unité par rapport à la plage de l'étape 1.
4.  **KPI Dashboard** : Se met à jour en temps réel pour montrer l'avancement au management.

---

## 4. Sécurité des Données
Toutes les données sont stockées de manière persistante, assurant que même en cas de coupure de courant ou de redémarrage, les scans effectués ne sont jamais perdus.
