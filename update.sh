#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRANCH="${POETSROOSTER_BRANCH:-main}"
HEALTH_URL="${POETSROOSTER_HEALTH_URL:-http://127.0.0.1:8080/}"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

fail() {
  printf '\nFout: %s\n' "$1" >&2
  exit 1
}

command -v git >/dev/null 2>&1 || fail "Git is niet geïnstalleerd."
command -v docker >/dev/null 2>&1 || fail "Docker is niet geïnstalleerd."
docker compose version >/dev/null 2>&1 || fail "Docker Compose is niet beschikbaar."

[[ -d .git ]] || fail "Deze map is geen Git-repository. Clone de repository eerst op de server."
[[ -f docker-compose.yml ]] || fail "docker-compose.yml ontbreekt."
[[ -f .env ]] || fail "Het bestand .env ontbreekt. Kopieer .env.example naar .env en stel de wachtwoorden in."
grep -Eq '^ACCESS_PASSWORD=.+$' .env || fail "ACCESS_PASSWORD ontbreekt of is leeg in .env."

if [[ -n "$(git status --porcelain)" ]]; then
  fail "De repository bevat lokale wijzigingen. Commit of verwijder die eerst; de update is niet uitgevoerd."
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  fail "De actieve branch is '$CURRENT_BRANCH', maar '$BRANCH' werd verwacht."
fi

OLD_REVISION="$(git rev-parse --short HEAD)"

log "Nieuwe versie ophalen van origin/$BRANCH"
git fetch origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"

NEW_REVISION="$(git rev-parse --short HEAD)"
export APP_REVISION="$NEW_REVISION"
log "Docker-image bouwen ($OLD_REVISION → $NEW_REVISION)"
docker compose build --pull

log "Applicatie starten"
docker compose up -d --remove-orphans

if command -v curl >/dev/null 2>&1; then
  log "Bereikbaarheid controleren via $HEALTH_URL"
  for attempt in {1..20}; do
    if curl --fail --silent --show-error --output /dev/null "$HEALTH_URL"; then
      log "Update geslaagd. Versie $NEW_REVISION draait."
      exit 0
    fi
    if [[ "$attempt" -lt 20 ]]; then
      sleep 2
    fi
  done

  docker compose logs --tail=80 >&2 || true
  fail "De container draait, maar de bereikbaarheidscontrole bleef mislukken."
fi

log "Update geslaagd. Versie $NEW_REVISION draait (curl ontbreekt; geen HTTP-controle uitgevoerd)."
