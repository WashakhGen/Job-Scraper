#!/bin/sh
# Runs as root (image default) so it can fix ownership on the mounted data
# volume — which may already contain files from before this image ran as a
# non-root user — then drops to `appuser` for the actual process.
set -e

mkdir -p /app/data
chown -R appuser:appuser /app/data

exec su -s /bin/sh appuser -c "python main.py"
