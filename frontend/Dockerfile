# Frontend-only Dockerfile for Railway
FROM node:20-alpine as build

# Set working directory
WORKDIR /app

# Copy only frontend package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy frontend source code
COPY . .

# Build the application
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Copy built application
COPY --from=build /app/dist /usr/share/nginx/html

# Use default nginx config and just add a custom conf file
RUN echo 'server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } location /health { return 200 "OK"; add_header Content-Type text/plain; } }' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]