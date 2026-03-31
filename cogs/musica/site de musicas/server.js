const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('static'));
app.use(express.static('templates'));

const YDL_OPTIONS = {
    format: 'bestaudio[ext=m4a]/bestaudio/best',
    noplaylist: true,
    quiet: true,
    nocheckcertificate: true,
    ignoreerrors: true,
    source_address: '0.0.0.0',
};

let queue = [];
let currentTrack = null;
let currentIndex = 0;

function formatDuration(seconds) {
    if (!seconds) return "0:00";
    const secs = Math.floor(seconds);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
}

const YTDLP_PATH = 'yt-dlp';

function execPromise(command) {
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(stdout);
        });
    });
}

async function searchSoundCloud(query) {
    try {
        const options = { ...YDL_OPTIONS, default_search: `scsearch10:${query}` };
        const optsString = Object.entries(options)
            .map(([k, v]) => `--${k} "${v}"`)
            .join(' ');

        const cmd = `${YTDLP_PATH} ${optsString} --dump-json --no-download -e "scsearch10:${query}"`;
        const output = await execPromise(cmd);

        const lines = output.trim().split('\n').filter(line => line.trim());
        for (const line of lines) {
            try {
                const info = JSON.parse(line);
                const duration = info.duration || 0;
                if (duration >= 50) {
                    return {
                        id: info.id || '',
                        url: info.url || info.id,
                        title: info.title || 'Música',
                        extractor: info.extractor || 'SoundCloud',
                        thumbnail: info.thumbnail || '',
                        duration: duration,
                        duration_str: formatDuration(duration),
                    };
                }
            } catch (e) {
                continue;
            }
        }
    } catch (error) {
        console.error('Erro na busca:', error.message);
    }
    return null;
}

async function getAllResults(query, page = 0) {
    const results = [];
    const limit = 15;
    try {
        const cmd = `${YTDLP_PATH} --dump-json --no-download "scsearch15:${query}"`;
        const output = await execPromise(cmd);

        const lines = output.trim().split('\n').filter(line => line.trim());
        
        let count = 0;
        for (const line of lines) {
            if (count >= limit) break;
            try {
                const info = JSON.parse(line);
                const duration = info.duration || 0;
                
                let thumbnail = info.thumbnail || '';
                if (!thumbnail && info.thumbnails) {
                    thumbnail = info.thumbnails[0]?.url || info.thumbnails[info.thumbnails.length - 1]?.url || '';
                }
                
                if (duration >= 30) {
                    results.push({
                        id: info.id || '',
                        url: info.url || info.id,
                        title: info.title || 'Música',
                        extractor: info.extractor || 'SoundCloud',
                        thumbnail: thumbnail,
                        duration: duration,
                        duration_str: formatDuration(duration),
                    });
                    count++;
                }
            } catch (e) {
                continue;
            }
        }
    } catch (error) {
        console.error('Erro na busca:', error.message);
    }
    return results;
}

async function getStreamUrl(url) {
    try {
        const cmd = `${YTDLP_PATH} --dump-json --no-download --no-check-certificate "${url}"`;
        const output = await execPromise(cmd);
        const info = JSON.parse(output);

        if (info.formats) {
            const sortedFormats = [...info.formats].sort((a, b) => {
                const aQuality = (a.tbr || a.abr || 0);
                const bQuality = (b.tbr || b.abr || 0);
                return bQuality - aQuality;
            });
            
            for (const f of sortedFormats) {
                const urlValue = f.url || '';
                const ext = f.ext || '';
                if (urlValue && ['m4a', 'mp3', 'aac', 'opus'].includes(ext)) {
                    return urlValue;
                }
            }
            
            if (info.formats.length > 0) {
                return sortedFormats[0].url;
            }
        }

        return info.url;
    } catch (error) {
        console.error('Erro ao obter stream:', error.message);
    }
    return null;
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/api/search', async (req, res) => {
    const query = req.query.q || '';
    const page = parseInt(req.query.page) || 0;
    if (!query) {
        return res.json({ results: [] });
    }

    const results = await getAllResults(query, page);
    res.json({ results });
});

app.get('/api/queue', (req, res) => {
    res.json({
        queue: queue,
        current_index: currentIndex,
        current_track: currentTrack
    });
});

app.post('/api/play', async (req, res) => {
    const { url, title, thumbnail, duration } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL não fornecida' });
    }

    const streamUrl = await getStreamUrl(url);
    if (!streamUrl) {
        return res.status(400).json({ error: 'Não foi possível obter a stream' });
    }

    const track = {
        url: url,
        stream_url: streamUrl,
        title: title || 'Música',
        thumbnail: thumbnail || '',
        duration: duration || 0,
        duration_str: formatDuration(duration),
    };

    queue.push(track);

    if (currentTrack === null) {
        currentTrack = track;
        currentIndex = 0;
    }

    res.json({
        success: true,
        track: track,
        queue_position: queue.length,
        is_playing: currentTrack !== null
    });
});

app.post('/api/play-now', async (req, res) => {
    const { url, title, thumbnail, duration } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL não fornecida' });
    }

    const streamUrl = await getStreamUrl(url);
    if (!streamUrl) {
        return res.status(400).json({ error: 'Não foi possível obter a stream' });
    }

    currentTrack = {
        url: url,
        stream_url: streamUrl,
        title: title || 'Música',
        thumbnail: thumbnail || '',
        duration: duration || 0,
        duration_str: formatDuration(duration),
    };
    currentIndex = 0;

    res.json({
        success: true,
        track: currentTrack
    });
});

app.post('/api/next', async (req, res) => {
    if (queue.length === 0) {
        currentTrack = null;
        return res.json({ success: true, track: null });
    }

    if (currentIndex < queue.length - 1) {
        currentIndex++;
    } else {
        currentIndex = 0;
    }

    currentTrack = queue[currentIndex];
    const streamUrl = await getStreamUrl(currentTrack.url);
    if (streamUrl) {
        currentTrack.stream_url = streamUrl;
    }

    res.json({
        success: true,
        track: currentTrack
    });
});

app.post('/api/prev', async (req, res) => {
    if (queue.length === 0) {
        currentTrack = null;
        return res.json({ success: true, track: null });
    }

    if (currentIndex > 0) {
        currentIndex--;
    } else {
        currentIndex = queue.length - 1;
    }

    currentTrack = queue[currentIndex];
    const streamUrl = await getStreamUrl(currentTrack.url);
    if (streamUrl) {
        currentTrack.stream_url = streamUrl;
    }

    res.json({
        success: true,
        track: currentTrack
    });
});

app.get('/api/current', (req, res) => {
    res.json({
        track: currentTrack,
        queue: queue,
        current_index: currentIndex
    });
});

app.post('/api/clear', (req, res) => {
    queue = [];
    currentTrack = null;
    currentIndex = 0;
    res.json({ success: true });
});

app.post('/api/remove', async (req, res) => {
    const { index } = req.body;

    if (index === undefined || index < 0 || index >= queue.length) {
        return res.status(400).json({ error: 'Índice inválido' });
    }

    queue.splice(index, 1);

    if (index < currentIndex) {
        currentIndex--;
    } else if (index === currentIndex && queue.length > 0) {
        if (currentIndex >= queue.length) {
            currentIndex = 0;
        }
        currentTrack = queue[currentIndex];
        const streamUrl = await getStreamUrl(currentTrack.url);
        if (streamUrl) {
            currentTrack.stream_url = streamUrl;
        }
    } else if (queue.length === 0) {
        currentTrack = null;
        currentIndex = 0;
    }

    res.json({ success: true });
});

app.get('/stream', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).send('URL não fornecida');
    }

    const streamUrl = await getStreamUrl(url);
    if (!streamUrl) {
        return res.status(400).send('Não foi possível obter a URL de stream');
    }

    res.redirect(streamUrl);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[🎵] Servidor de música iniciado na porta ${PORT}`);
});

module.exports = app;
