FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_URL
ARG VITE_GA_ID

COPY package.json package-lock.json ./
COPY client/package.json ./client/
RUN npm ci

COPY client/ ./client/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GA_ID=$VITE_GA_ID
RUN npm run build --workspace=client

FROM nginx:alpine

COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
