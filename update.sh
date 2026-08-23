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
[[ -d .git ]] || fail "Deze map is geen Git-repository. Clone de repository eerst op de server."

if [[ -n "$(git status --porcelain)" ]]; then
  fail "De repository bevat lokale wijzigingen. Commit of verwijder die eerst; de update is niet uitgevoerd."
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  fail "De actieve branch is '$CURRENT_BRANCH', maar '$BRANCH' werd verwacht."
fi

LOCAL_REVISION="$(git rev-parse HEAD)"
OLD_REVISION="$(git rev-parse --short HEAD)"

log "Controleren op een nieuwe versie op origin/$BRANCH"
git fetch origin "$BRANCH"
REMOTE_REVISION="$(git rev-parse "origin/$BRANCH")"
REMOTE_REVISION_SHORT="$(git rev-parse --short "origin/$BRANCH")"

if [[ "$LOCAL_REVISION" == "$REMOTE_REVISION" ]]; then
  log "Geen nieuwe versie beschikbaar. Versie $OLD_REVISION blijft ongewijzigd draaien."
  exit 0
fi

if ! git merge-base --is-ancestor "$LOCAL_REVISION" "$REMOTE_REVISION"; then
  fail "De lokale branch kan niet veilig worden bijgewerkt naar origin/$BRANCH. De branches lopen uiteen of lokaal staan nog niet-gepushte commits."
fi

command -v docker >/dev/null 2>&1 || fail "Docker is niet geïnstalleerd."
docker compose version >/dev/null 2>&1 || fail "Docker Compose is niet beschikbaar."
[[ -f docker-compose.yml ]] || fail "docker-compose.yml ontbreekt."
[[ -f .env ]] || fail "Het bestand .env ontbreekt. Kopieer .env.example naar .env en stel de wachtwoorden in."
grep -Eq '^ACCESS_PASSWORD=.+$' .env || fail "ACCESS_PASSWORD ontbreekt of is leeg in .env."

log "Nieuwe versie $REMOTE_REVISION_SHORT installeren"
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
