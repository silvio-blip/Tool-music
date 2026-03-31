const audioPlayer = document.getElementById('audioPlayer');
const searchInput = document.getElementById('searchInput');
const trackList = document.getElementById('trackList');
const mainContent = document.querySelector('.main-content');

let isPlaying = false;
let currentQueue = [];
let currentIndex = -1;
let currentTrack = null;
let currentGenre = 'all';
let shuffle = false;
let repeat = 'none';
let currentSearchQuery = '';
let allLoadedTracks = [];
let currentPage = 0;
let isLoadingMore = false;
let hasMoreResults = true;

const genreSearches = {
    'all': ['Brazilian funk', 'funk 2024'],
    'funk': ['Brazilian funk', 'funk 2024', 'MC funk', 'funk ostentação'],
    'rap': ['rap brasileiro', 'rap mt', 'rap sp'],
    'trap': ['trap brasileiro', 'trap 2024', 'trap mt'],
    'pop': ['pop brasileiro', 'pop 2024'],
    'sertanejo': ['sertanejo 2024', 'sertanejo universitario'],
    'pagode': ['pagode 2024', 'pagode novo'],
    'search': ['Brazilian funk', 'funk 2024', 'trap brasileiro']
};

searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value;
        if (query) {
            currentSearchQuery = query;
            currentGenre = 'search';
            searchMusic(query);
        }
    }
});

let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        if (e.target.value.length >= 2) {
            searchMusic(e.target.value);
        }
    }, 500);
});

async function searchMusic(query, append = false) {
    if (!query) return;
    
    if (!append) {
        currentPage = 0;
        allLoadedTracks = [];
        hasMoreResults = true;
        trackList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Buscando músicas...</p></div>';
    }
    
    if (!hasMoreResults || isLoadingMore) return;
    
    isLoadingMore = true;
    showLoadingMore();
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            allLoadedTracks = [...allLoadedTracks, ...data.results];
            renderSearchResults(allLoadedTracks);
            currentPage++;
            hasMoreResults = currentPage < 10 && data.results.length > 0;
        } else {
            hasMoreResults = false;
            if (allLoadedTracks.length === 0) {
                trackList.innerHTML = '<p style="color: var(--text-gray); padding: 20px;">Nenhuma música encontrada</p>';
            }
        }
    } catch (error) {
        console.error('Erro na busca:', error);
    } finally {
        isLoadingMore = false;
        hideLoadingMore();
    }
}

function renderSearchResults(results) {
    trackList.innerHTML = results.map((track, index) => `
        <div class="track-item" onclick="playTrack('${encodeURIComponent(JSON.stringify(track))}')">
            <span class="number">${index + 1}</span>
            <div class="album-art">
                ${track.thumbnail ? `<img src="${track.thumbnail}" alt="Capa">` : '<i class="fa-solid fa-music"></i>'}
            </div>
            <div class="track-text">
                <h4>${track.title}</h4>
                <p>${track.extractor} • ${track.duration_str}</p>
            </div>
            <span class="duration">${track.duration_str}</span>
        </div>
    `).join('');
}

async function playTrack(trackJson) {
    const track = JSON.parse(decodeURIComponent(trackJson));
    
    if (currentSearchQuery) {
        currentGenre = 'search';
    } else if (currentGenre === 'all') {
        currentGenre = 'all';
    }
    
    try {
        const response = await fetch('/api/play-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: track.url,
                title: track.title,
                thumbnail: track.thumbnail,
                duration: track.duration
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.track) {
            currentTrack = data.track;
            playAudio(data.track.stream_url);
            updatePlayerUI(data.track);
        }
    } catch (error) {
        console.error('Erro ao tocar:', error);
    }
}

function playAudio(streamUrl) {
    if (!streamUrl) {
        console.error('URL de stream inválida');
        return;
    }
    
    audioPlayer.src = streamUrl;
    audioPlayer.load();
    
    const playPromise = audioPlayer.play();
    
    playPromise
        .then(() => {
            isPlaying = true;
            updatePlayButton();
        })
        .catch(error => {
            if (error.name !== 'AbortError') {
                console.error('Erro ao reproduzir:', error);
            }
        });
}

function togglePlay() {
    if (!currentTrack) {
        if (currentQueue.length > 0) {
            playFromQueue(0);
        }
        return;
    }
    
    if (isPlaying) {
        audioPlayer.pause();
    } else {
        audioPlayer.play();
    }
    isPlaying = !isPlaying;
    updatePlayButton();
}

function updatePlayButton() {
    const playBtn = document.getElementById('playBtn');
    const mobilePlayBtn = document.getElementById('mobilePlayBtn');
    const icon = isPlaying ? '<i class="fa-solid fa-pause"></i>' : '<i class="fa-solid fa-play"></i>';
    playBtn.innerHTML = icon;
    if (mobilePlayBtn) mobilePlayBtn.innerHTML = icon;
}

function updatePlayerUI(track) {
    document.getElementById('trackTitle').textContent = track.title || 'Música';
    document.getElementById('trackArtist').textContent = track.extractor || 'SoundCloud';
    document.getElementById('totalTime').textContent = track.duration_str || '0:00';
    
    const albumArt = document.getElementById('albumArt');
    if (track.thumbnail) {
        albumArt.innerHTML = `<img src="${track.thumbnail}" alt="Capa">`;
    } else {
        albumArt.innerHTML = '<i class="fa-solid fa-music"></i>';
    }
}

async function nextTrack() {
    if (shuffle) {
        await playRandomFromGenre();
        return;
    }
    
    if (currentQueue.length === 0) {
        await playRandomFromGenre();
        return;
    }
    
    if (currentIndex < currentQueue.length - 1) {
        currentIndex++;
    } else if (repeat === 'all') {
        currentIndex = 0;
    } else {
        await playRandomFromGenre();
        return;
    }
    
    await playFromQueue(currentIndex);
}

async function prevTrack() {
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
        return;
    }
    
    if (shuffle) {
        await playRandomFromGenre();
        return;
    }
    
    if (currentQueue.length === 0) {
        await playRandomFromGenre();
        return;
    }
    
    if (currentIndex > 0) {
        currentIndex--;
    } else if (repeat === 'all') {
        currentIndex = currentQueue.length - 1;
    } else {
        currentIndex = 0;
    }
    
    await playFromQueue(currentIndex);
}

async function playFromQueue(index) {
    currentIndex = index;
    
    try {
        const response = await fetch('/api/current');
        const data = await response.json();
        
        if (data.track) {
            currentTrack = data.track;
            playAudio(data.track.stream_url);
            updatePlayerUI(data.track);
        }
    } catch (error) {
        console.error('Erro ao tocar da fila:', error);
    }
}

function seek(event) {
    const progressContainer = document.getElementById('progressContainer');
    const rect = progressContainer.getBoundingClientRect();
    const pos = (event.clientX - rect.left) / rect.width;
    
    if (currentTrack && currentTrack.duration) {
        audioPlayer.currentTime = pos * currentTrack.duration;
    }
}

function seekMobile(event) {
    const progressContainer = document.getElementById('mobileProgressContainer');
    const rect = progressContainer.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const pos = (clientX - rect.left) / rect.width;
    
    if (currentTrack && currentTrack.duration) {
        audioPlayer.currentTime = pos * currentTrack.duration;
    }
}

const progressContainer = document.getElementById('progressContainer');
progressContainer.addEventListener('click', seek);

const mobileProgressContainer = document.getElementById('mobileProgressContainer');
if (mobileProgressContainer) {
    mobileProgressContainer.addEventListener('click', seekMobile);
}

function setVolume(value) {
    audioPlayer.volume = value / 100;
}

audioPlayer.addEventListener('timeupdate', () => {
    if (currentTrack && currentTrack.duration) {
        const progress = (audioPlayer.currentTime / currentTrack.duration) * 100;
        document.getElementById('progressFill').style.width = `${progress}%`;
        
        const mobileProgressFill = document.getElementById('mobileProgressFill');
        if (mobileProgressFill) mobileProgressFill.style.width = `${progress}%`;
        
        const current = formatTime(audioPlayer.currentTime);
        document.getElementById('currentTime').textContent = current;
        
        const mobileCurrentTime = document.getElementById('mobileCurrentTime');
        if (mobileCurrentTime) mobileCurrentTime.textContent = current;
    }
});

audioPlayer.addEventListener('ended', () => {
    if (repeat === 'one') {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else if (shuffle) {
        playRandomFromGenre();
    } else {
        nextTrack();
    }
});

function toggleShuffle() {
    shuffle = !shuffle;
    const btn = document.getElementById('shuffleBtn');
    const mobileBtn = document.getElementById('mobileShuffleBtn');
    btn.classList.toggle('active', shuffle);
    if (mobileBtn) mobileBtn.classList.toggle('active', shuffle);
}

function toggleRepeat() {
    const modes = ['none', 'all', 'one'];
    const currentIndex = modes.indexOf(repeat);
    repeat = modes[(currentIndex + 1) % modes.length];
    
    const btn = document.getElementById('repeatBtn');
    const mobileBtn = document.getElementById('mobileRepeatBtn');
    if (repeat === 'one') {
        btn.classList.add('active');
        if (mobileBtn) mobileBtn.classList.add('active');
    } else if (repeat === 'all') {
        btn.classList.add('active');
        if (mobileBtn) mobileBtn.classList.add('active');
    } else {
        btn.classList.remove('active');
        if (mobileBtn) mobileBtn.classList.remove('active');
    }
}

async function playRandomFromGenre() {
    let query;
    if (currentSearchQuery) {
        query = currentSearchQuery;
    } else if (currentGenre !== 'all' && currentGenre !== 'search' && genreSearches[currentGenre]) {
        query = genreSearches[currentGenre][Math.floor(Math.random() * genreSearches[currentGenre].length)];
    } else {
        query = genreSearches['all'][Math.floor(Math.random() * genreSearches['all'].length)];
    }
    
    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const randomTrack = data.results[Math.floor(Math.random() * data.results.length)];
            await playTrackFromObject(randomTrack);
        }
    } catch (error) {
        console.error('Erro ao tocar aleatório:', error);
        nextTrack();
    }
}

async function playTrackFromObject(track) {
    try {
        const response = await fetch('/api/play-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: track.url,
                title: track.title,
                thumbnail: track.thumbnail,
                duration: track.duration
            })
        });
        
        const data = await response.json();
        
        if (data.success && data.track) {
            currentTrack = data.track;
            playAudio(data.track.stream_url);
            updatePlayerUI(data.track);
        }
    } catch (error) {
        console.error('Erro ao tocar:', error);
    }
}

audioPlayer.addEventListener('loadedmetadata', () => {
    if (currentTrack) {
        const totalTime = currentTrack.duration_str || formatTime(audioPlayer.duration);
        document.getElementById('totalTime').textContent = totalTime;
        
        const mobileTotalTime = document.getElementById('mobileTotalTime');
        if (mobileTotalTime) mobileTotalTime.textContent = totalTime;
    }
});

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function renderInitialResults(results) {
    trackList.innerHTML = `
        <div class="section-header">
            <h3>Recomendado para você</h3>
            <p style="color: var(--text-gray); font-size: 14px;">Músicas populares do momento</p>
        </div>
        ${results.map((track, index) => `
            <div class="track-item" onclick="playTrack('${encodeURIComponent(JSON.stringify(track))}')">
                <span class="number">${index + 1}</span>
                <div class="album-art">
                    ${track.thumbnail ? `<img src="${track.thumbnail}" alt="Capa">` : '<i class="fa-solid fa-music"></i>'}
                </div>
                <div class="track-text">
                    <h4>${track.title}</h4>
                    <p>${track.extractor} • ${track.duration_str}</p>
                </div>
                <span class="duration">${track.duration_str}</span>
            </div>
        `).join('')}
    `;
}

async function loadGenreMusic(genre, append = false) {
    const searches = genreSearches[genre] || ['funk 2024'];
    
    if (!append) {
        currentPage = 0;
        allLoadedTracks = [];
        hasMoreResults = true;
        trackList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Carregando...</p></div>';
    }
    
    if (!hasMoreResults || isLoadingMore) return;
    
    isLoadingMore = true;
    showLoadingMore();
    
    try {
        const query = searches[currentPage % searches.length];
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const uniqueResults = [];
            const seen = new Set();
            for (const track of data.results) {
                if (!seen.has(track.url)) {
                    seen.add(track.url);
                    uniqueResults.push(track);
                }
            }
            
            allLoadedTracks = [...allLoadedTracks, ...uniqueResults];
            renderInitialResults(allLoadedTracks);
            
            currentPage++;
            hasMoreResults = currentPage < 10;
        } else {
            hasMoreResults = false;
        }
    } catch (error) {
        console.error('Erro ao carregar músicas:', error);
    } finally {
        isLoadingMore = false;
        hideLoadingMore();
    }
}

async function loadInitialMusic(append = false) {
    const defaultSearches = ['Brazilian funk', 'funk 2024'];
    
    if (!append) {
        currentPage = 0;
        allLoadedTracks = [];
        hasMoreResults = true;
        trackList.innerHTML = '<div class="loading"><div class="spinner"></div><p>Carregando músicas...</p></div>';
    }
    
    if (!hasMoreResults || isLoadingMore) return;
    
    isLoadingMore = true;
    showLoadingMore();
    
    try {
        const query = defaultSearches[currentPage % defaultSearches.length];
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
            const uniqueResults = [];
            const seen = new Set();
            for (const track of data.results) {
                if (!seen.has(track.url)) {
                    seen.add(track.url);
                    uniqueResults.push(track);
                }
            }
            
            allLoadedTracks = [...allLoadedTracks, ...uniqueResults];
            renderInitialResults(allLoadedTracks);
            
            currentPage++;
            hasMoreResults = currentPage < 10;
        } else {
            hasMoreResults = false;
        }
    } catch (error) {
        console.error('Erro ao carregar músicas iniciais:', error);
    } finally {
        isLoadingMore = false;
        hideLoadingMore();
    }
}

function showLoadingMore() {
    const existingLoader = document.getElementById('loadingMore');
    if (existingLoader) return;
    
    const loader = document.createElement('div');
    loader.id = 'loadingMore';
    loader.className = 'loading-more';
    loader.innerHTML = '<div class="spinner-small"></div><span>Carregando mais...</span>';
    trackList.appendChild(loader);
}

function hideLoadingMore() {
    const loader = document.getElementById('loadingMore');
    if (loader) loader.remove();
}

document.addEventListener('DOMContentLoaded', () => {
    loadInitialMusic();
    
    mainContent.addEventListener('scroll', () => {
        const scrollTop = mainContent.scrollTop;
        const scrollHeight = mainContent.scrollHeight;
        const clientHeight = mainContent.clientHeight;
        
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            if (currentSearchQuery) {
                searchMusic(currentSearchQuery, true);
            } else if (currentGenre !== 'all') {
                loadGenreMusic(currentGenre, true);
            } else {
                loadInitialMusic(true);
            }
        }
    });
    
    document.querySelectorAll('.genre-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.genre-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentGenre = btn.dataset.genre;
            currentSearchQuery = '';
            
            if (currentGenre === 'all') {
                loadInitialMusic();
            } else {
                loadGenreMusic(currentGenre);
            }
        });
    });
});
