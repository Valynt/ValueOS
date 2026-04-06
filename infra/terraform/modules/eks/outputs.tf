output "cluster_endpoint" {
  description = "EKS control plane endpoint"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "EKS control plane certificate authority data"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "node_role_arn" {
  description = "IAM role ARN for the worker nodes"
  value       = aws_iam_role.node_role.arn
}
