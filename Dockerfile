FROM node:24-alpine AS build
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
ARG VITE_API_BASE_PATH=/api/v1
ENV VITE_API_BASE_PATH=${VITE_API_BASE_PATH}
RUN npm run build && printf '%s' "$VITE_API_BASE_PATH" > /app/api-base-path

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
USER 101:101
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=build /app/api-base-path /etc/nginx/api-base-path
COPY nginx.conf /etc/nginx/triage.conf.template
COPY --chmod=755 container-entrypoint.sh /usr/local/bin/triage-entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/triage-entrypoint.sh"]
CMD ["nginx", "-c", "/tmp/triage-nginx.conf", "-g", "daemon off;"]
