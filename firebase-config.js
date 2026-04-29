// ============================================
// CONFIGURACIÓN DE FIREBASE
// REEMPLAZA CON TUS CREDENCIALES
// ============================================
const firebaseConfig = {
    apiKey: "AIzaSyBBoTE1u5M7td8S3hEGVLj4klFaVx505_U",
    authDomain: "myapptotal-f9e6b.firebaseapp.com",
    databaseURL: "https://myapptotal-f9e6b-default-rtdb.firebaseio.com",
    projectId: "myapptotal-f9e6b",
    storageBucket: "myapptotal-f9e6b.firebasestorage.app",
    messagingSenderId: "544522512133",
    appId: "1:544522512133:web:9a41b3b666bda84bcdb96c"
  };


// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Configurar persistencia
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

// ============================================
// COLECCIONES DE FIRESTORE
// ============================================
const COLLECTIONS = {
    MOVIES: 'movies',
    SERIES: 'series',
    EPISODES: 'episodes',
    USERS: 'users',
    FAVORITES: 'favorites',
    ADS: 'ads',
    LIVE_TV: 'live_tv',
    GENRES: 'genres',
    VIEWS: 'views',
    SETTINGS: 'settings'
};

// ============================================
// CONFIGURACIÓN GLOBAL
// ============================================
window.APP_CONFIG = {
    TMDB_API_KEY: 'T94d4e745c1b3af17c9fcd4aaa1fe8751',
    TMDB_IMAGE_BASE: 'https://image.tmdb.org/t/p/w500',
    TMDB_BACKDROP_BASE: 'https://image.tmdb.org/t/p/original',
    SITE_NAME: 'StreamFlix',
    ADS_ENABLED: true,
    ADS_INTERVAL: 30000
};

// ============================================
// FUNCIÓN DE NOTIFICACIÓN GLOBAL
// ============================================
window.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

// ============================================
// GENERAR KEYWORDS PARA BÚSQUEDA
// ============================================
function generateKeywords(title) {
    if (!title) return [];
    const words = title.toLowerCase().split(' ');
    const keywords = [];
    
    for (let i = 0; i < words.length; i++) {
        let phrase = '';
        for (let j = i; j < words.length; j++) {
            phrase += (j > i ? ' ' : '') + words[j];
            keywords.push(phrase);
        }
    }
    
    return keywords;
}

window.generateKeywords = generateKeywords;

// ============================================
// ESCAPAR HTML
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.escapeHtml = escapeHtml;