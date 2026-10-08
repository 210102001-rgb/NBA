#!/bin/sh
# Unduh Leaflet 1.9.4 (tidak disimpan di git karena >128KB).
cd "$(dirname "$0")"
[ -f leaflet.js ] && { echo "leaflet.js sudah ada"; exit 0; }
curl -sSL -o leaflet.js https://unpkg.com/leaflet@1.9.4/dist/leaflet.js && echo "leaflet.js diunduh"
