FROM node:22-alpine
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY worker.mjs ./
USER node
CMD ["node", "worker.mjs"]
