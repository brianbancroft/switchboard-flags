PROJECT    ?= switchboard
ENV        ?= prod
AWS_REGION ?= us-east-1
TFVARS     ?= $(ENV).tfvars

export PROJECT ENV AWS_REGION

.PHONY: init up down plan fmt validate outputs \
        deploy-api deploy-web deploy-docs

## init — create tfstate bucket + lock table, then terraform init. Safe to re-run.
init:
	./bootstrap.sh
	terraform init -backend-config=backend.hcl -reconfigure

## plan — show the Terraform plan without applying.
plan:
	terraform plan -var-file=$(TFVARS)

## up — apply the full Terraform stack (or reconcile drift).
up:
	terraform apply -var-file=$(TFVARS)

## down — destroy the stack. Requires rds_deletion_protection=false first.
down:
	@echo "About to destroy the entire $(PROJECT)-$(ENV) stack."
	@echo "If RDS deletion_protection is still true, set it to false in $(TFVARS),"
	@echo "run 'make up' to apply, then 'make down' again."
	terraform destroy -var-file=$(TFVARS)

## fmt / validate — local sanity checks (no AWS calls for fmt).
fmt:
	terraform fmt -recursive

validate:
	terraform validate

## outputs — print all Terraform outputs.
outputs:
	terraform output

## deploy-api / deploy-web / deploy-docs — build + push + trigger new deployment.
deploy-api:
	./scripts/deploy-service.sh api

deploy-web:
	./scripts/deploy-service.sh web

deploy-docs:
	./scripts/deploy-docs.sh
