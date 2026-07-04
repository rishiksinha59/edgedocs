FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hocuspocus
USER hocuspocus

EXPOSE 1234
ENV PORT=1234

CMD ["node", "dist/index.js"]
