#!/bin/zsh
set -euo pipefail

PERL_PROJECT_DIR="${0:A:h}"
PERL_URL="http://127.0.0.1:4173/"
PERL_LOG="$PERL_PROJECT_DIR/data/deployment-review.log"

cd "$PERL_PROJECT_DIR"
mkdir -p "$PERL_PROJECT_DIR/data"

if ! curl -fsS --max-time 1 "$PERL_URL/api/ready" >/dev/null 2>&1; then
  nohup npm run preview:deployment >"$PERL_LOG" 2>&1 &
  for PERL_ATTEMPT in {1..240}; do
    if curl -fsS --max-time 1 "$PERL_URL/api/ready" >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
  done
fi

if ! curl -fsS --max-time 2 "$PERL_URL/api/ready" >/dev/null 2>&1; then
  print -u2 "PERL could not start. Review $PERL_LOG"
  exit 1
fi

open "$PERL_URL"
