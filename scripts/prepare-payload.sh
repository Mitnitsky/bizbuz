#!/bin/bash
# Prepare a transactions file for ingestion
# Reads a moneyman output file, wraps with familyId, optionally filters by date
# Usage: ./scripts/prepare-payload.sh <input.txt> [min-date]
#   min-date format: YYYY-MM-DD (default: no filter)

set -e

FAMILY_ID="zEE5p7TvIFnuIdgpU3Ix"

if [ -z "$1" ]; then
  echo "Usage: $0 <input.txt> [min-date]"
  echo "  min-date: YYYY-MM-DD (optional, filters transactions before this date)"
  echo "  Output: /tmp/ingest-payload.json"
  exit 1
fi

INPUT="$1"
MIN_DATE="${2:-}"

if [ ! -f "$INPUT" ]; then
  echo "File not found: $INPUT"
  exit 1
fi

python3 -c "
import json
from datetime import datetime

with open('$INPUT') as f:
    data = json.load(f)

txns = data.get('transactions', data if isinstance(data, list) else [])
min_date = '$MIN_DATE'

if min_date:
    cutoff = datetime.strptime(min_date, '%Y-%m-%d')
    filtered = []
    for t in txns:
        try:
            dt = datetime.fromisoformat(t['date'].replace('Z', '+00:00'))
            if dt.replace(tzinfo=None) >= cutoff:
                filtered.append(t)
        except:
            pass
    txns = filtered
    print(f'Filtered to {len(txns)} transactions (from {min_date})')
else:
    print(f'{len(txns)} transactions (no date filter)')

payload = {'familyId': '$FAMILY_ID', 'transactions': txns}
with open('/tmp/ingest-payload.json', 'w') as f:
    json.dump(payload, f)
print('Written to /tmp/ingest-payload.json')
"
