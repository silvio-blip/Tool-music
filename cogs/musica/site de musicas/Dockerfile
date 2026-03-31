FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 py3-pip ffmpeg curl

RUN pip3 install --break-system-packages yt-dlp

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
