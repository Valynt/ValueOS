resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.name_prefix}"
  retention_in_days = 30
  tags              = var.tags
}

resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = var.tags
}

output "cluster_id" { value = aws_ecs_cluster.this.id }
output "cluster_name" { value = aws_ecs_cluster.this.name }
output "log_group_name" { value = aws_cloudwatch_log_group.ecs.name }
