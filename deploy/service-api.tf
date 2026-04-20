# --- CloudWatch log group ---
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name_tag}-api"
  retention_in_days = 14
}

# --- ALB + target group + listener ---
resource "aws_lb" "api" {
  name               = "${local.name_tag}-api"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_api.id]
  subnets            = aws_subnet.public[*].id

  idle_timeout = 60
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name_tag}-api"
  port        = 4000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    path                = "/health"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

resource "aws_lb_listener" "api" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# --- CloudFront in front of ALB (gives HTTPS on *.cloudfront.net) ---
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

resource "aws_cloudfront_distribution" "api" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name_tag}-api"
  http_version    = "http2and3"
  price_class     = "PriceClass_100"

  origin {
    domain_name = aws_lb.api.dns_name
    origin_id   = "api-alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "api-alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# --- Task definition ---
locals {
  api_image = "${aws_ecr_repository.api.repository_url}:${var.image_tag}"

  api_url         = "https://${aws_cloudfront_distribution.api.domain_name}"
  web_url         = "https://${aws_cloudfront_distribution.web.domain_name}"
  trusted_origins = local.web_url
  cors_origins    = local.web_url
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name_tag}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = local.api_image
    essential = true

    portMappings = [{
      containerPort = 4000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "API_HOST", value = "0.0.0.0" },
      { name = "API_PORT", value = "4000" },
      { name = "BETTER_AUTH_URL", value = local.api_url },
      { name = "BETTER_AUTH_TRUSTED_ORIGINS", value = local.trusted_origins },
      { name = "CORS_ORIGINS", value = local.cors_origins },
      { name = "AUTH_PASSWORD_ENABLED", value = tostring(var.auth_password_enabled) },
      { name = "AUTH_GITHUB_ENABLED", value = tostring(var.auth_github_enabled) },
      { name = "AUTH_GOOGLE_ENABLED", value = tostring(var.auth_google_enabled) },
    ]

    secrets = concat(
      [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
        { name = "REDIS_URL", valueFrom = aws_secretsmanager_secret.redis_url.arn },
        { name = "BETTER_AUTH_SECRET", valueFrom = aws_secretsmanager_secret.better_auth.arn },
      ],
      var.auth_github_enabled ? [
        { name = "AUTH_GITHUB_CLIENT_SECRET", valueFrom = aws_secretsmanager_secret.github_client_secret[0].arn },
      ] : [],
      var.auth_google_enabled ? [
        { name = "AUTH_GOOGLE_CLIENT_SECRET", valueFrom = aws_secretsmanager_secret.google_client_secret[0].arn },
      ] : [],
    )

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "api"
      }
    }

    healthCheck = {
      command     = ["CMD-SHELL", "wget -qO- http://localhost:4000/health || exit 1"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }
  }])
}

# --- Service ---
resource "aws_ecs_service" "api" {
  name             = "api"
  cluster          = aws_ecs_cluster.main.id
  task_definition  = aws_ecs_task_definition.api.arn
  desired_count    = var.api_desired_count
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  enable_execute_command             = true
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 4000
  }

  # Ignore task definition churn from deploy scripts that use `force-new-deployment`.
  # Terraform-authored changes still apply via new task def revisions.
  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener.api]
}
