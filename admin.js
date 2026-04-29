// ============================================
// VARIABLES GLOBALES ADMIN
// ============================================
let viewsChart = null;

// ============================================
// VERIFICAR ADMIN Y INICIALIZAR
// ============================================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        try {
            const userDoc = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
            if (userDoc.exists && userDoc.data().role === 'admin') {
                initializeAdminPanel();
            } else {
                window.location.href = '../index.html';
            }
        } catch (error) {
            console.error('Error checking admin:', error);
            window.location.href = '../index.html';
        }
    } else {
        window.location.href = '../login.html';
    }
});

async function initializeAdminPanel() {
    await loadDashboardStats();
    await loadGenresForFilter();
    await loadMoviesList();
    await loadSeriesList();
    await loadEpisodesList();
    await loadUsersList();
    await loadAdsList();
    await loadChannelsList();
    await loadSettings();
    setupAdminEventListeners();
    populateSeriesSelect();
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboardStats() {
    try {
        const [moviesCount, seriesCount, usersCount, viewsCount] = await Promise.all([
            db.collection(COLLECTIONS.MOVIES).get().then(snap => snap.size),
            db.collection(COLLECTIONS.SERIES).get().then(snap => snap.size),
            db.collection(COLLECTIONS.USERS).get().then(snap => snap.size),
            db.collection(COLLECTIONS.VIEWS).get().then(snap => snap.size)
        ]);
        
        const totalMoviesEl = document.getElementById('totalMovies');
        const totalSeriesEl = document.getElementById('totalSeries');
        const totalUsersEl = document.getElementById('totalUsers');
        const totalViewsEl = document.getElementById('totalViews');
        
        if (totalMoviesEl) totalMoviesEl.textContent = moviesCount;
        if (totalSeriesEl) totalSeriesEl.textContent = seriesCount;
        if (totalUsersEl) totalUsersEl.textContent = usersCount;
        if (totalViewsEl) totalViewsEl.textContent = viewsCount;
        
        await loadViewsChart();
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadViewsChart() {
    try {
        const viewsSnapshot = await db.collection(COLLECTIONS.VIEWS)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();
        
        const viewsByMonth = {};
        viewsSnapshot.forEach(doc => {
            const date = doc.data().timestamp?.toDate();
            if (date) {
                const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;
                viewsByMonth[monthYear] = (viewsByMonth[monthYear] || 0) + 1;
            }
        });
        
        const labels = Object.keys(viewsByMonth).slice(0, 6).reverse();
        const values = labels.map(l => viewsByMonth[l]);
        
        const ctx = document.getElementById('viewsChart');
        if (ctx) {
            const chartCtx = ctx.getContext('2d');
            if (viewsChart) viewsChart.destroy();
            
            viewsChart = new Chart(chartCtx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Vistas',
                        data: values,
                        borderColor: '#e50914',
                        backgroundColor: 'rgba(229, 9, 20, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'top' },
                        title: { display: true, text: 'Vistas por Mes' }
                    }
                }
            });
        }
    } catch (error) {
        console.error('Error loading chart:', error);
    }
}

// ============================================
// PELÍCULAS
// ============================================
async function loadMoviesList() {
    try {
        const snapshot = await db.collection(COLLECTIONS.MOVIES)
            .orderBy('createdAt', 'desc')
            .get();
        
        const container = document.getElementById('moviesList');
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="no-results">No hay películas</div>';
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const movie = { id: doc.id, ...doc.data() };
            container.appendChild(createAdminMovieItem(movie));
        });
    } catch (error) {
        console.error('Error loading movies:', error);
    }
}

function createAdminMovieItem(movie) {
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
        <div class="item-preview">
            <img src="${movie.posterUrl || 'https://via.placeholder.com/80x120'}" alt="${escapeHtml(movie.title)}">
        </div>
        <div class="item-info">
            <h4>${escapeHtml(movie.title)}</h4>
            <p>${movie.year} • ${movie.duration || 'N/A'} • ${movie.quality || 'HD'}</p>
            <p class="item-description">${escapeHtml(movie.description ? movie.description.substring(0, 100) : 'Sin descripción')}...</p>
            <div class="item-actions">
                <button onclick="editMovie('${movie.id}')" class="btn-edit"><i class="fas fa-edit"></i> Editar</button>
                <button onclick="deleteMovie('${movie.id}')" class="btn-delete"><i class="fas fa-trash"></i> Eliminar</button>
            </div>
        </div>
    `;
    return div;
}

document.addEventListener('DOMContentLoaded', () => {
    const addMovieForm = document.getElementById('addMovieForm');
    if (addMovieForm) {
        addMovieForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await addMovie();
        });
    }
});

async function addMovie() {
    const title = document.getElementById('movieTitle')?.value;
    const year = parseInt(document.getElementById('movieYear')?.value);
    const duration = document.getElementById('movieDuration')?.value;
    const rating = parseFloat(document.getElementById('movieRating')?.value) || 0;
    const description = document.getElementById('movieDescription')?.value;
    const genres = document.getElementById('movieGenres')?.value.split(',').map(g => g.trim()).filter(g => g) || [];
    const videoUrl = document.getElementById('movieVideoUrl')?.value;
    const posterUrl = document.getElementById('moviePosterUrl')?.value || 'https://via.placeholder.com/300x450';
    const quality = document.getElementById('movieQuality')?.value;
    const popular = document.getElementById('moviePopular')?.checked || false;
    
    if (!title || !year || !videoUrl) {
        showNotification('Completa los campos requeridos', 'error');
        return;
    }
    
    const movieData = {
        title: title,
        year: year,
        duration: duration || 'N/A',
        rating: rating,
        description: description || '',
        genres: genres,
        videoUrl: videoUrl,
        posterUrl: posterUrl,
        quality: quality || 'HD',
        popular: popular,
        featured: false,
        searchKeywords: generateKeywords(title),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await db.collection(COLLECTIONS.MOVIES).add(movieData);
        showNotification('Película agregada exitosamente', 'success');
        document.getElementById('addMovieForm').reset();
        loadMoviesList();
        loadDashboardStats();
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
}

window.editMovie = async function(movieId) {
    try {
        const movieDoc = await db.collection(COLLECTIONS.MOVIES).doc(movieId).get();
        if (!movieDoc.exists) {
            showNotification('Película no encontrada', 'error');
            return;
        }
        
        const movie = movieDoc.data();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'editMovieModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <span class="close" onclick="closeModal(this)">&times;</span>
                <h2>Editar Película</h2>
                <form id="editMovieForm" class="admin-form">
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" id="editTitle" value="${escapeHtml(movie.title)}" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Año</label>
                            <input type="number" id="editYear" value="${movie.year}">
                        </div>
                        <div class="form-group">
                            <label>Duración</label>
                            <input type="text" id="editDuration" value="${movie.duration || ''}">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Calificación</label>
                            <input type="number" step="0.1" id="editRating" value="${movie.rating || 0}">
                        </div>
                        <div class="form-group">
                            <label>Calidad</label>
                            <select id="editQuality">
                                <option value="HD" ${movie.quality === 'HD' ? 'selected' : ''}>HD</option>
                                <option value="Full HD" ${movie.quality === 'Full HD' ? 'selected' : ''}>Full HD</option>
                                <option value="4K" ${movie.quality === '4K' ? 'selected' : ''}>4K</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea id="editDescription" rows="4">${escapeHtml(movie.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Géneros</label>
                        <input type="text" id="editGenres" value="${movie.genres?.join(', ') || ''}">
                    </div>
                    <div class="form-group">
                        <label>URL Video</label>
                        <input type="url" id="editVideoUrl" value="${movie.videoUrl || ''}">
                    </div>
                    <div class="form-group">
                        <label>URL Poster</label>
                        <input type="url" id="editPosterUrl" value="${movie.posterUrl || ''}">
                    </div>
                    <div class="form-check">
                        <label><input type="checkbox" id="editPopular" ${movie.popular ? 'checked' : ''}> Popular</label>
                    </div>
                    <button type="submit" class="btn-primary">Actualizar</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        document.getElementById('editMovieForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updateData = {
                title: document.getElementById('editTitle').value,
                year: parseInt(document.getElementById('editYear').value),
                duration: document.getElementById('editDuration').value,
                rating: parseFloat(document.getElementById('editRating').value) || 0,
                description: document.getElementById('editDescription').value,
                genres: document.getElementById('editGenres').value.split(',').map(g => g.trim()).filter(g => g),
                videoUrl: document.getElementById('editVideoUrl').value,
                posterUrl: document.getElementById('editPosterUrl').value,
                quality: document.getElementById('editQuality').value,
                popular: document.getElementById('editPopular').checked,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                await db.collection(COLLECTIONS.MOVIES).doc(movieId).update(updateData);
                showNotification('Película actualizada', 'success');
                closeModal(modal);
                loadMoviesList();
            } catch (error) {
                showNotification('Error: ' + error.message, 'error');
            }
        });
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
};

window.deleteMovie = async function(movieId) {
    if (!confirm('¿Estás seguro de eliminar esta película?')) return;
    
    try {
        await db.collection(COLLECTIONS.MOVIES).doc(movieId).delete();
        showNotification('Película eliminada', 'success');
        loadMoviesList();
        loadDashboardStats();
    } catch (error) {
        showNotification('Error al eliminar', 'error');
    }
};

// ============================================
// SERIES
// ============================================
async function loadSeriesList() {
    try {
        const snapshot = await db.collection(COLLECTIONS.SERIES)
            .orderBy('createdAt', 'desc')
            .get();
        
        const container = document.getElementById('seriesList');
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="no-results">No hay series</div>';
            return;
        }
        
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const series = { id: doc.id, ...doc.data() };
            container.appendChild(createAdminSeriesItem(series));
        });
    } catch (error) {
        console.error('Error loading series:', error);
    }
}

function createAdminSeriesItem(series) {
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
        <div class="item-preview">
            <img src="${series.posterUrl || 'https://via.placeholder.com/80x120'}" alt="${escapeHtml(series.title)}">
        </div>
        <div class="item-info">
            <h4>${escapeHtml(series.title)}</h4>
            <p>${series.year} • ${series.seasons || 1} temporada(s) • ${series.totalEpisodes || 0} episodios</p>
            <div class="item-actions">
                <button onclick="editSeries('${series.id}')" class="btn-edit">Editar</button>
                <button onclick="deleteSeries('${series.id}')" class="btn-delete">Eliminar</button>
                <button onclick="manageEpisodes('${series.id}', '${escapeHtml(series.title)}')" class="btn-info">Episodios</button>
            </div>
        </div>
    `;
    return div;
}

window.showAddSeriesModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'addSeriesModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close" onclick="closeModal(this)">&times;</span>
            <h2>Agregar Serie</h2>
            <form id="addSeriesForm" class="admin-form">
                <div class="form-group">
                    <label>Título *</label>
                    <input type="text" id="seriesTitle" required>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Año *</label>
                        <input type="number" id="seriesYear" required>
                    </div>
                    <div class="form-group">
                        <label>Temporadas</label>
                        <input type="number" id="seriesSeasons" value="1">
                    </div>
                </div>
                <div class="form-group">
                    <label>Descripción</label>
                    <textarea id="seriesDescription" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label>Géneros</label>
                    <input type="text" id="seriesGenres" placeholder="Acción, Drama">
                </div>
                <div class="form-group">
                    <label>URL Poster</label>
                    <input type="url" id="seriesPosterUrl">
                </div>
                <div class="form-group">
                    <label>Calificación</label>
                    <input type="number" step="0.1" id="seriesRating" value="0">
                </div>
                <div class="form-check">
                    <label><input type="checkbox" id="seriesPopular"> Popular</label>
                </div>
                <button type="submit" class="btn-primary">Guardar</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    document.getElementById('addSeriesForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const seriesData = {
            title: document.getElementById('seriesTitle').value,
            year: parseInt(document.getElementById('seriesYear').value),
            seasons: parseInt(document.getElementById('seriesSeasons').value),
            description: document.getElementById('seriesDescription').value,
            genres: document.getElementById('seriesGenres').value.split(',').map(g => g.trim()).filter(g => g),
            posterUrl: document.getElementById('seriesPosterUrl').value || 'https://via.placeholder.com/300x450',
            rating: parseFloat(document.getElementById('seriesRating').value) || 0,
            popular: document.getElementById('seriesPopular').checked,
            totalEpisodes: 0,
            searchKeywords: generateKeywords(document.getElementById('seriesTitle').value),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        try {
            await db.collection(COLLECTIONS.SERIES).add(seriesData);
            showNotification('Serie agregada', 'success');
            closeModal(modal);
            loadSeriesList();
            loadDashboardStats();
        } catch (error) {
            showNotification('Error: ' + error.message, 'error');
        }
    });
};

window.editSeries = async function(seriesId) {
    try {
        const seriesDoc = await db.collection(COLLECTIONS.SERIES).doc(seriesId).get();
        if (!seriesDoc.exists) return;
        
        const series = seriesDoc.data();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <span class="close" onclick="closeModal(this)">&times;</span>
                <h2>Editar Serie</h2>
                <form id="editSeriesForm" class="admin-form">
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" id="editSeriesTitle" value="${escapeHtml(series.title)}" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Año</label>
                            <input type="number" id="editSeriesYear" value="${series.year}">
                        </div>
                        <div class="form-group">
                            <label>Temporadas</label>
                            <input type="number" id="editSeriesSeasons" value="${series.seasons || 1}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Descripción</label>
                        <textarea id="editSeriesDescription" rows="4">${escapeHtml(series.description || '')}</textarea>
                    </div>
                    <div class="form-group">
                        <label>Géneros</label>
                        <input type="text" id="editSeriesGenres" value="${series.genres?.join(', ') || ''}">
                    </div>
                    <div class="form-group">
                        <label>URL Poster</label>
                        <input type="url" id="editSeriesPosterUrl" value="${series.posterUrl || ''}">
                    </div>
                    <div class="form-group">
                        <label>Calificación</label>
                        <input type="number" step="0.1" id="editSeriesRating" value="${series.rating || 0}">
                    </div>
                    <button type="submit" class="btn-primary">Actualizar</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        document.getElementById('editSeriesForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updateData = {
                title: document.getElementById('editSeriesTitle').value,
                year: parseInt(document.getElementById('editSeriesYear').value),
                seasons: parseInt(document.getElementById('editSeriesSeasons').value),
                description: document.getElementById('editSeriesDescription').value,
                genres: document.getElementById('editSeriesGenres').value.split(',').map(g => g.trim()).filter(g => g),
                posterUrl: document.getElementById('editSeriesPosterUrl').value,
                rating: parseFloat(document.getElementById('editSeriesRating').value) || 0,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                await db.collection(COLLECTIONS.SERIES).doc(seriesId).update(updateData);
                showNotification('Serie actualizada', 'success');
                closeModal(modal);
                loadSeriesList();
            } catch (error) {
                showNotification('Error: ' + error.message, 'error');
            }
        });
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
};

window.deleteSeries = async function(seriesId) {
    if (!confirm('¿Eliminar esta serie y todos sus episodios?')) return;
    
    try {
        const episodes = await db.collection(COLLECTIONS.EPISODES)
            .where('seriesId', '==', seriesId)
            .get();
        
        const batch = db.batch();
        episodes.forEach(doc => batch.delete(doc.ref));
        batch.delete(db.collection(COLLECTIONS.SERIES).doc(seriesId));
        await batch.commit();
        
        showNotification('Serie eliminada', 'success');
        loadSeriesList();
        loadDashboardStats();
    } catch (error) {
        showNotification('Error al eliminar', 'error');
    }
};

// ============================================
// EPISODIOS
// ============================================
async function populateSeriesSelect() {
    try {
        const snapshot = await db.collection(COLLECTIONS.SERIES).get();
        const select = document.getElementById('seriesSelect');
        if (select) {
            select.innerHTML = '<option value="">Seleccionar serie</option>';
            snapshot.forEach(doc => {
                select.innerHTML += `<option value="${doc.id}">${escapeHtml(doc.data().title)}</option>`;
            });
        }
    } catch (error) {
        console.error('Error populating series:', error);
    }
}

async function loadEpisodesList() {
    try {
        const snapshot = await db.collection(COLLECTIONS.EPISODES)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const container = document.getElementById('episodesList');
        if (!container) return;
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="no-results">No hay episodios</div>';
            return;
        }
        
        container.innerHTML = '';
        for (const doc of snapshot.docs) {
            const episode = { id: doc.id, ...doc.data() };
            let seriesTitle = 'Cargando...';
            if (episode.seriesId) {
                const seriesDoc = await db.collection(COLLECTIONS.SERIES).doc(episode.seriesId).get();
                if (seriesDoc.exists) seriesTitle = seriesDoc.data().title;
            }
            container.appendChild(createAdminEpisodeItem(episode, seriesTitle));
        }
    } catch (error) {
        console.error('Error loading episodes:', error);
    }
}

function createAdminEpisodeItem(episode, seriesTitle) {
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
        <div class="item-info" style="flex:1">
            <h4>${escapeHtml(seriesTitle)} - T${episode.season} E${episode.episode}</h4>
            <p><strong>${escapeHtml(episode.title || 'Sin título')}</strong></p>
            <div class="item-actions">
                <button onclick="editEpisode('${episode.id}')" class="btn-edit">Editar</button>
                <button onclick="deleteEpisode('${episode.id}')" class="btn-delete">Eliminar</button>
            </div>
        </div>
    `;
    return div;
}

window.showAddEpisodeModal = async function() {
    const seriesSnapshot = await db.collection(COLLECTIONS.SERIES).get();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'addEpisodeModal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <span class="close" onclick="closeModal(this)">&times;</span>
            <h2>Agregar Episodio</h2>
            <form id="addEpisodeForm" class="admin-form">
                <div class="form-group">
                    <label>Serie *</label>
                    <select id="episodeSeriesId" required>
                        <option value="">Seleccionar serie</option>
                        ${seriesSnapshot.docs.map(doc => `<option value="${doc.id}">${escapeHtml(doc.data().title)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Temporada *</label>
                        <input type="number" id="episodeSeason" min="1" value="1" required>
                    </div>
                    <div class="form-group">
                        <label>Episodio *</label>
                        <input type="number" id="episodeNumber" min="1" value="1" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Título *</label>
                    <input type="text" id="episodeTitle" required>
                </div>
                <div class="form-group">
                    <label>URL Video *</label>
                    <input type="url" id="episodeVideoUrl" required>
                </div>
                <div class="form-group">
                    <label>Duración</label>
                    <input type="text" id="episodeDuration" placeholder="45 min">
                </div>
                <button type="submit" class="btn-primary">Guardar</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    document.getElementById('addEpisodeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const seriesId = document.getElementById('episodeSeriesId').value;
        const season = parseInt(document.getElementById('episodeSeason').value);
        const episode = parseInt(document.getElementById('episodeNumber').value);
        
        const episodeData = {
            seriesId: seriesId,
            season: season,
            episode: episode,
            title: document.getElementById('episodeTitle').value,
            videoUrl: document.getElementById('episodeVideoUrl').value,
            duration: document.getElementById('episodeDuration').value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        try {
            await db.collection(COLLECTIONS.EPISODES).add(episodeData);
            
            const episodesCount = await db.collection(COLLECTIONS.EPISODES)
                .where('seriesId', '==', seriesId)
                .get();
            
            await db.collection(COLLECTIONS.SERIES).doc(seriesId).update({
                totalEpisodes: episodesCount.size
            });
            
            showNotification('Episodio agregado', 'success');
            closeModal(modal);
            loadEpisodesList();
        } catch (error) {
            showNotification('Error: ' + error.message, 'error');
        }
    });
};

window.loadEpisodesBySeries = async function() {
    const seriesId = document.getElementById('seriesSelect').value;
    if (!seriesId) return;
    
    try {
        const snapshot = await db.collection(COLLECTIONS.EPISODES)
            .where('seriesId', '==', seriesId)
            .orderBy('season')
            .orderBy('episode')
            .get();
        
        const container = document.getElementById('episodesList');
        if (container) {
            if (snapshot.empty) {
                container.innerHTML = '<div class="no-results">No hay episodios</div>';
                return;
            }
            
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const episode = { id: doc.id, ...doc.data() };
                container.appendChild(createAdminEpisodeItem(episode, ''));
            });
        }
    } catch (error) {
        console.error('Error loading episodes:', error);
    }
};

window.manageEpisodes = function(seriesId, seriesTitle) {
    const seriesSelect = document.getElementById('seriesSelect');
    if (seriesSelect) seriesSelect.value = seriesId;
    loadEpisodesBySeries();
    
    const episodesSection = document.querySelector('[data-section="episodes"]');
    if (episodesSection) episodesSection.click();
};

window.editEpisode = async function(episodeId) {
    try {
        const episodeDoc = await db.collection(COLLECTIONS.EPISODES).doc(episodeId).get();
        if (!episodeDoc.exists) return;
        
        const episode = episodeDoc.data();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <span class="close" onclick="closeModal(this)">&times;</span>
                <h2>Editar Episodio</h2>
                <form id="editEpisodeForm" class="admin-form">
                    <div class="form-row">
                        <div class="form-group">
                            <label>Temporada</label>
                            <input type="number" id="editEpisodeSeason" value="${episode.season}" required>
                        </div>
                        <div class="form-group">
                            <label>Episodio</label>
                            <input type="number" id="editEpisodeNumber" value="${episode.episode}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Título</label>
                        <input type="text" id="editEpisodeTitle" value="${escapeHtml(episode.title || '')}" required>
                    </div>
                    <div class="form-group">
                        <label>URL Video</label>
                        <input type="url" id="editEpisodeVideoUrl" value="${episode.videoUrl || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>Duración</label>
                        <input type="text" id="editEpisodeDuration" value="${episode.duration || ''}">
                    </div>
                    <button type="submit" class="btn-primary">Actualizar</button>
                </form>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        document.getElementById('editEpisodeForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const updateData = {
                season: parseInt(document.getElementById('editEpisodeSeason').value),
                episode: parseInt(document.getElementById('editEpisodeNumber').value),
                title: document.getElementById('editEpisodeTitle').value,
                videoUrl: document.getElementById('editEpisodeVideoUrl').value,
                duration: document.getElementById('editEpisodeDuration').value,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                await db.collection(COLLECTIONS.EPISODES).doc(episodeId).update(updateData);
                showNotification('Episodio actualizado', 'success');
                closeModal(modal);
                loadEpisodesList();
            } catch (error) {
                showNotification('Error: ' + error.message, 'error');
            }
        });
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
};

window.deleteEpisode = async function(episodeId) {
    if (!confirm('¿Eliminar este episodio?')) return;
    
    try {
        const episodeDoc = await db.collection(COLLECTIONS.EPISODES).doc(episodeId).get();
        const seriesId = episodeDoc.data().seriesId;
        
        await db.collection(COLLECTIONS.EPISODES).doc(episodeId).delete();
        
        const episodesCount = await db.collection(COLLECTIONS.EPISODES)
            .where('seriesId', '==', seriesId)
            .get();
        
        await db.collection(COLLECTIONS.SERIES).doc(seriesId).update({
            totalEpisodes: episodesCount.size
        });
        
        showNotification('Episodio eliminado', 'success');
        loadEpisodesList();
    } catch (error) {
        showNotification('Error al eliminar', 'error');
    }
};

// ============================================
// CANALES DE TV
// ============================================
async function loadChannelsList() {
    try {
        const snapshot = await db.collection(COLLECTIONS.LIVE_TV).get();
        const container = document.getElementById('channelsList');
        
        if (container) {
            if (snapshot.empty) {
                container.innerHTML = '<div class="no-results">No hay canales</div>';
                return;
            }
            
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const channel = { id: doc.id, ...doc.data() };
                container.appendChild(createAdminChannelItem(channel));
            });
        }
    } catch (error) {
        console.error('Error loading channels:', error);
    }
}

function createAdminChannelItem(channel) {
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
        <div class="item-preview">
            <img src="${channel.logoUrl || 'https://via.placeholder.com/80x80'}" alt="${escapeHtml(channel.name)}">
        </div>
        <div class="item-info">
            <h4>${escapeHtml(channel.name)}</h4>
            <p>${channel.category || 'General'} • ${channel.active ? 'Activo' : 'Inactivo'}</p>
            <div class="item-actions">
                <button onclick="editChannel('${channel.id}')" class="btn-edit">Editar</button>
                <button onclick="deleteChannel('${channel.id}')" class="btn-delete">Eliminar</button>
            </div>
        </div>
    `;
    return div;
}

window.showAddChannelModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <span class="close" onclick="closeModal(this)">&times;</span>
            <h2>Agregar Canal</h2>
            <form id="addChannelForm" class="admin-form">
                <div class="form-group">
                    <label>Nombre *</label>
                    <input type="text" id="channelName" required>
                </div>
                <div class="form-group">
                    <label>Categoría</label>
                    <input type="text" id="channelCategory" placeholder="Deportes, Noticias...">
                </div>
                <div class="form-group">
                    <label>URL Stream *</label>
                    <input type="url" id="channelStreamUrl" required>
                </div>
                <div class="form-group">
                    <label>URL Logo</label>
                    <input type="url" id="channelLogoUrl">
                </div>
                <div class="form-check">
                    <label><input type="checkbox" id="channelActive" checked> Activo</label>
                </div>
                <button type="submit" class="btn-primary">Guardar</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    document.getElementById('addChannelForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const channelData = {
            name: document.getElementById('channelName').value,
            category: document.getElementById('channelCategory').value,
            streamUrl: document.getElementById('channelStreamUrl').value,
            logoUrl: document.getElementById('channelLogoUrl').value || 'https://via.placeholder.com/80x80',
            active: document.getElementById('channelActive').checked,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        try {
            await db.collection(COLLECTIONS.LIVE_TV).add(channelData);
            showNotification('Canal agregado', 'success');
            closeModal(modal);
            loadChannelsList();
        } catch (error) {
            showNotification('Error: ' + error.message, 'error');
        }
    });
};

window.deleteChannel = async function(channelId) {
    if (!confirm('¿Eliminar este canal?')) return;
    
    try {
        await db.collection(COLLECTIONS.LIVE_TV).doc(channelId).delete();
        showNotification('Canal eliminado', 'success');
        loadChannelsList();
    } catch (error) {
        showNotification('Error al eliminar', 'error');
    }
};

// ============================================
// ANUNCIOS
// ============================================
async function loadAdsList() {
    try {
        const snapshot = await db.collection(COLLECTIONS.ADS).get();
        const container = document.getElementById('adsList');
        
        if (container) {
            if (snapshot.empty) {
                container.innerHTML = '<div class="no-results">No hay anuncios</div>';
                return;
            }
            
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const ad = { id: doc.id, ...doc.data() };
                container.appendChild(createAdminAdItem(ad));
            });
        }
    } catch (error) {
        console.error('Error loading ads:', error);
    }
}

function createAdminAdItem(ad) {
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
        <div class="item-preview">
            <img src="${ad.imageUrl || 'https://via.placeholder.com/80x80'}" alt="${escapeHtml(ad.title)}">
        </div>
        <div class="item-info">
            <h4>${escapeHtml(ad.title)}</h4>
            <p>${ad.description || 'Sin descripción'} • ${ad.active ? 'Activo' : 'Inactivo'}</p>
            <div class="item-actions">
                <button onclick="editAd('${ad.id}')" class="btn-edit">Editar</button>
                <button onclick="deleteAd('${ad.id}')" class="btn-delete">Eliminar</button>
            </div>
        </div>
    `;
    return div;
}

window.showAddAdModal = function() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <span class="close" onclick="closeModal(this)">&times;</span>
            <h2>Agregar Anuncio</h2>
            <form id="addAdForm" class="admin-form">
                <div class="form-group">
                    <label>Título *</label>
                    <input type="text" id="adTitle" required>
                </div>
                <div class="form-group">
                    <label>Descripción</label>
                    <textarea id="adDescription" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>URL Imagen *</label>
                    <input type="url" id="adImageUrl" required>
                </div>
                <div class="form-group">
                    <label>URL Enlace</label>
                    <input type="url" id="adLink">
                </div>
                <div class="form-check">
                    <label><input type="checkbox" id="adNewTab"> Nueva pestaña</label>
                </div>
                <div class="form-check">
                    <label><input type="checkbox" id="adActive" checked> Activo</label>
                </div>
                <button type="submit" class="btn-primary">Guardar</button>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    document.getElementById('addAdForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const adData = {
            title: document.getElementById('adTitle').value,
            description: document.getElementById('adDescription').value,
            imageUrl: document.getElementById('adImageUrl').value,
            link: document.getElementById('adLink').value,
            newTab: document.getElementById('adNewTab').checked,
            active: document.getElementById('adActive').checked,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        try {
            await db.collection(COLLECTIONS.ADS).add(adData);
            showNotification('Anuncio agregado', 'success');
            closeModal(modal);
            loadAdsList();
        } catch (error) {
            showNotification('Error: ' + error.message, 'error');
        }
    });
};

window.deleteAd = async function(adId) {
    if (!confirm('¿Eliminar este anuncio?')) return;
    
    try {
        await db.collection(COLLECTIONS.ADS).doc(adId).delete();
        showNotification('Anuncio eliminado', 'success');
        loadAdsList();
    } catch (error) {
        showNotification('Error al eliminar', 'error');
    }
};

window.saveAdSettings = async function() {
    const enabled = document.getElementById('enableAds')?.checked || false;
    const interval = parseInt(document.getElementById('adInterval')?.value) || 30;
    
    try {
        await db.collection(COLLECTIONS.SETTINGS).doc('ads').set({
            enabled: enabled,
            interval: interval,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification('Configuración guardada', 'success');
    } catch (error) {
        showNotification('Error: ' + error.message, 'error');
    }
};

// ============================================
// USUARIOS
// ============================================
async function loadUsersList() {
    try {
        const snapshot = await db.collection(COLLECTIONS.USERS).get();
        const container = document.getElementById('usersList');
        
        if (container) {
            if (snapshot.empty) {
                container.innerHTML = '<div class="no-results">No hay usuarios</div>';
                return;
            }
            
            container.innerHTML = `
                <div class="admin-table">
                    <table>
                        <thead>
                            <tr><th>Avatar</th><th>Nombre</th><th>Email</th><th>Rol</th><th>Registro</th><th>Acciones</th>
                        </thead>
                        <tbody>
                            ${snapshot.docs.map(doc => {
                                const user = doc.data();
                                return `
                                    <tr>
                                        <td><img src="${user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email)}&background=e50914&color=fff`}" style="width:40px;height:40px;border-radius:50%"></td>
                                        <td>${escapeHtml(user.name || 'N/A')}</td>
                                        <td>${escapeHtml(user.email)}</td>
                                        <td><span class="role-badge ${user.role}">${user.role}</span></td>
                                        <td>${user.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td>
                                        <td>
                                            <button onclick="changeUserRole('${doc.id}', '${user.role === 'admin' ? 'user' : 'admin'}')" class="btn-small">
                                                ${user.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                                            </button>
                                            <button onclick="deleteUser('${doc.id}')" class="btn-small btn-delete" style="margin-left:5px">Eliminar</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

window.changeUserRole = async function(userId, newRole) {
    try {
        await db.collection(COLLECTIONS.USERS).doc(userId).update({ role: newRole });
        showNotification(`Rol actualizado a ${newRole}`, 'success');
        loadUsersList();
    } catch (error) {
        showNotification('Error al actualizar rol', 'error');
    }
};

window.deleteUser = async function(userId) {
    if (userId === currentUser?.uid) {
        showNotification('No puedes eliminar tu propio usuario', 'error');
        return;
    }
    
    if (!confirm('¿Eliminar este usuario?')) return;
    
    try {
        const favorites = await db.collection(COLLECTIONS.FAVORITES)
            .where('userId', '==', userId)
            .get();
        
        const batch = db.batch();
        favorites.forEach(doc => batch.delete(doc.ref));
        batch.delete(db.collection(COLLECTIONS.USERS).doc(userId));
        await batch.commit();
        
        showNotification('Usuario eliminado', 'success');
        loadUsersList();
        loadDashboardStats();
    } catch (error) {
        showNotification('Error al eliminar', 'error');
    }
};

// ============================================
// CONFIGURACIÓN
// ============================================
async function loadSettings() {
    try {
        const settingsDoc = await db.collection(COLLECTIONS.SETTINGS).doc('site').get();
        if (settingsDoc.exists) {
            const settings = settingsDoc.data();
            const siteNameInput = document.getElementById('siteName');
            const tmdbApiKeyInput = document.getElementById('tmdbApiKey');
            const primaryColorInput = document.getElementById('primaryColor');
            
            if (siteNameInput) siteNameInput.value = settings.siteName || 'StreamFlix';
            if (tmdbApiKeyInput) tmdbApiKeyInput.value = settings.tmdbApiKey || '';
            if (primaryColorInput) primaryColorInput.value = settings.primaryColor || '#e50914';
            
            if (settings.tmdbApiKey) window.APP_CONFIG.TMDB_API_KEY = settings.tmdbApiKey;
            if (settings.primaryColor) document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
        }
        
        const adsDoc = await db.collection(COLLECTIONS.SETTINGS).doc('ads').get();
        if (adsDoc.exists) {
            const enableAdsInput = document.getElementById('enableAds');
            const adIntervalInput = document.getElementById('adInterval');
            
            if (enableAdsInput) enableAdsInput.checked = adsDoc.data().enabled !== false;
            if (adIntervalInput) adIntervalInput.value = adsDoc.data().interval || 30;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('siteSettings');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const settings = {
                siteName: document.getElementById('siteName')?.value || 'StreamFlix',
                tmdbApiKey: document.getElementById('tmdbApiKey')?.value || '',
                primaryColor: document.getElementById('primaryColor')?.value || '#e50914',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            try {
                await db.collection(COLLECTIONS.SETTINGS).doc('site').set(settings);
                window.APP_CONFIG.SITE_NAME = settings.siteName;
                window.APP_CONFIG.TMDB_API_KEY = settings.tmdbApiKey;
                document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
                showNotification('Configuración guardada', 'success');
            } catch (error) {
                showNotification('Error: ' + error.message, 'error');
            }
        });
    }
});

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================
async function loadGenresForFilter() {
    try {
        const snapshot = await db.collection(COLLECTIONS.GENRES).get();
        const filterSelect = document.getElementById('genreFilter');
        if (filterSelect) {
            snapshot.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.data().name;
                option.textContent = doc.data().name;
                filterSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading genres for filter:', error);
    }
}

function setupAdminEventListeners() {
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const section = link.dataset.section;
            
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(section).classList.add('active');
            
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
    
    const movieSearch = document.getElementById('movieSearch');
    if (movieSearch) {
        movieSearch.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = document.querySelectorAll('#moviesList .admin-item');
            items.forEach(item => {
                const title = item.querySelector('h4')?.textContent.toLowerCase() || '';
                item.style.display = title.includes(term) ? 'flex' : 'none';
            });
        });
    }
}

window.switchMovieTab = function(tabName) {
    document.querySelectorAll('#movies .tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    document.querySelectorAll('#movies .admin-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
};

window.closeModal = function(element) {
    const modal = element.closest('.modal');
    if (modal) modal.remove();
};

window.searchTMDB = async function() {
    const searchTerm = document.getElementById('tmdbSearch')?.value;
    if (!searchTerm) {
        showNotification('Ingresa un término de búsqueda', 'info');
        return;
    }
    
    const apiKey = window.APP_CONFIG?.TMDB_API_KEY;
    if (!apiKey || apiKey === 'TU_TMDB_API_KEY') {
        showNotification('Configura tu API Key de TMDB en la sección de Configuración', 'error');
        return;
    }
    
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${apiKey}&language=es&query=${encodeURIComponent(searchTerm)}`;
    
    try {
        showNotification('Buscando en TMDB...', 'info');
        const response = await fetch(url);
        const data = await response.json();
        
        const container = document.getElementById('tmdbResults');
        if (!container) return;
        
        if (!data.results || data.results.length === 0) {
            container.innerHTML = '<div class="no-results">No se encontraron resultados</div>';
            return;
        }
        
        container.innerHTML = '<div class="tmdb-grid"></div>';
        const grid = container.querySelector('.tmdb-grid');
        
        data.results.forEach(movie => {
            const posterPath = movie.poster_path ? `${window.APP_CONFIG.TMDB_IMAGE_BASE}${movie.poster_path}` : 'https://via.placeholder.com/200x300';
            
            const card = document.createElement('div');
            card.className = 'tmdb-card';
            card.innerHTML = `
                <img src="${posterPath}" alt="${movie.title}">
                <div>
                    <h4>${escapeHtml(movie.title)} (${new Date(movie.release_date).getFullYear() || 'N/A'})</h4>
                    <p>⭐ ${movie.vote_average || 'N/A'}/10</p>
                    <p>${movie.overview?.substring(0, 100) || 'Sin descripción'}...</p>
                    <button onclick="importFromTMDB(${movie.id})" class="btn-small">Importar</button>
                </div>
            `;
            grid.appendChild(card);
        });
    } catch (error) {
        console.error('Error searching TMDB:', error);
        showNotification('Error al buscar en TMDB', 'error');
    }
};

window.importFromTMDB = async function(tmdbId) {
    const apiKey = window.APP_CONFIG?.TMDB_API_KEY;
    if (!apiKey) {
        showNotification('Configura tu API Key de TMDB', 'error');
        return;
    }
    
    const url = `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${apiKey}&language=es`;
    
    try {
        const response = await fetch(url);
        const movie = await response.json();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <span class="close" onclick="closeModal(this)">&times;</span>
                <h3>Importar: ${escapeHtml(movie.title)}</h3>
                <div class="form-group">
                    <label>URL del Video *</label>
                    <input type="url" id="importVideoUrl" placeholder="https://..." required>
                </div>
                <div class="form-check">
                    <label><input type="checkbox" id="importPopular"> Marcar como popular</label>
                </div>
                <button onclick="saveImportedMovie(${tmdbId})" class="btn-primary" style="margin-top: 15px;">Guardar</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        window.saveImportedMovie = async function() {
            const videoUrl = document.getElementById('importVideoUrl')?.value;
            if (!videoUrl) {
                showNotification('Ingresa la URL del video', 'error');
                return;
            }
            
            const movieData = {
                title: movie.title,
                year: new Date(movie.release_date).getFullYear(),
                duration: `${movie.runtime} min`,
                rating: movie.vote_average,
                description: movie.overview,
                genres: movie.genres.map(g => g.name),
                posterUrl: movie.poster_path ? `${window.APP_CONFIG.TMDB_IMAGE_BASE}${movie.poster_path}` : 'https://via.placeholder.com/300x450',
                backdropUrl: movie.backdrop_path ? `${window.APP_CONFIG.TMDB_BACKDROP_BASE}${movie.backdrop_path}` : '',
                videoUrl: videoUrl,
                quality: 'HD',
                popular: document.getElementById('importPopular')?.checked || false,
                featured: false,
                searchKeywords: generateKeywords(movie.title),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                tmdbId: tmdbId
            };
            
            try {
                await db.collection(COLLECTIONS.MOVIES).add(movieData);
                showNotification('Película importada exitosamente', 'success');
                closeModal(modal);
                loadMoviesList();
                loadDashboardStats();
            } catch (error) {
                showNotification('Error: ' + error.message, 'error');
            }
        };
    } catch (error) {
        console.error('Error importing from TMDB:', error);
        showNotification('Error al importar', 'error');
    }
};

window.uploadBatchMovies = function() {
    const fileInput = document.getElementById('jsonFile');
    const file = fileInput?.files[0];
    
    if (!file) {
        showNotification('Selecciona un archivo JSON', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const movies = JSON.parse(e.target.result);
            if (!Array.isArray(movies)) {
                showNotification('El archivo debe contener un array de películas', 'error');
                return;
            }
            
            let successCount = 0;
            let errorCount = 0;
            
            for (const movie of movies) {
                try {
                    const movieData = {
                        title: movie.title,
                        year: movie.year || new Date().getFullYear(),
                        duration: movie.duration || 'N/A',
                        rating: movie.rating || 0,
                        description: movie.description || '',
                        genres: movie.genres || [],
                        videoUrl: movie.videoUrl || '',
                        posterUrl: movie.posterUrl || 'https://via.placeholder.com/300x450',
                        quality: movie.quality || 'HD',
                        popular: movie.popular || false,
                        featured: movie.featured || false,
                        searchKeywords: generateKeywords(movie.title),
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    
                    await db.collection(COLLECTIONS.MOVIES).add(movieData);
                    successCount++;
                } catch (err) {
                    errorCount++;
                    console.error('Error importing movie:', movie.title, err);
                }
            }
            
            showNotification(`Importación completa: ${successCount} éxitos, ${errorCount} errores`, successCount > 0 ? 'success' : 'error');
            loadMoviesList();
            loadDashboardStats();
        } catch (error) {
            showNotification('Error al procesar el JSON: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
};