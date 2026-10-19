#!/bin/sh
set -eu
fail() { printf '%s\n' "$1" >&2; exit 1; }
# Only an origin is accepted: never interpolate nginx syntax or a URI suffix.
[ -n "${API_UPSTREAM:-}" ] || fail 'API_UPSTREAM is required (for example http://triage-api:3000).'
printf '%s\n' "$API_UPSTREAM" | LC_ALL=C grep -Eq '^https?://([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?$' || fail 'API_UPSTREAM must be an http(s) origin without a path or credentials.'
# Reject embedded newlines even when one line matches the pattern.
[ "$(printf '%s' "$API_UPSTREAM" | wc -l)" -eq 0 ] || fail 'API_UPSTREAM must be a single line.'
API_BASE_PATH=$(cat "${API_BASE_PATH_FILE:-/etc/nginx/api-base-path}")
printf '%s\n' "$API_BASE_PATH" | LC_ALL=C grep -Eq '^/([A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+$' || fail 'Invalid baked API base path.'
export API_BASE_PATH API_UPSTREAM
# Explicit substitution preserves nginx variables such as $uri and $proxy_host.
envsubst '${API_BASE_PATH} ${API_UPSTREAM}' < "${NGINX_TEMPLATE:-/etc/nginx/triage.conf.template}" > "${NGINX_CONFIG:-/tmp/triage-nginx.conf}"
exec "$@"
