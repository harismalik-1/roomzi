# Frontend-only Dockerfile for Railway - Minimal Build
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies to reduce size
RUN npm ci

# Copy source code
COPY . .

# Accept build arguments for environment variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_MAPBOX_TOKEN
ARG VITE_API_URL

# Set environment variables for the build
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
ENV VITE_API_URL=$VITE_API_URL

# Debug environment variables and build
RUN echo "=== BUILD DEBUG INFO ===" && \
    echo "VITE_API_URL: $VITE_API_URL" && \
    echo "VITE_SUPABASE_URL: $VITE_SUPABASE_URL" && \
    echo "All VITE_ env vars:" && \
    env | grep VITE_ && \
    echo "=========================" && \
    npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx config with cache-busting for JS/CSS
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  \
  # Cache-busting for JS/CSS files \
  location ~* \.(js|css)$ { \
    add_header Cache-Control "no-cache, no-store, must-revalidate"; \
    add_header Pragma "no-cache"; \
    add_header Expires "0"; \
    try_files $uri =404; \
  } \
  \
  # Default SPA routing \
  location / { \
    try_files $uri $uri/ /index.html; \
  } \
  \
  # Health check \
  location /health { \
    return 200 "OK"; \
  } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
# Cache bust Thu Aug  7 00:45:00 EDT 2025 - DEBUG ENV VARS
CMD ["nginx", "-g", "daemon off;"]
