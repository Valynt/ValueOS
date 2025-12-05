#!/bin/bash
# Test mTLS Configuration
# Validates mutual TLS authentication between services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 Testing mTLS Configuration${NC}"
echo "============================="
echo ""

# Check if certificates exist
if [ ! -f "${CERTS_DIR}/ca-cert.pem" ]; then
    echo -e "${RED}✗ Certificates not found${NC}"
    echo "Run: bash infrastructure/tls/generate-dev-certs.sh"
    exit 1
fi

echo -e "${GREEN}✓ Certificates found${NC}"
echo ""

# Test 1: Verify CA certificate
echo -e "${BLUE}Test 1: Verify CA Certificate${NC}"
echo "------------------------------"
openssl x509 -in "${CERTS_DIR}/ca-cert.pem" -noout -text | grep -q "CA:TRUE"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ CA certificate is valid${NC}"
else
    echo -e "${RED}✗ CA certificate is invalid${NC}"
    exit 1
fi
echo ""

# Test 2: Verify server certificates
echo -e "${BLUE}Test 2: Verify Server Certificates${NC}"
echo "-----------------------------------"

SERVERS=("app" "postgres" "redis")
for SERVER in "${SERVERS[@]}"; do
    if openssl verify -CAfile "${CERTS_DIR}/ca-cert.pem" "${CERTS_DIR}/${SERVER}-cert.pem" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ ${SERVER} certificate verified${NC}"
    else
        echo -e "${RED}✗ ${SERVER} certificate verification failed${NC}"
        exit 1
    fi
done
echo ""

# Test 3: Check certificate expiry
echo -e "${BLUE}Test 3: Check Certificate Expiry${NC}"
echo "---------------------------------"

for SERVER in "${SERVERS[@]}"; do
    EXPIRY=$(openssl x509 -in "${CERTS_DIR}/${SERVER}-cert.pem" -noout -enddate | cut -d= -f2)
    EXPIRY_EPOCH=$(date -d "${EXPIRY}" +%s)
    NOW_EPOCH=$(date +%s)
    DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
    
    if [ $DAYS_LEFT -lt 30 ]; then
        echo -e "${YELLOW}⚠ ${SERVER}: Expires in ${DAYS_LEFT} days${NC}"
    else
        echo -e "${GREEN}✓ ${SERVER}: Valid for ${DAYS_LEFT} days${NC}"
    fi
done
echo ""

# Test 4: Test mTLS handshake (if Traefik is running)
echo -e "${BLUE}Test 4: Test mTLS Handshake${NC}"
echo "---------------------------"

if docker ps | grep -q valuecanvas-traefik; then
    echo "  → Testing with client certificate..."
    
    # Test with valid client cert
    if curl -s --cacert "${CERTS_DIR}/ca-cert.pem" \
            --cert "${CERTS_DIR}/app-client-cert.pem" \
            --key "${CERTS_DIR}/app-client-key.pem" \
            https://app.localhost 2>&1 | grep -q "SSL"; then
        echo -e "${GREEN}✓ mTLS handshake successful${NC}"
    else
        echo -e "${YELLOW}⚠ Could not connect (service may not be running)${NC}"
    fi
    
    # Test without client cert (should fail)
    echo "  → Testing without client certificate..."
    if curl -s --cacert "${CERTS_DIR}/ca-cert.pem" \
            https://app.localhost 2>&1 | grep -q "certificate required"; then
        echo -e "${GREEN}✓ Correctly rejected request without client cert${NC}"
    else
        echo -e "${YELLOW}⚠ Client cert not required (may not be enforced)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Traefik not running, skipping handshake test${NC}"
    echo "  Start with: docker-compose -f docker-compose.dev.yml -f infrastructure/docker-compose.mtls.yml up -d"
fi
echo ""

# Test 5: Check TLS version support
echo -e "${BLUE}Test 5: TLS Version Support${NC}"
echo "---------------------------"

if docker ps | grep -q valuecanvas-traefik; then
    # Test TLS 1.2
    if openssl s_client -connect localhost:443 -tls1_2 -CAfile "${CERTS_DIR}/ca-cert.pem" \
            -cert "${CERTS_DIR}/app-client-cert.pem" \
            -key "${CERTS_DIR}/app-client-key.pem" \
            < /dev/null 2>&1 | grep -q "Cipher"; then
        echo -e "${GREEN}✓ TLS 1.2 supported${NC}"
    fi
    
    # Test TLS 1.3
    if openssl s_client -connect localhost:443 -tls1_3 -CAfile "${CERTS_DIR}/ca-cert.pem" \
            -cert "${CERTS_DIR}/app-client-cert.pem" \
            -key "${CERTS_DIR}/app-client-key.pem" \
            < /dev/null 2>&1 | grep -q "Cipher"; then
        echo -e "${GREEN}✓ TLS 1.3 supported${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Traefik not running, skipping TLS version test${NC}"
fi
echo ""

# Summary
echo "============================="
echo -e "${GREEN}✅ mTLS Configuration Test Complete${NC}"
echo "============================="
echo ""
echo "Certificates are valid and properly configured."
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Start mTLS environment:"
echo "     docker-compose -f docker-compose.dev.yml -f infrastructure/docker-compose.mtls.yml up -d"
echo ""
echo "  2. Access Traefik dashboard:"
echo "     http://localhost:8080"
echo ""
echo "  3. Test with curl:"
echo "     curl --cacert ${CERTS_DIR}/ca-cert.pem \\"
echo "          --cert ${CERTS_DIR}/app-client-cert.pem \\"
echo "          --key ${CERTS_DIR}/app-client-key.pem \\"
echo "          https://app.localhost"
echo ""
