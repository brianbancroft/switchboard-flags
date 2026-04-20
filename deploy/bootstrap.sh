#!/usr/bin/env bash
# Idempotently provision the S3 bucket + DynamoDB table used for Terraform state,
# then write a backend.hcl that `terraform init -backend-config=...` consumes.
#
# Safe to re-run — every step checks for existing resources first.

set -euo pipefail

PROJECT="${PROJECT:-switchboard}"
ENV="${ENV:-prod}"
AWS_REGION="${AWS_REGION:-us-east-1}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${PROJECT}-tfstate-${ACCOUNT_ID}"
LOCK_TABLE="${PROJECT}-tfstate-lock"
STATE_KEY="${ENV}/terraform.tfstate"

echo "==> bootstrap: account=${ACCOUNT_ID} region=${AWS_REGION}"
echo "    bucket=${BUCKET}"
echo "    lock_table=${LOCK_TABLE}"
echo "    state_key=${STATE_KEY}"

# --- S3 bucket ---
if aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "==> bucket ${BUCKET} already exists"
else
  echo "==> creating bucket ${BUCKET}"
  if [[ "${AWS_REGION}" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "${BUCKET}" --region "${AWS_REGION}"
  else
    aws s3api create-bucket \
      --bucket "${BUCKET}" \
      --region "${AWS_REGION}" \
      --create-bucket-configuration LocationConstraint="${AWS_REGION}"
  fi
fi

aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]
  }'

aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# --- DynamoDB lock table ---
if aws dynamodb describe-table --table-name "${LOCK_TABLE}" --region "${AWS_REGION}" >/dev/null 2>&1; then
  echo "==> lock table ${LOCK_TABLE} already exists"
else
  echo "==> creating lock table ${LOCK_TABLE}"
  aws dynamodb create-table \
    --table-name "${LOCK_TABLE}" \
    --region "${AWS_REGION}" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST >/dev/null
  aws dynamodb wait table-exists --table-name "${LOCK_TABLE}" --region "${AWS_REGION}"
fi

# --- Write backend.hcl ---
cat > backend.hcl <<EOF
bucket         = "${BUCKET}"
key            = "${STATE_KEY}"
region         = "${AWS_REGION}"
dynamodb_table = "${LOCK_TABLE}"
encrypt        = true
EOF

echo "==> wrote backend.hcl"
echo "==> bootstrap complete"
