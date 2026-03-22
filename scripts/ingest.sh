#!/bin/bash
# Post transactions to BizBuz cloud function
# Usage: ./scripts/ingest.sh <transactions.txt> [batch_size]

set -e

INGEST_URL="https://ingest-pvbnffp5mq-uc.a.run.app"
INGEST_TOKEN="ea73941aece6c4a0088a18912217447a6c06248770c94fffc4f571946648fdfb"
FAMILY_ID="zEE5p7TvIFnuIdgpU3Ix"
BATCH_SIZE="${2:-100}"

if [ -z "$1" ]; then
  echo "Usage: $0 <transactions-file.txt> [batch_size]"
  echo "  batch_size defaults to 100"
  exit 1
fi

INPUT="$1"

if [ ! -f "$INPUT" ]; then
  echo "File not found: $INPUT"
  exit 1
fi

TOTAL=$(python3 -c "
import json, sys
with open('$INPUT') as f:
    data = json.load(f)
txns = data.get('transactions', data if isinstance(data, list) else [])
print(len(txns))
")

echo "📦 $TOTAL transactions in $INPUT (batch size: $BATCH_SIZE)"

python3 -c "
import json, subprocess, sys

with open('$INPUT') as f:
    data = json.load(f)
txns = data.get('transactions', data if isinstance(data, list) else [])

batch_size = $BATCH_SIZE
total = len(txns)
processed = 0
skipped_existing = 0
skipped_locked = 0
errors = 0

for i in range(0, total, batch_size):
    batch = txns[i:i+batch_size]
    payload = json.dumps({'familyId': '$FAMILY_ID', 'transactions': batch})
    
    result = subprocess.run(
        ['curl', '-s', '-w', '\\n%{http_code}', '-X', 'POST', '$INGEST_URL',
         '-H', 'Content-Type: application/json',
         '-H', 'Authorization: Bearer $INGEST_TOKEN',
         '-d', payload],
        capture_output=True, text=True, timeout=120
    )
    
    lines = result.stdout.strip().split('\\n')
    http_code = lines[-1] if lines else '0'
    body = '\\n'.join(lines[:-1])
    
    if http_code == '200':
        r = json.loads(body)
        processed += r.get('processed', 0)
        skipped_existing += r.get('skipped_existing', 0)
        skipped_locked += r.get('skipped_locked', 0)
        errors += r.get('errors', 0)
        print(f'  Batch {i//batch_size + 1}: {r}')
    else:
        errors += len(batch)
        print(f'  Batch {i//batch_size + 1}: HTTP {http_code} - {body[:100]}')

print(f'\\n✅ Done: {processed} processed, {skipped_existing} existing, {skipped_locked} locked, {errors} errors')
"
