# --- CloudWatch log group ---
resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/${local.name_tag}-web"
  retention_in_days = 14
}

# --- ALB + target group + listener ---
resource "aws_lb" "web" {
  name               = "${local.name_tag}-web"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_web.id]
  subnets            = aws_subnet.public[*].id

  idle_timeout = 60
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name_tag}-web"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    path                = "/"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
}

resource "aws_lb_listener" "web" {
  load_balancer_arn = aws_lb.web.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# --- CloudFront in front of ALB ---
resource "aws_cloudfront_distribution" "web" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.name_tag}-web"
  http_version    = "http2and3"
  price_class     = "PriceClass_100"

  origin {
    domain_name = aws_lb.web.dns_name
    origin_id   = "web-alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "web-alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # SSR output — never cache. If/when static assets (/assets/*) grow, add a
    # second behavior with a caching policy.
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
  web_image = "${aws_ecr_repository.web.repository_url}:${var.image_tag}"
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name_tag}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web_cpu
  memory                   = var.web_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "web"
    image     = local.web_image
    essential = true

    portMappings = [{
      containerPort = 3000
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "HOST", value = "0.0.0.0" },
      { name = "PORT", value = "3000" },
      # Server-side API URL used by app/lib/api.server.ts
      { name = "API_URL", value = local.api_url },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.web.name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = "web"
      }
    }
  }])
}

# --- Service ---
resource "aws_ecs_service" "web" {
  name             = "web"
  cluster          = aws_ecs_cluster.main.id
  task_definition  = aws_ecs_task_definition.web.arn
  desired_count    = var.web_desired_count
  launch_type      = "FARGATE"
  platform_version = "LATEST"

  enable_execute_command             = true
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_web.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener.web]
}
