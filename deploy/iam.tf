# ECS task execution role — pulls images, reads secrets, writes logs.
data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${local.name_tag}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow the execution role to read the secrets injected into task definitions.
data "aws_iam_policy_document" "ecs_secrets_read" {
  statement {
    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret",
    ]
    resources = concat(
      [
        aws_secretsmanager_secret.database_url.arn,
        aws_secretsmanager_secret.redis_url.arn,
        aws_secretsmanager_secret.better_auth.arn,
      ],
      var.auth_github_enabled ? [aws_secretsmanager_secret.github_client_secret[0].arn] : [],
      var.auth_google_enabled ? [aws_secretsmanager_secret.google_client_secret[0].arn] : [],
    )
  }
}

resource "aws_iam_policy" "ecs_secrets_read" {
  name   = "${local.name_tag}-ecs-secrets-read"
  policy = data.aws_iam_policy_document.ecs_secrets_read.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_secrets" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = aws_iam_policy.ecs_secrets_read.arn
}

# Task role — shared between api and web (both just need CloudWatch Logs + ECS Exec).
resource "aws_iam_role" "ecs_task" {
  name               = "${local.name_tag}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

# ECS Exec requires SSM permissions on the task role.
data "aws_iam_policy_document" "ecs_exec" {
  statement {
    actions = [
      "ssmmessages:CreateControlChannel",
      "ssmmessages:CreateDataChannel",
      "ssmmessages:OpenControlChannel",
      "ssmmessages:OpenDataChannel",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "ecs_exec" {
  name   = "${local.name_tag}-ecs-exec"
  policy = data.aws_iam_policy_document.ecs_exec.json
}

resource "aws_iam_role_policy_attachment" "ecs_task_exec" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.ecs_exec.arn
}
