variable "project" {
  type        = string
  default     = "switchboard"
  description = "Project name prefix for all resources"
}

variable "env" {
  type        = string
  default     = "prod"
  description = "Environment name (prod, staging, dev)"
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.0.0/24", "10.0.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}

# --- RDS ---
variable "rds_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "rds_allocated_storage" {
  type    = number
  default = 20
}

variable "rds_engine_version" {
  type    = string
  default = "16.4"
}

variable "rds_deletion_protection" {
  type        = bool
  default     = true
  description = "Set to false in tfvars and apply before `make down` to allow DB destruction"
}

variable "db_name" {
  type    = string
  default = "switchboard"
}

variable "db_username" {
  type    = string
  default = "switchboard"
}

# --- ECS task sizing ---
variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "api_desired_count" {
  type    = number
  default = 1
}

variable "web_cpu" {
  type    = number
  default = 256
}

variable "web_memory" {
  type    = number
  default = 512
}

variable "web_desired_count" {
  type    = number
  default = 1
}

# --- Image tag used by task definitions ---
# Deploy scripts push `latest`, then call update-service --force-new-deployment.
variable "image_tag" {
  type    = string
  default = "latest"
}

# --- Auth provider toggles (non-secret config; secrets live in Secrets Manager) ---
variable "auth_password_enabled" {
  type    = bool
  default = true
}

variable "auth_github_enabled" {
  type    = bool
  default = false
}

variable "auth_google_enabled" {
  type    = bool
  default = false
}
