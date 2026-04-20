resource "aws_db_subnet_group" "main" {
  name       = "${local.name_tag}-db"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${local.name_tag}-db" }
}

resource "aws_db_parameter_group" "postgres16" {
  name   = "${local.name_tag}-pg16"
  family = "postgres16"

  # Force TLS for all client connections.
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "${local.name_tag}-db"
  engine         = "postgres"
  engine_version = var.rds_engine_version
  instance_class = var.rds_instance_class

  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_allocated_storage * 5
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name                = var.db_name
  username               = var.db_username
  password               = random_password.db.result
  port                   = 5432
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.postgres16.name

  multi_az                    = false
  publicly_accessible         = false
  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection       = var.rds_deletion_protection
  skip_final_snapshot       = !var.rds_deletion_protection
  final_snapshot_identifier = var.rds_deletion_protection ? "${local.name_tag}-final-${formatdate("YYYYMMDDhhmmss", timestamp())}" : null

  # timestamp() in final_snapshot_identifier changes every plan; ignore drift.
  lifecycle {
    ignore_changes = [final_snapshot_identifier]
  }
}
