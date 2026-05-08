#!/usr/bin/env bash
# List the contents of one or more top-level harness areas.
#
# Usage:
#   harness/enforcement/utils/list-harness.sh                       # all agent-facing areas
#   harness/enforcement/utils/list-harness.sh knowledge skills      # only the named areas
#
# `enforcement/` is always excluded — it is tool-facing and not meant to be read by agents.

set -euo pipefail

DEFAULT_AREAS=(knowledge skills dev-workflow housekeeping exec-plans)

if [[ $# -gt 0 ]]; then
  areas=("$@")
else
  areas=("${DEFAULT_AREAS[@]}")
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

for area in "${areas[@]}"; do
  if [[ "$area" == "enforcement" ]]; then
    echo "Skipping 'enforcement/' — tool-facing, not for agent consumption." >&2
    continue
  fi
  target="$repo_root/harness/$area"
  if [[ ! -d "$target" ]]; then
    echo "No such harness area: $area" >&2
    continue
  fi
  ( cd "$repo_root" && find "harness/$area" -maxdepth 6 -print ) \
    | sort \
    | sed -e 's/[^\/]*\//│   /g' -e 's/│   \([^│]\)/├── \1/'
done
