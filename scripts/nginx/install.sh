#!/bin/sh
# Puts desk.conf in place on the server and reloads nginx; the old file is kept beside it.
set -e
sudo mkdir -p /var/cache/nginx/desk && sudo chown www-data:www-data /var/cache/nginx/desk
sudo cp /etc/nginx/conf.d/desk.conf /etc/nginx/desk.conf.bak
sudo tee /etc/nginx/conf.d/desk.conf >/dev/null
if sudo nginx -t -q; then sudo systemctl reload nginx && echo "nginx reloaded"; else sudo cp /etc/nginx/desk.conf.bak /etc/nginx/conf.d/desk.conf; echo "config refused, old one kept"; exit 1; fi
