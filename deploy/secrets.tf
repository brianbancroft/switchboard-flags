# --- DB password (Terraform-generated, fed into RDS + DATABASE_URL) ---
resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.project}/${var.env}/db-password"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

# --- DATABASE_URL (assembled after RDS exists) ---
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.project}/${var.env}/database-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgres://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}"
}

# --- REDIS_URL (assembled after ElastiCache exists) ---
resource "aws_secretsmanager_secret" "redis_url" {
  name                    = "${var.project}/${var.env}/redis-url"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id = aws_secretsmanager_secret.redis_url.id
  # Serverless ElastiCache Redis uses TLS by default (port 6379).
  secret_string = "rediss://${aws_elasticache_serverless_cache.main.endpoint[0].address}:${aws_elasticache_serverless_cache.main.endpoint[0].port}"
}

# --- BETTER_AUTH_SECRET ---
# Terraform creates the secret with a placeholder; operator rotates via CLI:
#   aws secretsmanager put-secret-value --secret-id <arn> \
#     --secret-string "$(openssl rand -base64 48)"
resource "aws_secretsmanager_secret" "better_auth" {
  name                    = "${var.project}/${var.env}/better-auth-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "better_auth_initial" {
  secret_id     = aws_secretsmanager_secret.better_auth.id
  secret_string = "REPLACE_ME_RUN_openssl_rand_base64_48"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# --- Optional OAuth client secrets (empty by default; populate via CLI if used) ---
resource "aws_secretsmanager_secret" "github_client_secret" {
  count                   = var.auth_github_enabled ? 1 : 0
  name                    = "${var.project}/${var.env}/auth-github-client-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "github_client_secret_initial" {
  count         = var.auth_github_enabled ? 1 : 0
  secret_id     = aws_secretsmanager_secret.github_client_secret[0].id
  secret_string = "REPLACE_ME"

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "google_client_secret" {
  count                   = var.auth_google_enabled ? 1 : 0
  name                    = "${var.project}/${var.env}/auth-google-client-secret"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "google_client_secret_initial" {
  count         = var.auth_google_enabled ? 1 : 0
  secret_id     = aws_secretsmanager_secret.google_client_secret[0].id
  secret_string = "REPLACE_ME"

  lifecycle {
    ignore_changes = [secret_string]
  }
}
