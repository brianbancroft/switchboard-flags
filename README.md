# Switchboard

![Switchboard illustration](./switchboard-image.png)

Switchboard is a self-hosted feature flag platform. Teams create flags, define environments, and evaluate them at runtime via a REST API, a JS client SDK, or an MCP server for AI coding assistants.

## Getting started

### Requirements

- Node.js 20+
- pnpm 9
- PostgreSQL and Redis (or `docker compose up postgres redis`)

### Setup

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

Fill in at minimum:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/switchboard
REDIS_URL=redis://127.0.0.1:6379
BETTER_AUTH_SECRET=<long random string>
```

Running services:

- UI: `http://localhost:3000`
- API: `http://localhost:4000`
- API reference: `http://localhost:4000/docs`
- Docs: `http://localhost:3001`

## Deploying to AWS

The `deploy/` directory contains a Terraform stack and Makefile for running Switchboard on AWS (ECS Fargate, RDS PostgreSQL, ElastiCache Redis, CloudFront).

### Prerequisites

- AWS CLI configured
- Terraform ≥ 1.x
- Docker

### First-time setup

```bash
cd deploy
make init   # creates S3 tfstate bucket + DynamoDB lock table, then runs terraform init
make up     # provision the full stack
```

After `make up`, set the auth secret:

```bash
aws secretsmanager put-secret-value \
  --secret-id $(terraform output -raw better_auth_secret_arn) \
  --secret-string "$(openssl rand -base64 48)"
make deploy-api   # force a new deployment to pick up the secret
```

### Deploying updates

```bash
make deploy-api     # build + push API image → ECS rolling update
make deploy-web     # build + push web image → ECS rolling update
make deploy-docs    # build docs → S3 sync → CloudFront invalidation
```

### Tearing down

Set `rds_deletion_protection = false` in `deploy/prod.tfvars`, run `make up`, then `make down`.
