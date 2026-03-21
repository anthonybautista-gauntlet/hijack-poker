#!/usr/bin/env bash
# Initialize DynamoDB Local tables for all challenge options.
# Run this if the dynamodb-init Docker container didn't create tables.

set -euo pipefail

ENDPOINT="${DYNAMODB_ENDPOINT:-http://localhost:8000}"
REGION="${AWS_REGION:-us-east-1}"

AWS_OPTS="--endpoint-url $ENDPOINT --region $REGION"

echo "Creating DynamoDB tables at $ENDPOINT..."

# WebSocket connections table (Option B)
aws dynamodb create-table $AWS_OPTS \
  --table-name connections \
  --attribute-definitions \
    AttributeName=connectionId,AttributeType=S \
    AttributeName=tableSubscription,AttributeType=S \
  --key-schema AttributeName=connectionId,KeyType=HASH \
  --global-secondary-indexes '[{"IndexName":"tableSubscription-index","KeySchema":[{"AttributeName":"tableSubscription","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}}]' \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  2>/dev/null && echo "  Created: connections" || echo "  Exists:  connections"

# Rewards tables (Option A)
aws dynamodb create-table $AWS_OPTS \
  --table-name rewards-players \
  --attribute-definitions AttributeName=playerId,AttributeType=S \
  --key-schema AttributeName=playerId,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  2>/dev/null && echo "  Created: rewards-players" || echo "  Exists:  rewards-players"

aws dynamodb create-table $AWS_OPTS \
  --table-name rewards-transactions \
  --attribute-definitions \
    AttributeName=playerId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema AttributeName=playerId,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  2>/dev/null && echo "  Created: rewards-transactions" || echo "  Exists:  rewards-transactions"

# Streaks tables (Option C)
aws dynamodb create-table $AWS_OPTS \
  --table-name streaks-players \
  --attribute-definitions AttributeName=playerId,AttributeType=S \
  --key-schema AttributeName=playerId,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  2>/dev/null && echo "  Created: streaks-players" || echo "  Exists:  streaks-players"

aws dynamodb create-table $AWS_OPTS \
  --table-name streaks-activity \
  --attribute-definitions \
    AttributeName=playerId,AttributeType=S \
    AttributeName=date,AttributeType=S \
  --key-schema AttributeName=playerId,KeyType=HASH AttributeName=date,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  2>/dev/null && echo "  Created: streaks-activity" || echo "  Exists:  streaks-activity"

# Rewards tier history table
aws dynamodb create-table $AWS_OPTS \
  --table-name rewards-tier-history \
  --attribute-definitions \
    AttributeName=playerId,AttributeType=S \
    AttributeName=monthKey,AttributeType=S \
  --key-schema AttributeName=playerId,KeyType=HASH AttributeName=monthKey,KeyType=RANGE \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  2>/dev/null && echo "  Created: rewards-tier-history" || echo "  Exists:  rewards-tier-history"

# GSI: handId-index on rewards-transactions
aws dynamodb update-table $AWS_OPTS \
  --table-name rewards-transactions \
  --attribute-definitions AttributeName=handId,AttributeType=S \
  --global-secondary-index-updates '[{"Create":{"IndexName":"handId-index","KeySchema":[{"AttributeName":"handId","KeyType":"HASH"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}}}]' \
  2>/dev/null && echo "  Created: rewards-transactions handId-index GSI" || echo "  Exists:  rewards-transactions handId-index GSI"

# GSI: monthKey-points-index on rewards-leaderboard
aws dynamodb update-table $AWS_OPTS \
  --table-name rewards-leaderboard \
  --attribute-definitions \
    AttributeName=monthKey,AttributeType=S \
    AttributeName=monthlyPoints,AttributeType=N \
  --global-secondary-index-updates '[{"Create":{"IndexName":"monthKey-points-index","KeySchema":[{"AttributeName":"monthKey","KeyType":"HASH"},{"AttributeName":"monthlyPoints","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"},"ProvisionedThroughput":{"ReadCapacityUnits":5,"WriteCapacityUnits":5}}}]' \
  2>/dev/null && echo "  Created: rewards-leaderboard monthKey-points-index GSI" || echo "  Exists:  rewards-leaderboard monthKey-points-index GSI"

# TTL on rewards-notifications
aws dynamodb update-time-to-live $AWS_OPTS \
  --table-name rewards-notifications \
  --time-to-live-specification Enabled=true,AttributeName=ttl \
  2>/dev/null && echo "  Enabled: rewards-notifications TTL" || echo "  Exists:  rewards-notifications TTL"

echo "Done. All DynamoDB tables ready."
