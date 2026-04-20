#!/usr/bin/env bash
# Build a service image, push to ECR, and force a new ECS deployment.
# Invoked from deploy/ as: ./scripts/deploy-service.sh <api|web>

set -euo pipefail

SERVICE="${1:-}"
if [[ "${SERVICE}" != "api" && "${SERVICE}" != "web" ]]; then
  echo "usage: $0 <api|web>" >&2
  exit 2
fi

PROJECT="${PROJECT:-switchboard}"
AWS_REGION="${AWS_REGION:-us-east-1}"

HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${HERE}/.." && pwd)"
cd "${HERE}"

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
ECR_URI="$(terraform output -raw "ecr_${SERVICE}_uri")"
CLUSTER="$(terraform output -raw ecs_cluster_name)"
SERVICE_NAME="$(terraform output -raw "${SERVICE}_service_name")"

TAG="${IMAGE_TAG:-latest}"

echo "==> docker login ${ECR_REGISTRY}"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_REGISTRY}"

# web needs VITE_API_URL baked at build time.
BUILD_ARGS=()
if [[ "${SERVICE}" == "web" ]]; then
  API_URL="$(terraform output -raw api_url)"
  BUILD_ARGS+=(--build-arg "VITE_API_URL=${API_URL}")
  BUILD_ARGS+=(--build-arg "NEXT_PUBLIC_API_URL=${API_URL}")
fi

echo "==> building ${SERVICE} image"
docker buildx build \
  --platform linux/amd64 \
  "${BUILD_ARGS[@]}" \
  -f "${REPO_ROOT}/apps/${SERVICE}/Dockerfile" \
  -t "${ECR_URI}:${TAG}" \
  --push \
  "${REPO_ROOT}"

echo "==> triggering ECS rollout for ${SERVICE_NAME}"
aws ecs update-service \
  --cluster "${CLUSTER}" \
  --service "${SERVICE_NAME}" \
  --force-new-deployment \
  --region "${AWS_REGION}" >/dev/null

echo "==> waiting for service to stabilize (this can take a few minutes)"
aws ecs wait services-stable \
  --cluster "${CLUSTER}" \
  --services "${SERVICE_NAME}" \
  --region "${AWS_REGION}"

echo "==> ${SERVICE} deploy complete"
