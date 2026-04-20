#!/usr/bin/env bash
# Build the Astro docs site, sync to S3, and invalidate the CloudFront cache.
# Invoked from deploy/ as: ./scripts/deploy-docs.sh

set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${HERE}/.." && pwd)"
cd "${HERE}"

BUCKET="$(terraform output -raw docs_bucket)"
CF_ID="$(terraform output -raw docs_cf_id)"

echo "==> building docs"
(cd "${REPO_ROOT}" && pnpm --filter docs build)

echo "==> syncing to s3://${BUCKET}/"
aws s3 sync \
  "${REPO_ROOT}/apps/docs/dist/" \
  "s3://${BUCKET}/" \
  --delete \
  --region "${AWS_REGION}"

echo "==> invalidating CloudFront ${CF_ID}"
aws cloudfront create-invalidation \
  --distribution-id "${CF_ID}" \
  --paths '/*' >/dev/null

echo "==> docs deploy complete"
