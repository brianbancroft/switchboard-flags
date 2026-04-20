resource "aws_elasticache_serverless_cache" "main" {
  engine = "redis"
  name   = "${local.name_tag}-redis"

  cache_usage_limits {
    data_storage {
      maximum = 1
      unit    = "GB"
    }
    ecpu_per_second {
      maximum = 5000
    }
  }

  subnet_ids         = aws_subnet.private[*].id
  security_group_ids = [aws_security_group.redis.id]

  # Minimum compatible Redis version; serverless always runs the latest patch.
  major_engine_version = "7"
}
