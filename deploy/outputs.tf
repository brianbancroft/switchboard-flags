output "region" {
  value = var.region
}

output "ecr_api_uri" {
  value       = aws_ecr_repository.api.repository_url
  description = "Push API images here"
}

output "ecr_web_uri" {
  value       = aws_ecr_repository.web.repository_url
  description = "Push web images here"
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "api_service_name" {
  value = aws_ecs_service.api.name
}

output "web_service_name" {
  value = aws_ecs_service.web.name
}

output "api_url" {
  value       = "https://${aws_cloudfront_distribution.api.domain_name}"
  description = "Public HTTPS URL for the API"
}

output "web_url" {
  value       = "https://${aws_cloudfront_distribution.web.domain_name}"
  description = "Public HTTPS URL for the web app"
}

output "docs_url" {
  value       = "https://${aws_cloudfront_distribution.docs.domain_name}"
  description = "Public HTTPS URL for the docs site"
}

output "docs_bucket" {
  value = aws_s3_bucket.docs.id
}

output "docs_cf_id" {
  value = aws_cloudfront_distribution.docs.id
}

output "rds_endpoint" {
  value     = aws_db_instance.main.address
  sensitive = true
}

output "better_auth_secret_arn" {
  value       = aws_secretsmanager_secret.better_auth.arn
  description = "Populate with: aws secretsmanager put-secret-value --secret-id <arn> --secret-string \"$(openssl rand -base64 48)\""
}
