# Dockerfile
FROM node:22-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3006
CMD ["node", "dist/main.js"]