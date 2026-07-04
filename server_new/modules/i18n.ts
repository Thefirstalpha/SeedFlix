interface Translation {
    tmdb: {
        invalidResponse: string;
        apiKeyNotSet: string;
    };
    common: {
    };
    auth: {
        userNotFound: any;
        cannotModifyAdmin: any;
        usernameRequired: string;
        authRequired: string;
        adminRequired: string;
        failedReadSession: string;
        usernamePasswordRequired: string;
        invalidCredentials: string;
        usernameAlreadyExists: string;
    };
    settings: {
        failedUpdateSettings: any;
        failedLoadSettings: any;
        transmission: {
            actionFailed: string;
            invalidUrl: string;
            authFailed: string;
        }
        failedUpdate: string;
    };
}


const messagesList: Record<string, Translation> = {
    fr: {
        tmdb: {
            apiKeyNotSet: "La clé API de TMDB n'est pas configurée. Veuillez la définir dans les paramètres globaux.",
            invalidResponse: "Réponse invalide de TMDB"
        },
        common: {
        },
        auth: {
            authRequired: 'Authentification requise',
            adminRequired: 'Privilèges administrateur requis',
            failedReadSession: 'Impossible de lire la session',
            usernamePasswordRequired: "Nom d'utilisateur et mot de passe requis",
            invalidCredentials: 'Identifiants invalides',
            usernameRequired: "Nom d'utilisateur requis",
            usernameAlreadyExists: "Ce nom d'utilisateur existe déjà.",
            cannotModifyAdmin: "Impossible de modifier le compte administrateur",
            userNotFound: "Utilisateur non trouvé"
        },
        settings: {
            transmission: {
                authFailed: "Échec de l'authentification avec Transmission. Veuillez vérifier vos paramètres.",
                invalidUrl: "URL Transmission invalide",
                actionFailed: "Échec de l'action."

            },
            failedUpdate: 'Échec de la mise à jour des paramètres',
            failedLoadSettings: "Impossible de charger les paramètres"
        }
    },
    en: {
        tmdb: {
            apiKeyNotSet: "TMDB API key is not set. Please configure it in the global settings.",
            invalidResponse: "Invalid response from TMDB"
        },
        common: {
        },
        auth: {
            authRequired: 'Authentication required',
            adminRequired: 'Admin privileges required',
            failedReadSession: 'Failed to read session',
            usernamePasswordRequired: 'Username and password are required',
            invalidCredentials: 'Invalid credentials',
            usernameRequired: 'Username is required',
            usernameAlreadyExists: 'Username already exists',
            cannotModifyAdmin: 'Cannot modify admin account',
            userNotFound: 'User not found'
        },
        settings: {
            transmission: {
                authFailed: 'Failed to authenticate with Transmission. Please check your settings.',
                invalidUrl: 'Invalid Transmission URL',
                actionFailed: 'Failed to perform action.'
            },
            failedUpdate: 'Failed to update settings',
            failedLoadSettings: 'Failed to load settings'
        }
    },
};

let currentLanguage = 'en';
let currentMessages: Translation = messagesList[currentLanguage];

export let messages = currentMessages;