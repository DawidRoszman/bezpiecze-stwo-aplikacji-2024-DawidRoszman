FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install
RUN npm install -g typescript

COPY . .

EXPOSE 5000

RUN tsc

CMD ["node", "index.js"]