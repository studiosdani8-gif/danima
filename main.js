// ============================================
// VARIABLES GLOBALES
// ============================================
let favorites = new Set();
let adsList = [];
let adInterval = null;
let currentAdIndex = 0;

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (!path.includes('login.html') && !path.includes('admin.html')) {
        loadInitialData();
    }
    setupGlobalEventListeners();
});

async function loadInitialData() {
    await Promise.all([
        loadPopularMovies(),
        loadPopularSeries(),
        loadLatestContent(),
        loadUserFavorites(),
        loadAds(),
        loadHeroContent(),
        loadGenres(),
        loadViewHistory()
    ]);
    startAdRotation();
}

// ============================================
// CARGAR PELÍCULAS POPULARES
// ============================================
async function loadPopularMovies() {
    try {
        const snapshot = await db.collection(COLLECTIONS.MOVIES)
            .where('popular', '==', true)
            .limit(10)
            .get();
        
        const container = document.getElementById('popularMovies');
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="no-results">No hay películas populares</div>';
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const movie = { id: doc.id, ...doc.data() };
            container.appendChild(createMovieCard(movie));
        });
    } catch (error) {
        console.error('Error loading popular movies:', error);
    }
}

// ============================================
// CARGAR SERIES POPULARES
// ============================================
async function loadPopularSeries() {
    try {
        const snapshot = await db.collection(COLLECTIONS.SERIES)
            .where('popular', '==', true)
            .limit(10)
            .get();
        
        const container = document.getElementById('popularSeries');
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="no-results">No hay series populares</div>';
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const series = { id: doc.id, ...doc.data() };
            container.appendChild(createSeriesCard(series));
        });
    } catch (error) {
        console.error('Error loading popular series:', error);
    }
}

// ============================================
// CARGAR ÚLTIMOS CONTENIDOS
// ============================================
async function loadLatestContent() {
    try {
        const moviesSnapshot = await db.collection(COLLECTIONS.MOVIES)
            .orderBy('createdAt', 'desc')
            .limit(6)
            .get();
        
        const seriesSnapshot = await db.collection(COLLECTIONS.SERIES)
            .orderBy('createdAt', 'desc')
            .limit(4)
            .get();
        
        const container = document.getElementById('latestContent');
        if (!container) return;
        
        container.innerHTML = '';
        
        moviesSnapshot.forEach(doc => {
            const movie = { id: doc.id, ...doc.data(), type: 'movie' };
            container.appendChild(createContentCard(movie));
        });
        
        seriesSnapshot.forEach(doc => {
            const series = { id: doc.id, ...doc.data(), type: 'series' };
            container.appendChild(createContentCard(series));
        });
    } catch (error) {
        console.error('Error loading latest content:', error);
    }
}

// ============================================
// CREAR TARJETA DE PELÍCULA
// ============================================
function createMovieCard(movie) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.setAttribute('data-id', movie.id);
    card.setAttribute('data-type', 'movie');
    
    const isFavorite = favorites.has(movie.id);
    const posterUrl = movie.posterUrl || 'https://via.placeholder.com/300x450';
    const title = movie.title || 'Sin título';
    const rating = movie.rating || 'N/A';
    const year = movie.year || 'N/A';
    const duration = movie.duration || 'N/A';
    const description = movie.description ? movie.description.substring(0, 100) : 'Sin descripción';
    const genres = movie.genres || [];
    const quality = movie.quality || '';
    
    card.innerHTML = `
        <div class="card-poster">
            <img src="${posterUrl}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x450'">
            <div class="card-overlay">
                <button class="play-btn" onclick="playContent('${movie.id}', 'movie', event)">
                    <i class="fas fa-play"></i> Reproducir
                </button>
                <button class="fav-btn ${isFavorite ? 'active' : ''}" onclick="toggleFavorite('${movie.id}', 'movie', event)">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            ${quality ? `<span class="quality-badge">${escapeHtml(quality)}</span>` : ''}
        </div>
        <div class="card-info">
            <h3>${escapeHtml(title)}</h3>
            <div class="card-meta">
                <span><i class="fas fa-star"></i> ${rating}</span>
                <span><i class="fas fa-calendar"></i> ${year}</span>
                <span><i class="fas fa-clock"></i> ${duration}</span>
            </div>
            <p class="card-description">${escapeHtml(description)}...</p>
            <div class="card-genres">
                ${genres.map(genre => `<span class="genre-tag">${escapeHtml(genre)}</span>`).join('')}
            </div>
        </div>
    `;
    
    return card;
}

// ============================================
// CREAR TARJETA DE SERIE
// ============================================
function createSeriesCard(series) {
    const card = document.createElement('div');
    card.className = 'content-card';
    card.setAttribute('data-id', series.id);
    card.setAttribute('data-type', 'series');
    
    const isFavorite = favorites.has(series.id);
    const posterUrl = series.posterUrl || 'https://via.placeholder.com/300x450';
    const title = series.title || 'Sin título';
    const rating = series.rating || 'N/A';
    const year = series.year || 'N/A';
    const seasons = series.seasons || 1;
    const description = series.description ? series.description.substring(0, 100) : 'Sin descripción';
    const genres = series.genres || [];
    const totalEpisodes = series.totalEpisodes || 0;
    
    card.innerHTML = `
        <div class="card-poster">
            <img src="${posterUrl}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x450'">
            <div class="card-overlay">
                <button class="play-btn" onclick="playContent('${series.id}', 'series', event)">
                    <i class="fas fa-play"></i> Ver Serie
                </button>
                <button class="fav-btn ${isFavorite ? 'active' : ''}" onclick="toggleFavorite('${series.id}', 'series', event)">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
            <span class="episodes-badge">${totalEpisodes} episodios</span>
        </div>
        <div class="card-info">
            <h3>${escapeHtml(title)}</h3>
            <div class="card-meta">
                <span><i class="fas fa-star"></i> ${rating}</span>
                <span><i class="fas fa-calendar"></i> ${year}</span>
                <span><i class="fas fa-list"></i> ${seasons} temporada${seasons !== 1 ? 's' : ''}</span>
            </div>
            <p class="card-description">${escapeHtml(description)}...</p>
            <div class="card-genres">
                ${genres.map(genre => `<span class="genre-tag">${escapeHtml(genre)}</span>`).join('')}
            </div>
        </div>
    `;
    
    return card;
}

// ============================================
// CREAR TARJETA GENÉRICA
// ============================================
function createContentCard(content) {
    if (content.type === 'movie') {
        return createMovieCard(content);
    } else {
        return createSeriesCard(content);
    }
}

// ============================================
// REPRODUCIR CONTENIDO
// ============================================
window.playContent = async function(contentId, contentType, event) {
    if (event) event.stopPropagation();
    
    const modal = document.getElementById('videoModal');
    const videoFrame = document.getElementById('videoFrame');
    
    if (!modal || !videoFrame) {
        console.error('Modal no encontrado');
        return;
    }
    
    try {
        let videoUrl = '';
        let title = '';
        
        if (contentType === 'movie') {
            const movieDoc = await db.collection(COLLECTIONS.MOVIES).doc(contentId).get();
            if (movieDoc.exists) {
                videoUrl = movieDoc.data().videoUrl;
                title = movieDoc.data().title;
            }
        } else if (contentType === 'series') {
            const episodesSnapshot = await db.collection(COLLECTIONS.EPISODES)
                .where('seriesId', '==', contentId)
                .orderBy('season')
                .orderBy('episode')
                .limit(1)
                .get();
            
            if (!episodesSnapshot.empty) {
                videoUrl = episodesSnapshot.docs[0].data().videoUrl;
                const seriesDoc = await db.collection(COLLECTIONS.SERIES).doc(contentId).get();
                title = seriesDoc.data().title;
            } else {
                showNotification('No hay episodios disponibles', 'error');
                return;
            }
        }
        
        if (videoUrl) {
            videoUrl = convertToEmbedUrl(videoUrl);
            videoFrame.src = videoUrl;
            modal.style.display = 'block';
            
            if (currentUser) {
                await db.collection(COLLECTIONS.VIEWS).add({
                    contentId: contentId,
                    contentType: contentType,
                    title: title,
                    userId: currentUser.uid,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
                loadViewHistory();
            }
        } else {
            showNotification('Video no disponible', 'error');
        }
    } catch (error) {
        console.error('Error playing content:', error);
        showNotification('Error al reproducir el contenido', 'error');
    }
};

// ============================================
// CONVERTIR URL A EMBED
// ============================================
function convertToEmbedUrl(url) {
    if (!url) return '';
    
    if (url.includes('youtube.com/watch?v=')) {
        const videoId = url.split('v=')[1].split('&')[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }
    
    if (url.includes('youtu.be/')) {
        const videoId = url.split('youtu.be/')[1].split('?')[0];
        return `https://www.youtube.com/embed/${videoId}`;
    }
    
    if (url.includes('vimeo.com/')) {
        const videoId = url.split('vimeo.com/')[1].split('?')[0];
        return `https://player.vimeo.com/video/${videoId}`;
    }
    
    if (url.includes('drive.google.com')) {
        const fileId = url.match(/[-\w]{25,}/);
        if (fileId) {
            return `https://drive.google.com/file/d/${fileId[0]}/preview`;
        }
    }
    
    return url;
}

// ============================================
// ALTERNAR FAVORITO
// ============================================
window.toggleFavorite = async function(contentId, contentType, event) {
    if (event) event.stopPropagation();
    
    if (!currentUser) {
        showNotification('Inicia sesión para agregar a favoritos', 'info');
        return;
    }
    
    try {
        const favoriteId = `${currentUser.uid}_${contentId}`;
        const favoriteRef = db.collection(COLLECTIONS.FAVORITES).doc(favoriteId);
        const favoriteDoc = await favoriteRef.get();
        
        if (favoriteDoc.exists) {
            await favoriteRef.delete();
            favorites.delete(contentId);
            showNotification('Eliminado de favoritos', 'info');
        } else {
            await favoriteRef.set({
                id: favoriteId,
                userId: currentUser.uid,
                contentId: contentId,
                contentType: contentType,
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            favorites.add(contentId);
            showNotification('Agregado a favoritos', 'success');
        }
        
        const button = event?.target?.closest('.fav-btn');
        if (button) {
            const isFav = favorites.has(contentId);
            button.classList.toggle('active', isFav);
        }
        
        if (window.location.pathname.includes('favorites.html')) {
            location.reload();
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        showNotification('Error al actualizar favoritos', 'error');
    }
};

// ============================================
// CARGAR FAVORITOS DEL USUARIO
// ============================================
async function loadUserFavorites() {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.collection(COLLECTIONS.FAVORITES)
            .where('userId', '==', currentUser.uid)
            .get();
        
        favorites.clear();
        snapshot.forEach(doc => {
            favorites.add(doc.data().contentId);
        });
    } catch (error) {
        console.error('Error loading favorites:', error);
    }
}

// ============================================
// CARGAR HISTORIAL DE VISTAS
// ============================================
async function loadViewHistory() {
    const container = document.getElementById('viewHistory');
    if (!container || !currentUser) return;
    
    try {
        const snapshot = await db.collection(COLLECTIONS.VIEWS)
            .where('userId', '==', currentUser.uid)
            .orderBy('timestamp', 'desc')
            .limit(20)
            .get();
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="no-results">No hay historial de visualizaciones</div>';
            return;
        }
        
        container.innerHTML = '';
        for (const doc of snapshot.docs) {
            const view = doc.data();
            let content = null;
            
            if (view.contentType === 'movie') {
                const contentDoc = await db.collection(COLLECTIONS.MOVIES).doc(view.contentId).get();
                if (contentDoc.exists) {
                    content = { id: contentDoc.id, ...contentDoc.data(), type: 'movie' };
                }
            } else {
                const contentDoc = await db.collection(COLLECTIONS.SERIES).doc(view.contentId).get();
                if (contentDoc.exists) {
                    content = { id: contentDoc.id, ...contentDoc.data(), type: 'series' };
                }
            }
            
            if (content) {
                const item = document.createElement('div');
                item.className = 'history-item';
                item.onclick = () => playContent(content.id, content.type);
                item.innerHTML = `
                    <img src="${content.posterUrl || 'https://via.placeholder.com/60x90'}" alt="${escapeHtml(content.title)}">
                    <div>
                        <h4>${escapeHtml(content.title)}</h4>
                        <p>${content.type === 'movie' ? 'Película' : 'Serie'} • ${view.timestamp?.toDate().toLocaleDateString()}</p>
                    </div>
                `;
                container.appendChild(item);
            }
        }
    } catch (error) {
        console.error('Error loading view history:', error);
    }
}

// ============================================
// CARGAR GÉNEROS
// ============================================
async function loadGenres() {
    try {
        const snapshot = await db.collection(COLLECTIONS.GENRES).get();
        const container = document.getElementById('genresList');
        
        if (container) {
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const genre = doc.data();
                const tag = document.createElement('a');
                tag.href = `pages/search.html?genre=${encodeURIComponent(genre.name)}`;
                tag.className = 'genre-tag';
                tag.innerHTML = `<i class="${genre.icon || 'fas fa-tag'}"></i> ${escapeHtml(genre.name)}`;
                container.appendChild(tag);
            });
        }
    } catch (error) {
        console.error('Error loading genres:', error);
    }
}

// ============================================
// CARGAR CONTENIDO DEL HERO
// ============================================
async function loadHeroContent() {
    try {
        const snapshot = await db.collection(COLLECTIONS.MOVIES)
            .where('featured', '==', true)
            .limit(1)
            .get();
        
        const heroSection = document.getElementById('heroSection');
        const heroTitle = document.getElementById('heroTitle');
        const heroDescription = document.getElementById('heroDescription');
        const heroBtn = document.getElementById('heroBtn');
        
        if (!snapshot.empty) {
            const movie = snapshot.docs[0].data();
            const movieId = snapshot.docs[0].id;
            
            if (heroSection && movie.backdropUrl) {
                heroSection.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${movie.backdropUrl})`;
                heroSection.style.backgroundSize = 'cover';
                heroSection.style.backgroundPosition = 'center';
            }
            if (heroTitle) heroTitle.textContent = movie.title || 'Bienvenido a StreamFlix';
            if (heroDescription) heroDescription.textContent = movie.description ? movie.description.substring(0, 150) + '...' : 'Las mejores películas y series en un solo lugar';
            if (heroBtn) heroBtn.onclick = () => playContent(movieId, 'movie');
        } else if (heroSection) {
            heroSection.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            if (heroTitle) heroTitle.textContent = 'Bienvenido a StreamFlix';
            if (heroDescription) heroDescription.textContent = 'Las mejores películas y series en un solo lugar';
        }
    } catch (error) {
        console.error('Error loading hero:', error);
    }
}

// ============================================
// CARGAR ANUNCIOS
// ============================================
async function loadAds() {
    try {
        const snapshot = await db.collection(COLLECTIONS.ADS)
            .where('active', '==', true)
            .get();
        
        adsList = [];
        snapshot.forEach(doc => {
            adsList.push({ id: doc.id, ...doc.data() });
        });
        
        const settingsDoc = await db.collection(COLLECTIONS.SETTINGS).doc('ads').get();
        if (settingsDoc.exists) {
            window.APP_CONFIG.ADS_ENABLED = settingsDoc.data().enabled !== false;
            window.APP_CONFIG.ADS_INTERVAL = (settingsDoc.data().interval || 30) * 1000;
        }
    } catch (error) {
        console.error('Error loading ads:', error);
    }
}

// ============================================
// MOSTRAR ANUNCIO
// ============================================
function showAd() {
    if (!window.APP_CONFIG.ADS_ENABLED || adsList.length === 0) return;
    
    const ad = adsList[currentAdIndex % adsList.length];
    currentAdIndex++;
    
    const adContainer = document.getElementById('adContainer');
    if (adContainer) {
        const existingAd = adContainer.querySelector('.floating-ad');
        if (existingAd) existingAd.remove();
        
        const adElement = document.createElement('div');
        adElement.className = 'floating-ad';
        adElement.innerHTML = `
            <button class="close-ad" onclick="this.parentElement.remove()">✕</button>
            <a href="${ad.link || '#'}" target="${ad.newTab ? '_blank' : '_self'}">
                <img src="${ad.imageUrl}" alt="${escapeHtml(ad.title)}">
                <div class="ad-content">
                    <h4>${escapeHtml(ad.title)}</h4>
                    <p>${escapeHtml(ad.description || '')}</p>
                </div>
            </a>
        `;
        adContainer.appendChild(adElement);
        
        setTimeout(() => {
            if (adElement.parentElement) adElement.remove();
        }, 10000);
    }
}

// ============================================
// INICIAR ROTACIÓN DE ANUNCIOS
// ============================================
function startAdRotation() {
    if (adInterval) clearInterval(adInterval);
    
    adInterval = setInterval(() => {
        if (window.APP_CONFIG.ADS_ENABLED && adsList.length > 0) {
            showAd();
        }
    }, window.APP_CONFIG.ADS_INTERVAL);
}

// ============================================
// BÚSQUEDA GLOBAL
// ============================================
window.globalSearch = async function(searchTerm) {
    if (!searchTerm || searchTerm.length < 2) return [];
    
    try {
        const searchLower = searchTerm.toLowerCase();
        
        const moviesSnapshot = await db.collection(COLLECTIONS.MOVIES)
            .orderBy('title')
            .startAt(searchLower)
            .endAt(searchLower + '\uf8ff')
            .limit(10)
            .get();
        
        const seriesSnapshot = await db.collection(COLLECTIONS.SERIES)
            .orderBy('title')
            .startAt(searchLower)
            .endAt(searchLower + '\uf8ff')
            .limit(10)
            .get();
        
        const results = [];
        moviesSnapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data(), type: 'movie' });
        });
        seriesSnapshot.forEach(doc => {
            results.push({ id: doc.id, ...doc.data(), type: 'series' });
        });
        
        return results;
    } catch (error) {
        console.error('Search error:', error);
        return [];
    }
};

// ============================================
// CONFIGURAR EVENT LISTENERS GLOBALES
// ============================================
function setupGlobalEventListeners() {
    const modal = document.getElementById('videoModal');
    const closeBtn = document.querySelector('.modal .close');
    const videoFrame = document.getElementById('videoFrame');
    
    if (closeBtn) {
        closeBtn.onclick = () => {
            if (modal) modal.style.display = 'none';
            if (videoFrame) videoFrame.src = '';
        };
    }
    
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
            if (videoFrame) videoFrame.src = '';
        }
    };
    
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query.length > 2) {
                    window.location.href = `pages/search.html?q=${encodeURIComponent(query)}`;
                }
            }
        });
    }
}