FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --only=production
COPY . .
CMD [ "node", "send-notifications.js" ] # The script that does the work