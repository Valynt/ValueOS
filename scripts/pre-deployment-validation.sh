#!/bin/bash

# Pre-deployment Validation Script
# Performs schema validation, drift detection, and policy enforcement

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
K8S_MANIFESTS_DIR="${K8S_MANIFESTS_DIR:-infra/k8s}"
TERRAFORM_DIR="${TERRAFORM_DIR:-infra/terraform}"
POLICIES_DIR="${POLICIES_DIR:-infra/policies}"
NAMESPACE="${NAMESPACE:-valuecanvas}"

# Validation results
VALIDATION_PASSED=true

# Logging functions
log_info() {
    echo -e "${BLUE}🔍 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
    VALIDATION_PASSED=false
}

# Validate Kubernetes manifests
validate_k8s_manifests() {
    log_info "Validating Kubernetes manifests..."

    if ! command -v kubeconform &> /dev/null; then
        log_warning "kubeconform not found, installing..."
        # Install kubeconform if not available
        curl -L https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
        sudo mv kubeconform /usr/local/bin/
    fi

    local failed_files=()

    # Find and validate all YAML files
    while IFS= read -r -d '' file; do
        log_info "Validating: $file"
        if ! kubeconform -strict -schema-location default -schema-location 'https://raw.githubusercontent.com/yannh/kubeconform/master/fixtures/schema.json' "$file"; then
            failed_files+=("$file")
        fi
    done < <(find "$K8S_MANIFESTS_DIR" -name "*.yaml" -o -name "*.yml" -print0)

    if [ ${#failed_files[@]} -gt 0 ]; then
        log_error "Kubernetes manifest validation failed:"
        printf '  %s\n' "${failed_files[@]}"
        return 1
    else
        log_success "All Kubernetes manifests are valid"
        return 0
    fi
}

# Check for infrastructure drift
check_infrastructure_drift() {
    log_info "Checking for infrastructure drift..."

    if [ ! -d "$TERRAFORM_DIR" ]; then
        log_warning "Terraform directory not found, skipping drift detection"
        return 0
    fi

    cd "$TERRAFORM_DIR"

    # Initialize Terraform if needed
    if [ ! -d ".terraform" ]; then
        log_info "Initializing Terraform..."
        terraform init -backend=false
    fi

    # Check for drift
    log_info "Running terraform plan to detect drift..."
    if terraform plan -detailed-exitcode -no-color > terraform_plan.log 2>&1; then
        log_success "No infrastructure drift detected"
        rm -f terraform_plan.log
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 2 ]; then
            log_error "Infrastructure drift detected!"
            echo "Drift details:"
            cat terraform_plan.log
            rm -f terraform_plan.log
            return 1
        else
            log_error "Terraform plan failed with exit code $exit_code"
            cat terraform_plan.log
            rm -f terraform_plan.log
            return 1
        fi
    fi
}

# Validate with Open Policy Agent / Conftest
validate_policies() {
    log_info "Running policy validation with Conftest..."

    if ! command -v conftest &> /dev/null; then
        log_warning "conftest not found, installing..."
        # Install conftest if not available
        curl -L https://github.com/open-policy-agent/conftest/releases/latest/download/conftest_0.48.0_Linux_x86_64.tar.gz | tar xz
        sudo mv conftest /usr/local/bin/
    fi

    # Create basic policies if they don't exist
    if [ ! -d "$POLICIES_DIR" ]; then
        log_info "Creating default policies..."
        mkdir -p "$POLICIES_DIR"

        # Security policies
        cat > "$POLICIES_DIR/security.rego" << 'EOF'
package main

# Deny privileged containers
deny_privileged[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  container.securityContext.privileged == true
  msg := sprintf("Privileged container found: %s", [container.name])
}

# Require resource limits
deny_no_limits[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits
  msg := sprintf("Container without resource limits: %s", [container.name])
}

# Require security context
deny_no_security_context[msg] {
  input.kind == "Deployment"
  not input.spec.template.spec.securityContext
  msg := "Pod missing security context"
}
EOF

        # Best practices policies
        cat > "$POLICIES_DIR/best_practices.rego" << 'EOF'
package main

# Require health checks
deny_no_readiness_probe[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.readinessProbe
  msg := sprintf("Container missing readiness probe: %s", [container.name])
}

# Require labels
deny_missing_labels[msg] {
  input.kind == "Deployment"
  not input.metadata.labels.app
  msg := "Deployment missing app label"
}

# Require anti-affinity for high availability
warn_no_anti_affinity[msg] {
  input.kind == "Deployment"
  input.spec.replicas > 1
  not input.spec.template.spec.affinity
  msg := "Consider adding pod anti-affinity for high availability"
}
EOF
    fi

    local policy_failed=false

    # Validate Kubernetes manifests against policies
    if find "$K8S_MANIFESTS_DIR" -name "*.yaml" -o -name "*.yml" | grep -q .; then
        log_info "Running policy checks on Kubernetes manifests..."
        if ! conftest test --policy "$POLICIES_DIR" $(find "$K8S_MANIFESTS_DIR" -name "*.yaml" -o -name "*.yml"); then
            log_error "Policy validation failed for Kubernetes manifests"
            policy_failed=true
        fi
    fi

    # Validate Terraform plans if available
    if [ -d "$TERRAFORM_DIR" ] && [ -f "$TERRAFORM_DIR/terraform.tfplan" ]; then
        log_info "Running policy checks on Terraform plan..."
        if ! conftest test --policy "$POLICIES_DIR" "$TERRAFORM_DIR/terraform.tfplan"; then
            log_error "Policy validation failed for Terraform plan"
            policy_failed=true
        fi
    fi

    if [ "$policy_failed" = false ]; then
        log_success "All policy checks passed"
        return 0
    else
        return 1
    fi
}

# Validate container images
validate_container_images() {
    log_info "Validating container images..."

    local images=$(find "$K8S_MANIFESTS_DIR" -name "*.yaml" -o -name "*.yml" -exec grep -h "image:" {} \; | sed 's/.*image:\s*//' | sort | uniq)

    if [ -z "$images" ]; then
        log_warning "No container images found in manifests"
        return 0
    fi

    local failed_images=()

    for image in $images; do
        log_info "Checking image: $image"
        # Basic image validation (check if exists in registry)
        if ! docker manifest inspect "$image" >/dev/null 2>&1; then
            log_warning "Could not verify image: $image (may require registry authentication)"
        else
            log_success "Image verified: $image"
        fi
    done

    return 0
}

# Generate validation report
generate_report() {
    local report_file="validation-report-$(date +%Y%m%d-%H%M%S).json"

    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "validation_passed": $VALIDATION_PASSED,
  "checks": {
    "kubernetes_manifests": "completed",
    "infrastructure_drift": "completed",
    "policy_validation": "completed",
    "container_images": "completed"
  },
  "environment": {
    "namespace": "$NAMESPACE",
    "k8s_manifests_dir": "$K8S_MANIFESTS_DIR",
    "terraform_dir": "$TERRAFORM_DIR",
    "policies_dir": "$POLICIES_DIR"
  }
}
EOF

    log_info "Validation report saved to: $report_file"
}

# Main validation function
run_validation() {
    log_info "Starting pre-deployment validation"
    log_info "Environment: $NAMESPACE"
    log_info "K8s manifests: $K8S_MANIFESTS_DIR"
    log_info "Terraform: $TERRAFORM_DIR"
    log_info "Policies: $POLICIES_DIR"

    local start_time=$(date +%s)

    # Run all validations
    validate_k8s_manifests
    check_infrastructure_drift
    validate_policies
    validate_container_images

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Generate report
    generate_report

    echo ""
    if [ "$VALIDATION_PASSED" = true ]; then
        log_success "🎉 All pre-deployment validations passed! (${duration}s)"
        echo "Ready for deployment."
        return 0
    else
        log_error "💥 Pre-deployment validation failed! (${duration}s)"
        echo "Please fix the issues above before deploying."
        return 1
    fi
}

# Main execution
main() {
    local command="${1:-validate}"

    case "$command" in
        validate)
            run_validation
            ;;
        k8s)
            validate_k8s_manifests
            ;;
        drift)
            check_infrastructure_drift
            ;;
        policies)
            validate_policies
            ;;
        images)
            validate_container_images
            ;;
        *)
            echo "Usage: $0 [validate|k8s|drift|policies|images]"
            echo "Commands:"
            echo "  validate - Run all validations (default)"
            echo "  k8s      - Validate Kubernetes manifests only"
            echo "  drift    - Check infrastructure drift only"
            echo "  policies - Run policy validation only"
            echo "  images   - Validate container images only"
            exit 1
            ;;
    esac
}

# Run main if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
