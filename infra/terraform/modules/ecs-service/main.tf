resource "aws_cloudwatch_log_group" "service" {
  name              = "/ecs/${var.name_prefix}"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_security_group" "alb" {
  name_prefix = "${var.name_prefix}-alb-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = var.security_group_ids
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-sg" })
}

resource "aws_lb" "this" {
  name               = substr(regexreplace("${var.name_prefix}-alb", "[^a-zA-Z0-9-]", ""), 0, 32)
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = var.tags
}

resource "aws_lb_target_group" "this" {
  name        = substr(regexreplace("${var.name_prefix}-tg", "[^a-zA-Z0-9-]", ""), 0, 32)
  port        = var.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id

  health_check {
    path                = var.health_check_path
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 2
    timeout             = 5
    matcher             = "200-399"
  }

  tags = var.tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

data "aws_iam_policy_document" "ecs_task_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name_prefix        = "${var.name_prefix}-exec-"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json
  tags               = var.tags
}

resource "aws_iam_role_policy_attachment" "execution_default" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "task" {
  name_prefix        = "${var.name_prefix}-task-"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume_role.json
  tags               = var.tags
}

data "aws_iam_policy_document" "task_secrets" {
  statement {
    sid       = "ReadSpecificSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = values(var.secrets)
  }
}

resource "aws_iam_role_policy" "task_secrets" {
  count  = length(var.secrets) > 0 ? 1 : 0
  name   = "read-secrets"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_secrets.json
}

locals {
  environment_entries = [for key, value in var.environment_variables : { name = key, value = value }]
  secret_entries      = [for key, value in var.secrets : { name = key, valueFrom = value }]
}

resource "aws_ecs_task_definition" "this" {
  family                   = var.name_prefix
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = tostring(var.cpu)
  memory                   = tostring(var.memory)
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([
    {
      name         = var.name_prefix
      image        = var.container_image
      essential    = true
      environment  = local.environment_entries
      secrets      = local.secret_entries
      portMappings = [{ containerPort = var.container_port, protocol = "tcp" }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.service.name
          awslogs-region        = data.aws_region.current.name
          awslogs-stream-prefix = "ecs"
        }
      }
    }
  ])

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  tags = var.tags
}

resource "aws_ecs_service" "this" {
  name            = var.name_prefix
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.this.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.this.arn
    container_name   = var.name_prefix
    container_port   = var.container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http]
  tags       = var.tags
}

data "aws_region" "current" {}

output "service_name" { value = aws_ecs_service.this.name }
output "service_arn" { value = aws_ecs_service.this.id }
output "load_balancer_dns" { value = aws_lb.this.dns_name }
output "target_group_arn" { value = aws_lb_target_group.this.arn }
