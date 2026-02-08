#!/bin/bash
# Generate lint reports for all packages

set -e

echo "Generating lint baseline reports..."

# Create .lint directory if it doesn't exist
mkdir -p .lint

# Function to generate report for a package
generate_report() {
    local package=$1
    local output_file=".lint/${package}.json"

    echo "Generating report for ${package}..."

    if [ -d "packages/${package}" ]; then
        cd "packages/${package}"
        npx --yes eslint src/ --format json --output-file "../../${output_file}" 2>/dev/null || echo "Failed to generate report for ${package}"
        cd ../..
    elif [ -d "apps/${package}" ]; then
        cd "apps/${package}"
        npx --yes eslint src/ --format json --output-file "../../${output_file}" 2>/dev/null || echo "Failed to generate report for ${package}"
        cd ../..
    else
        echo "Package ${package} not found"
    fi
}

# Generate reports for key packages
generate_report "backend"
generate_report "shared"
generate_report "agents"
generate_report "components"
generate_report "valynt-app"

echo "Lint reports generated in .lint/ directory"