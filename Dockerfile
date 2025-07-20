FROM node:18

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY app.js ./

EXPOSE 3000

CMD ["npm", "start"]
