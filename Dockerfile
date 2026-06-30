FROM node:18-bullseye

# Install ffmpeg and python3 with gtts
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    pip3 install gtts && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV PORT=5000
EXPOSE 5000

CMD ["node", "server.js"]
