#!/bin/bash
# Build and deploy BizBuz (hosting + optionally functions)
# Usage: ./scripts/deploy.sh [--functions] [--all]

set -e
cd "$(dirname "$0")/.."

DEPLOY_TARGET="hosting"

if [ "$1" = "--functions" ]; then
  DEPLOY_TARGET="functions"
elif [ "$1" = "--all" ]; then
  DEPLOY_TARGET="hosting,functions"
fi

echo "🔨 Building..."
npm run build

if [[ "$DEPLOY_TARGET" == *"functions"* ]]; then
  echo "🔨 Building functions..."
  cd functions && npx tsc && cd ..
fi

echo "🚀 Deploying: $DEPLOY_TARGET"
npx firebase deploy --only "$DEPLOY_TARGET" --force

echo "✅ Deployed!"
