FROM node:20

WORKDIR /app

COPY package.json /app

RUN npm install

COPY . .

EXPOSE 4173

RUN npm run build

CMD ["npm", "run", "preview"]