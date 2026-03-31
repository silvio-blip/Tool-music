# 🎵 SoundCloud Player Web

Player de música estilo Spotify que toca no navegador. **Separado do bot Discord.**

## Como Usar

### 1. Iniciar o Servidor

```bash
cd cogs/musica/site de musicas
node server.js
```

Ou diretamente:
```bash
python -m app
```

### 2. Acessar a Interface











```
http://localhost:5000
```

## Recursos

- 🔍 Busca de músicas no SoundCloud
- ▶️ Play/Pause
- ⏭️ Próxima/Anterior
- 🔀 Shuffle
- 🔁 Repetir
- 🔊 Controle de volume
- ⏩ Barra de progresso (click to seek)
- 📋 Fila de reprodução

## Arquivos

```
site de musicas/
├── app.py              # Servidor Flask + API
├── run_music_server.py # Script de inicialização
├── templates/
│   └── index.html      # Interface HTML
├── static/
│   ├── style.css       # Estilos dark
│   └── script.js       # Player JavaScript
└── README.md           # Este arquivo
```

## Bot Discord

O bot Discord continua funcionando normalmente com os comandos:
- `/play` - Toca música no Discord
- `/queue` - Mostra fila
- `/skip` - Pula música
- `/pause` - Pausa
- `/resume` - Continua
- `/stop` - Para
- `/funk` - Toca funk aleatório

## Remover (se der erro)

```bash
rm -rf "cogs/musica/site de musicas"
```

E remover do requirements.txt:
```
flask
flask-cors
```
