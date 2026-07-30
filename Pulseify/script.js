// ============================================================
// 1. СОСТОЯНИЕ
// ============================================================
var API_KEY = 'AIzaSyBLJwJ34uiLOPJ4WAbqYp3C_LJh58ymi80';

var state = {
    allTracks: [],
    playlist: [],          // массив объектов с уникальными id для каждой копии
    tempPlaylist: [],
    currentIndex: -1,
    isPlaying: false,
    shuffle: false,
    repeat: 0,
    volume: 70,
    currentPlaylist: null,
    playlists: [],
    localTracks: [],       // оригинальные треки (загруженные локально)
    searchResults: [],
    favorites: [],          // избранное хранит ссылки на оригиналы (по originalId)
    theme: 'dark',
    isTempMode: false,
    tempCurrentIndex: 0,
    playCounts: {},
    coverUrls: {}
};

var audio = document.getElementById('audio');
var externalPlayer;
var currentExternalId = null;
var isExternalReady = false;
var externalQueue = [];
var isProgressUpdating = false;

// ============================================================
// 2. ВНЕШНИЙ ПЛЕЕР (YouTube)
// ============================================================
var tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    externalPlayer = new YT.Player('externalPlayer', {
        height: '1', width: '1',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, modestbranding: 1, rel: 0, showinfo: 0, playsinline: 1 },
        events: {
            onReady: function() { isExternalReady = true; if (externalQueue.length) playExternalVideo(externalQueue.shift()); },
            onStateChange: function(e) {
                if (e.data === YT.PlayerState.ENDED) {
                    if (state.isTempMode && state.tempPlaylist.length > 0) {
                        var next = (state.tempCurrentIndex + 1) % state.tempPlaylist.length;
                        playFromTempPlaylist(next);
                        return;
                    }
                    if (!state.isTempMode && state.repeat === 1) externalPlayer.seekTo(0), externalPlayer.playVideo();
                    else if (!state.isTempMode && (state.repeat === 2 || state.repeat === 0)) nextTrack();
                    else if (state.isTempMode) { state.isPlaying = false; updatePlayButton(); }
                }
                if (e.data === YT.PlayerState.PLAYING) {
                    state.isPlaying = true; updatePlayButton();
                    if (!isProgressUpdating) { isProgressUpdating = true; updateExternalProgress(); }
                    document.getElementById('playerCover').classList.add('playing');
                    updateFavoriteButton();
                    updateNowPlaying();
                }
                if (e.data === YT.PlayerState.PAUSED) {
                    state.isPlaying = false; updatePlayButton();
                    isProgressUpdating = false;
                    document.getElementById('playerCover').classList.remove('playing');
                }
            },
            onError: function() { showNotification('Ошибка воспроизведения', 'error'); if (!state.isTempMode) nextTrack(); }
        }
    });
}

function playExternalVideo(videoId) {
    currentExternalId = videoId;
    if (externalPlayer && isExternalReady) {
        externalPlayer.loadVideoById(videoId);
        externalPlayer.playVideo();
        state.isPlaying = true;
        updatePlayButton();
        document.getElementById('playerCover').classList.add('playing');
        var track = findTrackByExternalId(videoId);
        if (track) updatePlayerInfo(track);
        updateFavoriteButton();
        updateNowPlaying();
    } else {
        externalQueue.push(videoId);
        if (!isExternalReady) showNotification('Загрузка плеера...', 'info');
    }
}

function findTrackByExternalId(videoId) {
    for (var i = 0; i < state.searchResults.length; i++) {
        if (state.searchResults[i].videoId === videoId) return state.searchResults[i];
    }
    for (var j = 0; j < state.playlist.length; j++) {
        if (state.playlist[j].videoId === videoId) return state.playlist[j];
    }
    for (var k = 0; k < state.favorites.length; k++) {
        if (state.favorites[k].videoId === videoId) return state.favorites[k];
    }
    return null;
}

function pauseExternal() { if (externalPlayer && externalPlayer.pauseVideo) { externalPlayer.pauseVideo(); state.isPlaying = false; updatePlayButton(); document.getElementById('playerCover').classList.remove('playing'); isProgressUpdating = false; } }
function resumeExternal() { if (externalPlayer && externalPlayer.playVideo) { externalPlayer.playVideo(); state.isPlaying = true; updatePlayButton(); document.getElementById('playerCover').classList.add('playing'); if (!isProgressUpdating) { isProgressUpdating = true; updateExternalProgress(); } } }

function updateExternalProgress() {
    if (!isProgressUpdating) return;
    if (externalPlayer && externalPlayer.getCurrentTime) {
        var current = externalPlayer.getCurrentTime();
        var total = externalPlayer.getDuration();
        if (total > 0) {
            document.getElementById('progressBar').value = (current / total) * 100;
            document.getElementById('currentTime').textContent = formatTime(current);
            document.getElementById('totalTime').textContent = formatTime(total);
        }
        requestAnimationFrame(updateExternalProgress);
    } else {
        isProgressUpdating = false;
    }
}

// ============================================================
// 3. ГЕНЕРАЦИЯ ДЕМО-ТРЕКОВ
// ============================================================
var NAMES = ['Midnight', 'Sunset', 'Dawn', 'Eclipse', 'Nebula', 'Galaxy', 'Starlight', 'Moonlight', 'Ocean', 'Forest', 'Mountain', 'River', 'Valley', 'Crystal', 'Emerald', 'Sapphire', 'Ruby', 'Diamond', 'Silver', 'Golden', 'Infinite', 'Eternal', 'Dream', 'Vision'];
var ADJECTIVES = ['Electric', 'Velvet', 'Silent', 'Wild', 'Smooth', 'Deep', 'Pure', 'Vivid', 'Luminous', 'Radiant', 'Serene', 'Fierce', 'Mellow', 'Bold', 'Swift', 'Sacred'];
var ARTISTS = ['DJ Shadow', 'Neon Dreams', 'Cyber Pulse', 'Lunar Eclipse', 'Solar Flare', 'Quantum Beats', 'Astral Projection', 'Cosmic Wave', 'Starlight Orchestra', 'Midnight Society', 'The Echoes', 'Velvet Underground', 'Electric Soul'];
var DEMO_URLS = ['https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3'];

function generateTracks(count) {
    count = count || 20;
    var tracks = [];
    var usedNames = new Set();
    for (var i = 0; i < count; i++) {
        var name, attempts = 0;
        do {
            var w1 = NAMES[Math.floor(Math.random() * NAMES.length)];
            var w2 = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
            name = w2 + ' ' + w1;
            attempts++;
        } while (usedNames.has(name) && attempts < 50);
        usedNames.add(name);
        var urlIdx = Math.floor(Math.random() * DEMO_URLS.length);
        var artist = ARTISTS[Math.floor(Math.random() * ARTISTS.length)];
        var mins = Math.floor(Math.random() * 3) + 2;
        var secs = Math.floor(Math.random() * 59);
        var duration = mins + ':' + String(secs).padStart(2, '0');
        var cover = 'c' + (Math.floor(Math.random() * 8) + 1);
        tracks.push({
            id: 'track_' + String(i + 1).padStart(4, '0'),
            name: name,
            artist: artist,
            url: DEMO_URLS[urlIdx],
            duration: duration,
            cover: cover,
            coverImage: null
        });
    }
    return tracks;
}

// ============================================================
// 4. РАБОТА С INDEXEDDB
// ============================================================
var DB_NAME = 'MusicPlayerDB';
var STORE_AUDIO = 'audioFiles';
var STORE_COVERS = 'covers';

function openDB() {
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_AUDIO)) {
                db.createObjectStore(STORE_AUDIO, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_COVERS)) {
                db.createObjectStore(STORE_COVERS, { keyPath: 'id' });
            }
        };
        request.onsuccess = function(e) { resolve(e.target.result); };
        request.onerror = function(e) { reject(e.target.error); };
    });
}

function saveFileToDB(storeName, id, data, type) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readwrite');
            var store = tx.objectStore(storeName);
            var request = store.put({ id: id, data: data, type: type });
            request.onsuccess = function() { resolve(); };
            request.onerror = function() { reject(request.error); };
        });
    });
}

function deleteFileFromDB(storeName, id) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readwrite');
            var store = tx.objectStore(storeName);
            var request = store.delete(id);
            request.onsuccess = function() { resolve(); };
            request.onerror = function() { reject(request.error); };
        });
    });
}

function getAllFilesFromDB(storeName) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readonly');
            var store = tx.objectStore(storeName);
            var request = store.getAll();
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function() { reject(request.error); };
        });
    });
}

// ============================================================
// 5. СОХРАНЕНИЕ / ЗАГРУЗКА СОСТОЯНИЯ
// ============================================================
function saveState() {
    try {
        var data = {
            playlist: state.playlist.map(function(t) { return { id: t.id, originalId: t.originalId, name: t.name, artist: t.artist, duration: t.duration, cover: t.cover, playlist: t.playlist, isExternal: t.isExternal || false, videoId: t.videoId || null, thumbnail: t.thumbnail || null, coverImage: t.coverImage || null }; }),
            playlists: state.playlists,
            currentPlaylist: state.currentPlaylist,
            localTracks: state.localTracks.map(function(t) { return { id: t.id, name: t.name, artist: t.artist, duration: t.duration, cover: t.cover, coverImage: t.coverImage || null }; }),
            theme: state.theme,
            volume: state.volume,
            shuffle: state.shuffle,
            repeat: state.repeat,
            playCounts: state.playCounts,
            favorites: state.favorites.map(function(t) { return { originalId: t.originalId, name: t.name, artist: t.artist, duration: t.duration, cover: t.cover, thumbnail: t.thumbnail || null, videoId: t.videoId || null, isExternal: t.isExternal || false, coverImage: t.coverImage || null }; })
        };
        localStorage.setItem('musicPlayerData', JSON.stringify(data));
    } catch (e) { console.log('Save error', e); }
}

function loadState() {
    try {
        var saved = localStorage.getItem('musicPlayerData');
        if (!saved) return false;
        var data = JSON.parse(saved);
        state.playlist = data.playlist || [];
        state.playlists = data.playlists || [];
        state.currentPlaylist = data.currentPlaylist || null;
        state.localTracks = data.localTracks || [];
        state.theme = data.theme || 'dark';
        state.volume = data.volume || 70;
        state.shuffle = data.shuffle || false;
        state.repeat = data.repeat || 0;
        state.playCounts = data.playCounts || {};
        state.favorites = data.favorites || [];
        return true;
    } catch (e) { return false; }
}

// ============================================================
// 6. УПРАВЛЕНИЕ ВОСПРОИЗВЕДЕНИЕМ (с учётом оригинальных id)
// ============================================================
function getTrackById(id) {
    // Сначала ищем в плейлисте (копии)
    for (var i = 0; i < state.playlist.length; i++) {
        if (state.playlist[i].id === id) return state.playlist[i];
    }
    // Потом в локальных
    for (var j = 0; j < state.localTracks.length; j++) {
        if (state.localTracks[j].id === id) return state.localTracks[j];
    }
    // В поиске
    for (var k = 0; k < state.searchResults.length; k++) {
        if (state.searchResults[k].id === id) return state.searchResults[k];
    }
    // В избранном
    for (var f = 0; f < state.favorites.length; f++) {
        if (state.favorites[f].id === id) return state.favorites[f];
    }
    return null;
}

function getOriginalTrack(originalId) {
    // ищем среди localTracks, searchResults, allTracks
    for (var i = 0; i < state.localTracks.length; i++) {
        if (state.localTracks[i].id === originalId) return state.localTracks[i];
    }
    for (var j = 0; j < state.searchResults.length; j++) {
        if (state.searchResults[j].id === originalId) return state.searchResults[j];
    }
    for (var k = 0; k < state.allTracks.length; k++) {
        if (state.allTracks[k].id === originalId) return state.allTracks[k];
    }
    return null;
}

function playTrackDirect(trackId, source) {
    var track = null;
    if (source === 'all') {
        for (var i = 0; i < state.allTracks.length; i++) { if (state.allTracks[i].id === trackId) { track = state.allTracks[i]; break; } }
    } else if (source === 'local') {
        for (var j = 0; j < state.localTracks.length; j++) { if (state.localTracks[j].id === trackId) { track = state.localTracks[j]; break; } }
    } else if (source === 'search') {
        for (var k = 0; k < state.searchResults.length; k++) { if (state.searchResults[k].id === trackId) { track = state.searchResults[k]; break; } }
    } else if (source === 'playlist') {
        for (var p = 0; p < state.playlist.length; p++) { if (state.playlist[p].id === trackId) { track = state.playlist[p]; break; } }
    } else if (source === 'favorites') {
        for (var f = 0; f < state.favorites.length; f++) { if (state.favorites[f].originalId === trackId || state.favorites[f].id === trackId) { track = state.favorites[f]; break; } }
    }
    if (!track) { showNotification('Трек не найден', 'error'); return; }
    incrementPlayCount(track.id);
    state.tempPlaylist = [{ id: track.id, name: track.name, artist: track.artist, url: track.url || '', duration: track.duration || '3:00', cover: track.cover || 'c1', videoId: track.videoId || null, isExternal: !!(track.videoId), thumbnail: track.thumbnail || null, coverImage: track.coverImage || null }];
    state.isTempMode = true;
    state.tempCurrentIndex = 0;
    state.isPlaying = false;
    if (track.videoId) { playExternalVideo(track.videoId); } else { if (!track.url) { showNotification('Нет ссылки', 'error'); return; } audio.src = track.url; audio.play().catch(function(e) {}); state.isPlaying = true; updatePlayButton(); updatePlayerInfo(track); document.getElementById('playerCover').classList.add('playing'); }
    renderAll();
    updateFavoriteButton();
    updateNowPlaying();
}

function playTrackFromPlaylist(trackId) {
    // trackId - это id копии в плейлисте
    for (var i = 0; i < state.playlist.length; i++) {
        if (state.playlist[i].id === trackId) {
            var track = state.playlist[i];
            state.currentIndex = i;
            state.isTempMode = false;
            state.tempPlaylist = [];
            incrementPlayCount(track.id);
            if (track.isExternal && track.videoId) { playExternalVideo(track.videoId); updatePlayerInfo(track); renderAll(); updateFavoriteButton(); updateNowPlaying(); return; }
            playCurrentPlaylistTrack();
            return;
        }
    }
    showNotification('Трек не найден в плейлисте', 'error');
}

function playCurrentPlaylistTrack() {
    if (state.currentIndex < 0 || state.currentIndex >= state.playlist.length) return;
    var track = state.playlist[state.currentIndex];
    incrementPlayCount(track.id);
    if (track.isExternal && track.videoId) { playExternalVideo(track.videoId); updatePlayerInfo(track); renderAll(); updateFavoriteButton(); updateNowPlaying(); return; }
    if (!track.url) { showNotification('Нет ссылки', 'error'); return; }
    state.isTempMode = false;
    state.tempPlaylist = [];
    audio.src = track.url;
    audio.play().catch(function(e) {});
    state.isPlaying = true;
    updatePlayButton();
    updatePlayerInfo(track);
    document.getElementById('playerCover').classList.add('playing');
    renderAll();
    updateNowPlaying();
    updateFavoriteButton();
}

function togglePlay() {
    if (currentExternalId && externalPlayer) {
        if (state.isPlaying) pauseExternal();
        else resumeExternal();
        return;
    }
    if (state.isTempMode) {
        if (state.tempPlaylist.length === 0) { showNotification('Нет трека', 'error'); return; }
        if (state.isPlaying) { audio.pause(); state.isPlaying = false; document.getElementById('playerCover').classList.remove('playing'); } else { audio.play().catch(function(e) {}); state.isPlaying = true; document.getElementById('playerCover').classList.add('playing'); }
        updatePlayButton();
        updateFavoriteButton();
        updateNowPlaying();
        return;
    }
    if (state.playlist.length === 0) { showNotification('Нет треков в плейлисте', 'error'); return; }
    if (state.currentIndex === -1) { state.currentIndex = 0; playCurrentPlaylistTrack(); return; }
    if (state.isPlaying) {
        if (currentExternalId && externalPlayer) { pauseExternal(); return; }
        audio.pause(); state.isPlaying = false; document.getElementById('playerCover').classList.remove('playing');
    } else {
        if (currentExternalId && externalPlayer) { resumeExternal(); return; }
        audio.play().catch(function(e) {}); state.isPlaying = true; document.getElementById('playerCover').classList.add('playing');
    }
    updatePlayButton();
    updateFavoriteButton();
    updateNowPlaying();
}

function nextTrack() {
    if (state.isTempMode) {
        if (state.tempPlaylist.length === 0) return;
        var next = (state.tempCurrentIndex + 1) % state.tempPlaylist.length;
        playFromTempPlaylist(next);
        return;
    }
    if (state.playlist.length === 0) return;
    if (state.shuffle) { state.currentIndex = Math.floor(Math.random() * state.playlist.length); } else { state.currentIndex = (state.currentIndex + 1) % state.playlist.length; }
    playCurrentPlaylistTrack();
    updateFavoriteButton();
    updateNowPlaying();
}

function prevTrack() {
    if (state.isTempMode) {
        if (state.tempPlaylist.length === 0) return;
        var prev = (state.tempCurrentIndex - 1 + state.tempPlaylist.length) % state.tempPlaylist.length;
        playFromTempPlaylist(prev);
        return;
    }
    if (state.currentIndex > 0) { state.currentIndex--; playCurrentPlaylistTrack(); }
    updateFavoriteButton();
    updateNowPlaying();
}

function playFromTempPlaylist(index) {
    if (index >= state.tempPlaylist.length) index = 0;
    var track = state.tempPlaylist[index];
    if (!track) return;
    state.tempCurrentIndex = index;
    incrementPlayCount(track.id);
    if (track.videoId) { playExternalVideo(track.videoId); updatePlayerInfo(track); } else { if (!track.url) { showNotification('Нет ссылки', 'error'); return; } audio.src = track.url; audio.play().catch(function(e) {}); state.isPlaying = true; updatePlayButton(); updatePlayerInfo(track); document.getElementById('playerCover').classList.add('playing'); }
    renderAll();
    updateNowPlaying();
    updateFavoriteButton();
}

function incrementPlayCount(id) { if (!state.playCounts[id]) state.playCounts[id] = 0; state.playCounts[id]++; saveState(); }

function updatePlayButton() {
    var icon = state.isPlaying ? '⏸' : '▶';
    document.getElementById('playBtn').textContent = icon;
    document.getElementById('myWavePlayBtn').textContent = icon;
}

function updatePlayerInfo(track) {
    document.getElementById('playerName').textContent = track.name;
    document.getElementById('playerArtist').textContent = track.artist || 'Неизвестен';
    var coverEl = document.getElementById('playerCover');
    if (track.coverImage) {
        coverEl.style.backgroundImage = 'url(' + track.coverImage + ')';
    } else if (track.thumbnail) {
        coverEl.style.backgroundImage = 'url(' + track.thumbnail + ')';
    } else {
        coverEl.style.backgroundImage = "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%232a2a2a%22/%3E%3Ctext x=%2220%22 y=%2220%22 font-size=%2220%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23666%22%3E🎵%3C/text%3E%3C/svg%3E')";
    }
    updateFavoriteButton();
    updateNowPlaying();
}

function updateNowPlaying() {
    var track = getCurrentTrack();
    if (track) {
        document.getElementById('nowPlayingName').textContent = track.name;
        document.getElementById('nowPlayingArtist').textContent = track.artist || 'Неизвестен';
    } else {
        document.getElementById('nowPlayingName').textContent = 'Нет трека';
        document.getElementById('nowPlayingArtist').textContent = '-';
    }
}

function toggleShuffle() { state.shuffle = !state.shuffle; showNotification('Перемешивание: ' + (state.shuffle ? 'Вкл' : 'Выкл'), 'info'); }
function toggleRepeat() { state.repeat = (state.repeat + 1) % 3; var modes = ['🔁 Выкл', '🔂 Один', '🔁 Все']; document.getElementById('repeatBtn').textContent = modes[state.repeat].split(' ')[0]; document.getElementById('repeatBtn2').textContent = modes[state.repeat].split(' ')[0]; showNotification(modes[state.repeat], 'info'); }

function formatTime(seconds) { if (!seconds || isNaN(seconds)) return '0:00'; var m = Math.floor(seconds / 60); var s = Math.floor(seconds % 60); return m + ':' + String(s).padStart(2, '0'); }

// ============================================================
// 7. ИЗБРАННОЕ (храним оригинальные данные)
// ============================================================
function toggleFavorite(track) {
    if (!track) return;
    // Ищем по оригинальному ID, если есть
    var origId = track.originalId || track.id;
    var existing = state.favorites.find(function(t) { return (t.originalId || t.id) === origId; });
    if (existing) {
        state.favorites = state.favorites.filter(function(t) { return (t.originalId || t.id) !== origId; });
        showNotification('💔 Убрано из избранного', 'info');
    } else {
        var favTrack = {
            originalId: origId,
            name: track.name,
            artist: track.artist || 'Неизвестен',
            duration: track.duration || '0:00',
            cover: track.cover || 'c1',
            thumbnail: track.thumbnail || null,
            videoId: track.videoId || null,
            isExternal: !!(track.videoId),
            coverImage: track.coverImage || null
        };
        state.favorites.push(favTrack);
        showNotification('❤️ Добавлено в избранное', 'success');
    }
    saveState();
    renderAll();
    updateFavoriteButton();
}

function isFavorite(track) {
    if (!track) return false;
    var origId = track.originalId || track.id;
    return state.favorites.some(function(t) { return (t.originalId || t.id) === origId; });
}

function toggleCurrentFavorite() {
    var track = getCurrentTrack();
    if (!track) { showNotification('Нет трека', 'error'); return; }
    toggleFavorite(track);
}

function getCurrentTrack() {
    if (state.isTempMode && state.tempPlaylist.length > 0 && state.tempPlaylist[state.tempCurrentIndex]) {
        return state.tempPlaylist[state.tempCurrentIndex];
    } else if (state.currentIndex >= 0 && state.playlist[state.currentIndex]) {
        return state.playlist[state.currentIndex];
    }
    return null;
}

function updateFavoriteButton() {
    var btn = document.getElementById('playerFavoriteBtn');
    var track = getCurrentTrack();
    if (track && isFavorite(track)) {
        btn.textContent = '♥';
        btn.classList.add('active');
    } else {
        btn.textContent = '♡';
        btn.classList.remove('active');
    }
}

function clearFavorites() {
    if (!confirm('Очистить всё избранное?')) return;
    state.favorites = [];
    saveState();
    renderAll();
    updateFavoriteButton();
    showNotification('🗑️ Избранное очищено', 'info');
}

function getFavoriteTracks() {
    return state.favorites.slice();
}

// ============================================================
// 8. ПОИСК
// ============================================================
function searchMusic() {
    var query = document.getElementById('searchInput').value.trim();
    if (!query) { state.searchResults = []; renderSearchResults(); return; }
    if (!API_KEY || API_KEY === 'ТВОЙ_API_KEY_СЮДА') { showNotification('Вставьте API ключ!', 'error'); return; }
    showNotification('🔍 Ищем: ' + query, 'info');
    var url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=' + encodeURIComponent(query) + '&type=video&videoCategoryId=10&key=' + API_KEY;
    fetch(url).then(function(response) { if (!response.ok) throw new Error('Ошибка ' + response.status); return response.json(); }).then(function(data) {
        if (!data.items || data.items.length === 0) { showNotification('Ничего не найдено', 'error'); return; }
        state.searchResults = data.items.map(function(item) {
            var videoId = item.id.videoId;
            var thumbnail = item.snippet.thumbnails && item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : 'https://img.youtube.com/vi/' + videoId + '/hqdefault.jpg';
            return {
                id: 'ext_' + videoId,
                name: item.snippet.title,
                artist: item.snippet.channelTitle,
                url: 'https://www.youtube.com/watch?v=' + videoId,
                videoId: videoId,
                duration: '0:00',
                cover: 'c' + (Math.floor(Math.random() * 8) + 1),
                thumbnail: thumbnail,
                coverImage: null
            };
        });
        renderSearchResults();
        showNotification('✅ Найдено ' + state.searchResults.length + ' результатов', 'success');
    }).catch(function(err) { showNotification('Ошибка: ' + err.message, 'error'); });
}

function renderSearchResults() {
    var container = document.getElementById('searchGrid');
    container.innerHTML = '';
    for (var i = 0; i < state.searchResults.length; i++) {
        container.appendChild(createTrackCard(state.searchResults[i], 'search'));
    }
}

// ============================================================
// 9. ВОЛНА
// ============================================================
function playPlaylistWave(playlistName) {
    var tracks = getTracksFromPlaylist(playlistName);
    if (tracks.length === 0) {
        showNotification('В выбранном плейлисте нет треков', 'error');
        return;
    }
    shuffleArray(tracks);
    state.tempPlaylist = tracks.map(function(t) {
        return {
            id: t.id,
            name: t.name,
            artist: t.artist,
            url: t.url || '',
            duration: t.duration || '3:00',
            cover: t.cover || 'c1',
            videoId: t.videoId || null,
            isExternal: !!(t.videoId),
            thumbnail: t.thumbnail || null,
            coverImage: t.coverImage || null
        };
    });
    state.isTempMode = true;
    state.tempCurrentIndex = 0;
    state.isPlaying = false;
    playFromTempPlaylist(0);
    var label = playlistName === 'all' ? 'всех плейлистов' : playlistName;
    showNotification('📋 Волна (' + label + ') – перемешано', 'success');
}

function getTracksFromPlaylist(playlistName) {
    if (playlistName === 'all') {
        var map = {};
        for (var i = 0; i < state.playlist.length; i++) {
            var t = state.playlist[i];
            map[t.id] = t;
        }
        var result = [];
        for (var id in map) {
            result.push(map[id]);
        }
        return result;
    } else {
        var tracks = [];
        for (var j = 0; j < state.playlist.length; j++) {
            if (state.playlist[j].playlist === playlistName) {
                tracks.push(state.playlist[j]);
            }
        }
        return tracks;
    }
}

function shuffleArray(arr) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp; } return arr; }

// ============================================================
// 10. ОТРИСОВКА
// ============================================================
function getCoverUrl(track) {
    if (track.coverImage) return track.coverImage;
    if (track.thumbnail) return track.thumbnail;
    return "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%232a2a2a%22/%3E%3Ctext x=%2220%22 y=%2220%22 font-size=%2220%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23666%22%3E🎵%3C/text%3E%3C/svg%3E";
}

function createTrackCard(track, source) {
    var div = document.createElement('div');
    div.className = 'track-item';
    var coverDiv = document.createElement('div');
    coverDiv.className = 'track-cover';
    coverDiv.style.backgroundImage = 'url(' + getCoverUrl(track) + ')';
    div.appendChild(coverDiv);

    var info = document.createElement('div');
    info.className = 'track-info';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = track.name;
    var artistSpan = document.createElement('span');
    artistSpan.className = 'artist';
    artistSpan.textContent = track.artist || 'Неизвестен';
    info.appendChild(nameSpan);
    info.appendChild(artistSpan);
    div.appendChild(info);

    var actions = document.createElement('div');
    actions.className = 'track-actions';
    var favBtn = document.createElement('button');
    favBtn.textContent = isFavorite(track) ? '♥' : '♡';
    favBtn.onclick = function(e) {
        e.stopPropagation();
        toggleFavorite(track);
    };
    actions.appendChild(favBtn);

    if (source === 'local') {
        var delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.onclick = function(e) {
            e.stopPropagation();
            deleteLocalTrack(track.id);
        };
        actions.appendChild(delBtn);
    } else if (source === 'playlist') {
        var delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.onclick = function(e) {
            e.stopPropagation();
            removeFromPlaylist(track.id);
        };
        actions.appendChild(delBtn);
    } else if (source === 'favorites') {
        var delBtn = document.createElement('button');
        delBtn.textContent = '✕';
        delBtn.onclick = function(e) {
            e.stopPropagation();
            toggleFavorite(track);
        };
        actions.appendChild(delBtn);
    }
    div.appendChild(actions);

    div.onclick = function() {
        if (source === 'playlist') {
            playTrackFromPlaylist(track.id);
        } else if (source === 'favorites') {
            // в избранном может не быть id, используем originalId
            playTrackDirect(track.originalId || track.id, 'favorites');
        } else {
            playTrackDirect(track.id, source);
        }
    };
    return div;
}

function createPlaylistCard(name) {
    var div = document.createElement('div');
    div.className = 'card';
    var content = document.createElement('div');
    content.className = 'card-content';

    var coverUrl = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 52 52%22%3E%3Crect width=%2252%22 height=%2252%22 fill=%22%232a2a2a%22/%3E%3Ctext x=%2226%22 y=%2226%22 font-size=%2224%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23666%22%3E📋%3C/text%3E%3C/svg%3E";
    var firstTrack = null;
    for (var i = 0; i < state.playlist.length; i++) {
        if (state.playlist[i].playlist === name) {
            firstTrack = state.playlist[i];
            break;
        }
    }
    if (firstTrack) {
        coverUrl = getCoverUrl(firstTrack);
    }

    var coverDiv = document.createElement('div');
    coverDiv.className = 'card-cover';
    coverDiv.style.backgroundImage = 'url(' + coverUrl + ')';
    content.appendChild(coverDiv);

    var info = document.createElement('div');
    info.className = 'card-info';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = name;
    var artistSpan = document.createElement('span');
    artistSpan.className = 'artist';
    var count = 0;
    for (var j = 0; j < state.playlist.length; j++) {
        if (state.playlist[j].playlist === name) count++;
    }
    artistSpan.textContent = count + ' песен';
    info.appendChild(nameSpan);
    info.appendChild(artistSpan);
    content.appendChild(info);

    var delBtn = document.createElement('button');
    delBtn.className = 'del-pl-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = function(e) {
        e.stopPropagation();
        deletePlaylist(name);
    };
    content.appendChild(delBtn);

    div.appendChild(content);
    div.onclick = function() {
        state.currentPlaylist = name;
        switchSection('playlists');
        renderPlaylistTabs();
        renderPlaylistGrid();
    };
    return div;
}

function renderMainGrid() {
    var grid = document.getElementById('mainGrid');
    grid.innerHTML = '';
    if (state.playlists.length === 0) {
        grid.innerHTML = '<div class="empty-grid">Нет плейлистов. Создайте первый!</div>';
        return;
    }
    for (var i = 0; i < state.playlists.length; i++) {
        grid.appendChild(createPlaylistCard(state.playlists[i]));
    }
}

function renderPlaylistTabs() {
    var container = document.getElementById('playlistTabs');
    container.innerHTML = '';
    var sidebarList = document.getElementById('sidebarPlaylists');
    sidebarList.innerHTML = '';

    if (state.playlists.length === 0) {
        container.innerHTML = '<span style="color:#6a6a6a;font-size:13px;">Нет плейлистов</span>';
        sidebarList.innerHTML = '<div class="empty-msg">Нет плейлистов</div>';
        updateWaveDropdown();
        return;
    }

    for (var i = 0; i < state.playlists.length; i++) {
        var name = state.playlists[i];
        // Вкладки вверху
        var span = document.createElement('span');
        span.style.cssText = 'padding:4px 12px;background:#1a1a1a;border-radius:16px;cursor:pointer;font-size:13px;color:' + (name === state.currentPlaylist ? '#fff' : '#9a9a9a') + ';';
        span.textContent = name;
        span.onclick = function(n) { return function() { switchPlaylist(n); }; }(name);
        container.appendChild(span);

        // Элемент в боковой панели
        var itemDiv = document.createElement('div');
        itemDiv.className = 'item' + (name === state.currentPlaylist ? ' active' : '');
        var coverDiv = document.createElement('div');
        coverDiv.className = 'playlist-cover';
        var first = null;
        for (var j = 0; j < state.playlist.length; j++) {
            if (state.playlist[j].playlist === name) {
                first = state.playlist[j];
                break;
            }
        }
        if (first) {
            coverDiv.style.backgroundImage = 'url(' + getCoverUrl(first) + ')';
        } else {
            coverDiv.style.backgroundImage = "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 28 28%22%3E%3Crect width=%2228%22 height=%2228%22 fill=%22%232a2a2a%22/%3E%3Ctext x=%2214%22 y=%2214%22 font-size=%2214%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23666%22%3E📋%3C/text%3E%3C/svg%3E')";
        }
        itemDiv.appendChild(coverDiv);

        var nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        nameSpan.textContent = name;
        // При клике на название плейлиста в боковой панели — переключаем секцию на плейлисты и выбираем этот плейлист
        nameSpan.onclick = function(n) {
            return function(e) {
                e.stopPropagation();
                switchSection('playlists');
                switchPlaylist(n);
            };
        }(name);
        itemDiv.appendChild(nameSpan);

        var delBtn = document.createElement('button');
        delBtn.className = 'del-pl-btn';
        delBtn.textContent = '✕';
        delBtn.onclick = function(n) { return function(e) {
            e.stopPropagation();
            deletePlaylist(n);
        }; }(name);
        itemDiv.appendChild(delBtn);
        sidebarList.appendChild(itemDiv);
    }
    updateWaveDropdown();
}

function updateWaveDropdown() {
    var sub = document.getElementById('playlistWaveSub');
    if (!sub) return;
    sub.innerHTML = '';
    if (state.playlists.length === 0) {
        sub.innerHTML = '<div class="empty-msg">Нет плейлистов</div>';
        document.getElementById('waveBtn').classList.add('disabled');
        return;
    }
    document.getElementById('waveBtn').classList.remove('disabled');
    var allSpan = document.createElement('span');
    allSpan.className = 'all';
    allSpan.textContent = 'Все плейлисты';
    allSpan.onclick = function() { playPlaylistWave('all'); };
    sub.appendChild(allSpan);
    for (var k = 0; k < state.playlists.length; k++) {
        var name = state.playlists[k];
        var span2 = document.createElement('span');
        span2.textContent = name;
        span2.onclick = function(n) { return function() { playPlaylistWave(n); }; }(name);
        sub.appendChild(span2);
    }
}

function renderPlaylistGrid() {
    var grid = document.getElementById('playlistGrid');
    grid.innerHTML = '';
    if (state.playlists.length === 0 || !state.currentPlaylist) {
        grid.innerHTML = '<div class="empty-grid">Нет плейлистов</div>';
        document.getElementById('playlistTitle').textContent = 'Плейлисты';
        return;
    }
    document.getElementById('playlistTitle').textContent = state.currentPlaylist;
    var tracks = [];
    for (var i = 0; i < state.playlist.length; i++) {
        if (state.playlist[i].playlist === state.currentPlaylist) {
            tracks.push(state.playlist[i]);
        }
    }
    if (tracks.length === 0) {
        grid.innerHTML = '<div class="empty-grid">Нет треков в этом плейлисте</div>';
        return;
    }
    for (var j = 0; j < tracks.length; j++) {
        grid.appendChild(createTrackCard(tracks[j], 'playlist'));
    }
}

function renderFavoritesGrid() {
    var grid = document.getElementById('favoritesGrid');
    grid.innerHTML = '';
    var favs = getFavoriteTracks();
    if (favs.length === 0) {
        grid.innerHTML = '<div class="empty-grid">Нет избранных треков</div>';
        return;
    }
    for (var i = 0; i < favs.length; i++) {
        var fav = favs[i];
        var displayTrack = {
            id: fav.originalId || 'fav_' + i,
            originalId: fav.originalId,
            name: fav.name,
            artist: fav.artist,
            duration: fav.duration,
            cover: fav.cover,
            thumbnail: fav.thumbnail,
            videoId: fav.videoId,
            isExternal: fav.isExternal,
            coverImage: fav.coverImage
        };
        grid.appendChild(createTrackCard(displayTrack, 'favorites'));
    }
}

function renderAll() {
    renderMainGrid();
    renderPlaylistTabs();
    renderPlaylistGrid();
    renderFavoritesGrid();
    updateFavoriteButton();
    updateNowPlaying();
    saveState();
}

// ============================================================
// 11. НАВИГАЦИЯ И ПЛЕЙЛИСТЫ
// ============================================================
function switchSection(section) {
    document.querySelectorAll('.main > div[id^="section-"]').forEach(function(el) { el.style.display = 'none'; });
    document.getElementById('section-' + section).style.display = 'block';
    document.querySelectorAll('.sidebar .nav li').forEach(function(li) { li.classList.remove('active'); });
    var navMap = { 'main': 0, 'search': 1, 'playlists': 2, 'favorites': 3 };
    var navItems = document.querySelectorAll('.sidebar .nav li');
    if (navItems.length > navMap[section]) navItems[navMap[section]].classList.add('active');
    if (section === 'search') document.getElementById('searchInput').focus();
    if (section === 'playlists') {
        renderPlaylistTabs();
        renderPlaylistGrid();
    }
    if (section === 'main') renderMainGrid();
    if (section === 'favorites') renderFavoritesGrid();
}

function switchPlaylist(name) {
    if (!name || state.playlists.indexOf(name) === -1) {
        state.currentPlaylist = state.playlists.length > 0 ? state.playlists[0] : null;
    } else {
        state.currentPlaylist = name;
    }
    // Если текущая секция не плейлисты, переключаем
    var currentSection = document.querySelector('.main > div[id^="section-"]:not([style*="display: none"])');
    if (currentSection && currentSection.id !== 'section-playlists') {
        switchSection('playlists');
    } else {
        // Если уже на плейлистах, просто перерисовываем
        renderPlaylistTabs();
        renderPlaylistGrid();
    }
}

function showCreatePlaylist() {
    document.getElementById('modal').classList.add('active');
    document.getElementById('playlistName').value = '';
    document.getElementById('playlistName').focus();
}

function closeModal() { document.getElementById('modal').classList.remove('active'); }

function createPlaylist() {
    var name = document.getElementById('playlistName').value.trim();
    if (!name) { showNotification('Введите название', 'error'); return; }
    if (state.playlists.indexOf(name) !== -1) { showNotification('Плейлист уже существует', 'error'); return; }
    state.playlists.push(name);
    state.currentPlaylist = name;
    closeModal();
    renderAll();
    showNotification('✅ Плейлист "' + name + '" создан!', 'success');
}

function deletePlaylist(name) {
    if (!confirm('Удалить плейлист "' + name + '"?')) return;
    state.playlists = state.playlists.filter(function(p) { return p !== name; });
    state.playlist = state.playlist.filter(function(t) { return t.playlist !== name; });
    if (state.currentPlaylist === name) {
        state.currentPlaylist = state.playlists.length > 0 ? state.playlists[0] : null;
    }
    renderAll();
    showNotification('🗑️ Плейлист удален', 'info');
}

// ============================================================
// 12. ДОБАВЛЕНИЕ СВОЕГО ТРЕКА (с автоматическим извлечением обложки)
// ============================================================
function showAddTrackModal() {
    if (state.playlists.length === 0) {
        showNotification('Сначала создайте плейлист', 'error');
        return;
    }
    if (!state.currentPlaylist) {
        showNotification('Выберите плейлист', 'error');
        return;
    }
    document.getElementById('addTrackModal').classList.add('active');
    document.getElementById('audioFile').value = '';
}

function closeAddTrackModal() {
    document.getElementById('addTrackModal').classList.remove('active');
}

function addTrackFromFile() {
    var input = document.getElementById('audioFile');
    var file = input.files[0];
    if (!file) {
        showNotification('Выберите аудиофайл', 'error');
        return;
    }

    var name = file.name.replace(/\.[^/.]+$/, '');
    var id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

    var reader = new FileReader();
    reader.onload = function(event) {
        var audioData = event.target.result;
        saveFileToDB(STORE_AUDIO, id, audioData, file.type).then(function() {
            var audioUrl = URL.createObjectURL(new Blob([audioData], { type: file.type }));

            var tagsReader = new FileReader();
            tagsReader.onload = function(ev) {
                var buffer = ev.target.result;
                if (window.jsmediatags) {
                    window.jsmediatags.read(buffer, {
                        onSuccess: function(tag) {
                            var coverData = null;
                            if (tag.tags && tag.tags.picture) {
                                var picture = tag.tags.picture;
                                var blob = new Blob([picture.data], { type: picture.format });
                                var readerBlob = new FileReader();
                                readerBlob.onload = function(e) {
                                    coverData = e.target.result;
                                    saveFileToDB(STORE_COVERS, id, coverData, picture.format).then(function() {
                                        var artist = tag.tags.artist || 'Мой трек';
                                        var title = tag.tags.title || name;
                                        createAndAddTrack(id, title, artist, audioUrl, coverData);
                                    }).catch(function(err) {
                                        createAndAddTrack(id, name, 'Мой трек', audioUrl, null);
                                    });
                                };
                                readerBlob.readAsDataURL(blob);
                            } else {
                                var artist = tag.tags.artist || 'Мой трек';
                                var title = tag.tags.title || name;
                                createAndAddTrack(id, title, artist, audioUrl, null);
                            }
                        },
                        onError: function(error) {
                            createAndAddTrack(id, name, 'Мой трек', audioUrl, null);
                        }
                    });
                } else {
                    createAndAddTrack(id, name, 'Мой трек', audioUrl, null);
                }
            };
            tagsReader.readAsArrayBuffer(file);
        }).catch(function(err) {
            showNotification('Ошибка сохранения аудио', 'error');
        });
    };
    reader.readAsArrayBuffer(file);
}

function createAndAddTrack(id, name, artist, audioUrl, coverData) {
    var newTrack = {
        id: id,
        name: name,
        artist: artist,
        url: audioUrl,
        duration: '0:00',
        cover: 'custom',
        coverImage: coverData || null
    };

    state.localTracks.push(newTrack);
    // Сразу добавляем в текущий плейлист (создаём копию с уникальным id)
    addTrackToSpecificPlaylist(newTrack, state.currentPlaylist);

    closeAddTrackModal();
    renderAll();
    showNotification('✅ Трек "' + name + '" добавлен в плейлист "' + state.currentPlaylist + '"', 'success');
}

// ============================================================
// 13. ДОБАВЛЕНИЕ ТЕКУЩЕГО ТРЕКА В ПЛЕЙЛИСТ (С УНИКАЛЬНЫМ ID)
// ============================================================
function addCurrentTrackToPlaylist() {
    var track = getCurrentTrack();
    if (!track) {
        showNotification('Нет текущего трека', 'error');
        return;
    }

    var playlistCount = state.playlists.length;
    if (playlistCount === 0) {
        showNotification('Сначала создайте плейлист', 'error');
        return;
    }

    if (playlistCount === 1) {
        var onlyPlaylist = state.playlists[0];
        addTrackToSpecificPlaylist(track, onlyPlaylist);
    } else {
        showPlaylistSelect(track);
    }
}

function addTrackToSpecificPlaylist(track, playlistName) {
    // Проверяем, есть ли уже такой трек (по originalId или id) в этом плейлисте
    var originalId = track.originalId || track.id;
    for (var i = 0; i < state.playlist.length; i++) {
        if (state.playlist[i].originalId === originalId && state.playlist[i].playlist === playlistName) {
            showNotification('Трек уже есть в плейлисте "' + playlistName + '"', 'info');
            return;
        }
    }

    // Создаём уникальную копию с новым id
    var newId = 'pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    var copyTrack = {
        id: newId,
        originalId: originalId,
        name: track.name,
        artist: track.artist || 'Неизвестен',
        url: track.url || '',
        duration: track.duration || '3:00',
        cover: track.cover || 'c1',
        coverImage: track.coverImage || null,
        thumbnail: track.thumbnail || null,
        videoId: track.videoId || null,
        isExternal: !!(track.videoId),
        playlist: playlistName
    };

    state.playlist.push(copyTrack);
    renderAll();
    showNotification('✅ Трек "' + track.name + '" добавлен в плейлист "' + playlistName + '"', 'success');
}

function showPlaylistSelect(track) {
    var modal = document.getElementById('playlistSelectModal');
    var list = document.getElementById('playlistSelectList');
    list.innerHTML = '';

    for (var i = 0; i < state.playlists.length; i++) {
        var name = state.playlists[i];
        var item = document.createElement('div');
        item.className = 'playlist-select-item';

        var coverUrl = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 fill=%22%232a2a2a%22/%3E%3Ctext x=%2216%22 y=%2216%22 font-size=%2216%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23666%22%3E📋%3C/text%3E%3C/svg%3E";
        var first = null;
        for (var j = 0; j < state.playlist.length; j++) {
            if (state.playlist[j].playlist === name) {
                first = state.playlist[j];
                break;
            }
        }
        if (first) {
            coverUrl = getCoverUrl(first);
        }

        var coverDiv = document.createElement('div');
        coverDiv.className = 'pl-cover';
        coverDiv.style.backgroundImage = 'url(' + coverUrl + ')';
        item.appendChild(coverDiv);

        var nameSpan = document.createElement('span');
        nameSpan.className = 'pl-name';
        nameSpan.textContent = name;
        item.appendChild(nameSpan);

        item.onclick = function(n) {
            return function() {
                addTrackToSpecificPlaylist(track, n);
                closePlaylistSelect();
            };
        }(name);

        list.appendChild(item);
    }

    modal.classList.add('active');
}

function closePlaylistSelect() {
    document.getElementById('playlistSelectModal').classList.remove('active');
}

// ============================================================
// 14. УДАЛЕНИЕ ТРЕКА ИЗ ПЛЕЙЛИСТА (ТОЛЬКО ЭТУ КОПИЮ)
// ============================================================
function removeFromPlaylist(trackId) {
    if (!confirm('Удалить этот трек из плейлиста?')) return;
    // Удаляем только ту копию, которая имеет этот id
    state.playlist = state.playlist.filter(function(t) { return t.id !== trackId; });
    // Если удалённый трек был текущим, сбрасываем индекс
    if (state.currentIndex >= state.playlist.length) {
        state.currentIndex = state.playlist.length - 1;
        if (state.currentIndex >= 0) playCurrentPlaylistTrack();
        else {
            state.isPlaying = false;
            updatePlayButton();
            document.getElementById('playerName').textContent = 'Нет трека';
            document.getElementById('playerArtist').textContent = '-';
            document.getElementById('playerCover').style.backgroundImage = "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%232a2a2a%22/%3E%3Ctext x=%2220%22 y=%2220%22 font-size=%2220%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23666%22%3E🎵%3C/text%3E%3C/svg%3E')";
        }
    }
    renderAll();
    showNotification('🗑️ Трек удален из плейлиста', 'info');
}

// ============================================================
// 15. ЛОКАЛЬНЫЕ ФАЙЛЫ (для "Моя музыка")
// ============================================================
function addLocalFiles() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.multiple = true;
    input.onchange = function(e) {
        var files = e.target.files;
        var added = 0;
        for (var f = 0; f < files.length; f++) {
            var file = files[f];
            var reader = new FileReader();
            reader.onload = function(fileObj) {
                return function(event) {
                    var arrayBuffer = event.target.result;
                    var name = fileObj.name.replace(/\.[^/.]+$/, '');
                    var id = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
                    saveFileToDB(STORE_AUDIO, id, arrayBuffer, fileObj.type).then(function() {
                        var url = URL.createObjectURL(new Blob([arrayBuffer], { type: fileObj.type }));
                        state.localTracks.push({ id: id, name: name, artist: 'Моя музыка', url: url, duration: '0:00', cover: 'c' + (Math.floor(Math.random() * 8) + 1), coverImage: null });
                        added++;
                        if (added === files.length) { renderAll();
                            showNotification('✅ Добавлено ' + added + ' файлов', 'success'); }
                    }).catch(function(err) { showNotification('Ошибка сохранения', 'error'); });
                };
            }(file);
            reader.readAsArrayBuffer(file);
        }
    };
    input.click();
}

function deleteLocalTrack(trackId) {
    if (!confirm('Удалить этот трек?')) return;
    // Удаляем из IndexedDB
    Promise.all([
        deleteFileFromDB(STORE_AUDIO, trackId),
        deleteFileFromDB(STORE_COVERS, trackId)
    ]).then(function() {
        // Удаляем из state.localTracks
        state.localTracks = state.localTracks.filter(function(t) { return t.id !== trackId; });
        // Удаляем все копии из плейлистов, где originalId === trackId
        state.playlist = state.playlist.filter(function(t) { return t.originalId !== trackId; });
        // Удаляем из избранного по originalId
        state.favorites = state.favorites.filter(function(t) { return t.originalId !== trackId; });
        saveState();
        if (state.isTempMode && state.tempPlaylist.length > 0 && state.tempPlaylist[state.tempCurrentIndex] && state.tempPlaylist[state.tempCurrentIndex].id === trackId) {
            state.isTempMode = false;
            state.tempPlaylist = [];
            state.isPlaying = false;
            audio.pause();
            updatePlayButton();
            document.getElementById('playerName').textContent = 'Нет трека';
            document.getElementById('playerArtist').textContent = '-';
            document.getElementById('playerCover').style.backgroundImage = "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%232a2a2a%22/%3E%3Ctext x=%2220%22 y=%2220%22 font-size=%2220%22 text-anchor=%22middle%22 dy=%22.35em%22 fill=%22%23666%22%3E🎵%3C/text%3E%3C/svg%3E')";
        }
        renderAll();
        showNotification('🗑️ Трек удален', 'info');
    }).catch(function(e) { showNotification('Ошибка удаления', 'error'); });
}

// ============================================================
// 16. ТЕМА, УВЕДОМЛЕНИЯ, АУДИО
// ============================================================
function toggleTheme() {
    document.body.classList.toggle('light');
    state.theme = document.body.classList.contains('light') ? 'light' : 'dark';
    saveState();
    showNotification('🌓 Тема: ' + (state.theme === 'light' ? 'Светлая' : 'Темная'), 'info');
}

function showNotification(text, type) {
    type = type || 'info';
    var oldNotif = document.querySelector('.notif');
    if (oldNotif) oldNotif.remove();
    var notif = document.createElement('div');
    notif.className = 'notif';
    notif.style.borderLeftColor = type === 'error' ? '#ff2d55' : type === 'success' ? '#1db954' : '#3b82f6';
    notif.innerHTML = '<span>' + text + '</span><button class="close" onclick="this.parentElement.remove()">✕</button>';
    document.body.appendChild(notif);
    setTimeout(function() { if (notif.parentElement) notif.remove(); }, 4000);
}

function setupAudioEvents() {
    audio.addEventListener('timeupdate', function() {
        if (audio.duration) {
            var progress = (audio.currentTime / audio.duration) * 100;
            document.getElementById('progressBar').value = progress;
            document.getElementById('currentTime').textContent = formatTime(audio.currentTime);
            document.getElementById('totalTime').textContent = formatTime(audio.duration);
        }
    });
    audio.addEventListener('ended', function() {
        if (state.isTempMode && state.tempPlaylist.length > 0) {
            var nextIndex = (state.tempCurrentIndex + 1) % state.tempPlaylist.length;
            playFromTempPlaylist(nextIndex);
            return;
        }
        if (state.isTempMode) { state.isPlaying = false;
            updatePlayButton();
            document.getElementById('playerCover').classList.remove('playing'); return; }
        if (state.repeat === 1) { audio.currentTime = 0;
            audio.play().catch(function(e) {}); } else if (state.repeat === 2 || state.repeat === 0) { nextTrack(); }
    });
    audio.addEventListener('error', function() { showNotification('Ошибка воспроизведения', 'error'); });
}

function setupVolumeControl() {
    var volumeBar = document.getElementById('volumeBar');
    volumeBar.addEventListener('input', function() {
        audio.volume = this.value / 100;
        state.volume = this.value;
        saveState();
    });
    audio.volume = state.volume / 100;
}

function setupProgressControl() {
    var progressBar = document.getElementById('progressBar');
    progressBar.addEventListener('input', function() {
        if (audio.duration) { audio.currentTime = (this.value / 100) * audio.duration; }
        if (externalPlayer && externalPlayer.seekTo) { var total = externalPlayer.getDuration(); if (total > 0) externalPlayer.seekTo((this.value / 100) * total); }
    });
}

// ============================================================
// 17. ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    state.allTracks = generateTracks(20);
    var loaded = loadState();
    if (!loaded) {
        state.playlist = [];
        state.playlists = [];
        state.currentPlaylist = null;
        state.localTracks = [];
        state.playCounts = {};
        state.favorites = [];
    }

    Promise.all([
        getAllFilesFromDB(STORE_AUDIO),
        getAllFilesFromDB(STORE_COVERS)
    ]).then(function(results) {
        var audioFiles = results[0] || [];
        var coverFiles = results[1] || [];

        // Восстанавливаем URL для локальных треков
        if (audioFiles && audioFiles.length) {
            for (var i = 0; i < state.localTracks.length; i++) {
                var track = state.localTracks[i];
                for (var j = 0; j < audioFiles.length; j++) {
                    if (audioFiles[j].id === track.id) {
                        var blob = new Blob([audioFiles[j].data], { type: audioFiles[j].type });
                        track.url = URL.createObjectURL(blob);
                        break;
                    }
                }
            }
            // Для копий в плейлисте тоже восстанавливаем url, если они локальные
            for (var k = 0; k < state.playlist.length; k++) {
                var pTrack = state.playlist[k];
                if (pTrack.originalId && pTrack.originalId.indexOf('local_') === 0) {
                    for (var m = 0; m < audioFiles.length; m++) {
                        if (audioFiles[m].id === pTrack.originalId) {
                            var blob2 = new Blob([audioFiles[m].data], { type: audioFiles[m].type });
                            pTrack.url = URL.createObjectURL(blob2);
                            break;
                        }
                    }
                }
            }
        }

        // Восстанавливаем обложки для локальных треков и копий
        if (coverFiles && coverFiles.length) {
            var coverMap = {};
            coverFiles.forEach(function(item) {
                coverMap[item.id] = item.data;
            });
            state.localTracks.forEach(function(track) {
                if (coverMap[track.id]) {
                    track.coverImage = coverMap[track.id];
                }
            });
            state.playlist.forEach(function(track) {
                if (coverMap[track.originalId]) {
                    track.coverImage = coverMap[track.originalId];
                }
            });
            state.favorites.forEach(function(track) {
                if (coverMap[track.originalId]) {
                    track.coverImage = coverMap[track.originalId];
                }
            });
        }

        if (state.theme === 'light') document.body.classList.add('light');
        else document.body.classList.remove('light');

        document.getElementById('volumeBar').value = state.volume;
        audio.volume = state.volume / 100;

        renderAll();
        setupAudioEvents();
        setupVolumeControl();
        setupProgressControl();
        updateFavoriteButton();
        updateNowPlaying();
        showNotification('🎵 Добро пожаловать!', 'success');
    }).catch(function(e) {
        console.warn('IndexedDB error', e);
        renderAll();
    });
});

window.addEventListener('beforeunload', function() { saveState(); });

document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault();
        togglePlay(); }
    if (e.code === 'ArrowRight') nextTrack();
    if (e.code === 'ArrowLeft') prevTrack();
});

console.log('🎵 Плеер загружен');