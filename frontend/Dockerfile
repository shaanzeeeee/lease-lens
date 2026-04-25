FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5173

# Expose host for Vite to map to localhost
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
