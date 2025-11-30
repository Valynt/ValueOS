#!/bin/bash
# ValueCanvas - Security Headers Verification Script
# Phase 1: Verify gateway security headers are properly configured

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default URL
URL="${1:-https://valuecanvas.example.com}"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     ValueCanvas Security Headers Verification        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Testing URL: ${YELLOW}$URL${NC}"
echo ""

# Function to check header
check_header() {
    local header_name=$1
    local header_value=$(curl -sI "$URL" | grep -i "^$header_name:" | cut -d' ' -f2-)
    
    if [ -n "$header_value" ]; then
        echo -e "${GREEN}✅${NC} $header_name: ${header_value}"
        return 0
    else
        echo -e "${RED}❌${NC} $header_name: ${RED}MISSING${NC}"
        return 1
    fi
}

# Function to validate CSP
validate_csp() {
    local csp=$(curl -sI "$URL" | grep -i "^content-security-policy:" | cut -d' ' -f2-)
    
    if [ -z "$csp" ]; then
        return 1
    fi
    
    # Check for critical directives
    local issues=0
    
    if ! echo "$csp" | grep -q "default-src"; then
        echo -e "  ${YELLOW}⚠️  Warning: Missing 'default-src' directive${NC}"
        issues=$((issues + 1))
    fi
    
    if ! echo "$csp" | grep -q "script-src"; then
        echo -e "  ${YELLOW}⚠️  Warning: Missing 'script-src' directive${NC}"
        issues=$((issues + 1))
    fi
    
    if echo "$csp" | grep -q "'unsafe-eval'"; then
        echo -e "  ${YELLOW}⚠️  Warning: Using 'unsafe-eval' in script-src${NC}"
        issues=$((issues + 1))
    fi
    
    if ! echo "$csp" | grep -q "frame-ancestors"; then
        echo -e "  ${YELLOW}⚠️  Warning: Missing 'frame-ancestors' directive${NC}"
        issues=$((issues + 1))
    fi
    
    if [ $issues -eq 0 ]; then
        echo -e "  ${GREEN}✓${NC} CSP looks good!"
    fi
    
    return 0
}

# Function to validate HSTS
validate_hsts() {
    local hsts=$(curl -sI "$URL" | grep -i "^strict-transport-security:" | cut -d' ' -f2-)
    
    if [ -z "$hsts" ]; then
        return 1
    fi
    
    # Check max-age
    local max_age=$(echo "$hsts" | grep -oP 'max-age=\K[0-9]+')
    
    if [ -n "$max_age" ]; then
        if [ "$max_age" -lt 31536000 ]; then
            echo -e "  ${YELLOW}⚠️  Warning: max-age is less than 1 year (31536000 seconds)${NC}"
            echo -e "  ${YELLOW}   Current: $max_age seconds${NC}"
        else
            echo -e "  ${GREEN}✓${NC} max-age is sufficient (1+ year)"
        fi
    fi
    
    if echo "$hsts" | grep -q "includeSubDomains"; then
        echo -e "  ${GREEN}✓${NC} includeSubDomains is set"
    else
        echo -e "  ${YELLOW}⚠️  Warning: Missing 'includeSubDomains'${NC}"
    fi
    
    if echo "$hsts" | grep -q "preload"; then
        echo -e "  ${GREEN}✓${NC} preload is set"
    else
        echo -e "  ${YELLOW}⚠️  Consider adding 'preload' for maximum security${NC}"
    fi
    
    return 0
}

# Check if URL is accessible
echo -e "${BLUE}Testing connectivity...${NC}"
if ! curl -sI "$URL" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to $URL${NC}"
    echo -e "${YELLOW}Make sure the URL is correct and accessible${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Connection successful${NC}"
echo ""

# Check each security header
echo -e "${BLUE}Checking security headers:${NC}"
echo ""

passed=0
failed=0

# 1. Content-Security-Policy
if check_header "Content-Security-Policy"; then
    validate_csp
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi
echo ""

# 2. Strict-Transport-Security
if check_header "Strict-Transport-Security"; then
    validate_hsts
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi
echo ""

# 3. X-Frame-Options
if check_header "X-Frame-Options"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi
echo ""

# 4. X-Content-Type-Options
if check_header "X-Content-Type-Options"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi
echo ""

# 5. Referrer-Policy
if check_header "Referrer-Policy"; then
    passed=$((passed + 1))
else
    failed=$((failed + 1))
fi
echo ""

# 6. X-XSS-Protection (optional but recommended)
if check_header "X-XSS-Protection"; then
    passed=$((passed + 1))
else
    echo -e "${YELLOW}⚠️${NC}  X-XSS-Protection: ${YELLOW}MISSING (optional for modern browsers)${NC}"
fi
echo ""

# 7. Permissions-Policy (optional)
if check_header "Permissions-Policy"; then
    passed=$((passed + 1))
else
    echo -e "${YELLOW}⚠️${NC}  Permissions-Policy: ${YELLOW}MISSING (optional)${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     Summary                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ All critical security headers are present!${NC}"
    echo -e "${GREEN}   Passed: $passed / $((passed + failed))${NC}"
    echo ""
    echo -e "${GREEN}🎉 Your gateway security configuration is working correctly!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some security headers are missing!${NC}"
    echo -e "${RED}   Passed: $passed / $((passed + failed))${NC}"
    echo -e "${RED}   Failed: $failed${NC}"
    echo ""
    echo -e "${YELLOW}Please review your gateway configuration:${NC}"
    echo -e "  - Nginx: ${BLUE}/etc/nginx/conf.d/security-headers.conf${NC}"
    echo -e "  - Envoy: ${BLUE}/etc/envoy/envoy.yaml${NC}"
    echo -e "  - Istio: ${BLUE}kubectl get envoyfilter security-headers -n valuecanvas${NC}"
    exit 1
fi
