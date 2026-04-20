project = "switchboard"
env     = "prod"
region  = "us-east-1"

# Set rds_deletion_protection = false and `make up` before a destructive teardown.
rds_deletion_protection = true

# OAuth providers — flip to true once the corresponding secret has been populated:
#   aws secretsmanager put-secret-value \
#     --secret-id switchboard/prod/auth-github-client-secret \
#     --secret-string "<value>"
auth_password_enabled = true
auth_github_enabled   = false
auth_google_enabled   = false
