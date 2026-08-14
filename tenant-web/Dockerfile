# ==========================================
# Tenant Web Production Dockerfile (Multi-stage)
# ==========================================
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build arguments for production environment (baked into Vite bundle)
ARG VITE_BACKEND_URL
ARG VITE_META_APP_ID
ARG VITE_META_CONFIG_ID
ARG VITE_APP_URL
ARG VITE_RAZORPAY_KEY_ID
ARG VITE_GOOGLE_CLIENT_ID

ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_META_APP_ID=${VITE_META_APP_ID}
ENV VITE_META_CONFIG_ID=${VITE_META_CONFIG_ID}
ENV VITE_APP_URL=${VITE_APP_URL}
ENV VITE_RAZORPAY_KEY_ID=${VITE_RAZORPAY_KEY_ID}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}

RUN npm run build

# Production Nginx server stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
