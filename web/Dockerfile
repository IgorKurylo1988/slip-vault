FROM node:20-alpine

WORKDIR /app

# Copy package configurations and install dependencies
COPY package.json ./
RUN npm install

# Copy source files
COPY . .

# Expose Vite dev server port (configured to port 3000 in vite.config.ts)
EXPOSE 3000

# Start Vite dev server
CMD ["npm", "run", "dev"]
