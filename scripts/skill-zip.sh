#!/bin/sh
# scripts/skill-zip.sh — npm run skill:zip [-- <out.zip>]
#
# Packs the ariko-article skill for upload to the claude.ai account
# (Settings → Capabilities → Skills). Cloud sessions load account skills, and
# ignore a repo's `enabledPlugins` and the user's local plugins — so this one
# upload is how every sibling's cloud session gets the skill, and an edit to
# SKILL.md reaches them all by re-running this and re-uploading.
set -eu
out="${1:-$HOME/Desktop/ariko-article-skill.zip}"
case "$out" in /*) ;; *) out="$PWD/$out" ;; esac
rm -f "$out"
cd "$(dirname "$0")/../plugins/ariko-article/skills"
zip -qrX "$out" ariko-article -x '*.DS_Store'
echo "✓ $out — upload it at claude.ai → Settings → Capabilities → Skills"
