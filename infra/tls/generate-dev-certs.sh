#!/bin/bash
# Generate mTLS Certificates for Local Development
# Creates CA, server, and client certificates for service-to-service communication

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="${SCRIPT_DIR}/certs"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔐 Generating mTLS Certificates for Local Development${NC}"
echo "=================================================="
echo ""

# Create certs directory
mkdir -p "${CERTS_DIR}"
cd "${CERTS_DIR}"

# Clean up old certificates
rm -f *.pem *.key *.csr *.srl

echo -e "${BLUE}Step 1: Generate Certificate Authority (CA)${NC}"
echo "-------------------------------------------"

# Generate CA private key
openssl genrsa -out ca-key.pem 4096

# Generate CA certificate
openssl req -new -x509 -days 3650 -key ca-key.pem -out ca-cert.pem \
  -subj "/C=US/ST=California/L=San Francisco/O=ValueCanvas Dev/OU=Development/CN=ValueCanvas Dev CA"

echo -e "${GREEN}✓ CA certificate generated${NC}"
echo ""

# Step 2: Generate Server Certificates
echo -e "${BLUE}Step 2: Generate Server Certificates${NC}"
echo "------------------------------------"

# Server names
SERVERS=("app" "postgres" "redis" "jaeger" "prometheus" "grafana")

for SERVER in "${SERVERS[@]}"; do
  echo "  → Generating certificate for ${SERVER}..."
  
  # Generate server private key
  openssl genrsa -out "${SERVER}-key.pem" 4096
  
  # Create CSR config
  cat > "${SERVER}-csr.conf" <<EOF
[req]
default_bits = 4096
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext

[dn]
C = US
ST = California
L = San Francisco
O = ValueCanvas Dev
OU = Development
CN = ${SERVER}.valuecanvas.local

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${SERVER}
DNS.2 = ${SERVER}.valuecanvas.local
DNS.3 = ${SERVER}.valuecanvas-network
DNS.4 = localhost
IP.1 = 127.0.0.1
EOF

  # Generate CSR
  openssl req -new -key "${SERVER}-key.pem" -out "${SERVER}.csr" \
    -config "${SERVER}-csr.conf"
  
  # Generate server certificate signed by CA
  openssl x509 -req -in "${SERVER}.csr" -CA ca-cert.pem -CAkey ca-key.pem \
    -CAcreateserial -out "${SERVER}-cert.pem" -days 365 \
    -extensions req_ext -extfile "${SERVER}-csr.conf"
  
  # Verify certificate
  openssl verify -CAfile ca-cert.pem "${SERVER}-cert.pem" > /dev/null 2>&1
  
  echo -e "  ${GREEN}✓ ${SERVER} certificate generated${NC}"
done

echo ""

# Step 3: Generate Client Certificates
echo -e "${BLUE}Step 3: Generate Client Certificates${NC}"
echo "------------------------------------"

CLIENTS=("app-client" "admin-client" "monitoring-client")

for CLIENT in "${CLIENTS[@]}"; do
  echo "  → Generating certificate for ${CLIENT}..."
  
  # Generate client private key
  openssl genrsa -out "${CLIENT}-key.pem" 4096
  
  # Generate CSR
  openssl req -new -key "${CLIENT}-key.pem" -out "${CLIENT}.csr" \
    -subj "/C=US/ST=California/L=San Francisco/O=ValueCanvas Dev/OU=Development/CN=${CLIENT}"
  
  # Generate client certificate signed by CA
  openssl x509 -req -in "${CLIENT}.csr" -CA ca-cert.pem -CAkey ca-key.pem \
    -CAcreateserial -out "${CLIENT}-cert.pem" -days 365
  
  # Verify certificate
  openssl verify -CAfile ca-cert.pem "${CLIENT}-cert.pem" > /dev/null 2>&1
  
  echo -e "  ${GREEN}✓ ${CLIENT} certificate generated${NC}"
done

echo ""

# Step 4: Create combined certificate bundles
echo -e "${BLUE}Step 4: Create Certificate Bundles${NC}"
echo "----------------------------------"

for SERVER in "${SERVERS[@]}"; do
  cat "${SERVER}-cert.pem" ca-cert.pem > "${SERVER}-bundle.pem"
  echo -e "  ${GREEN}✓ ${SERVER} bundle created${NC}"
done

echo ""

# Step 5: Set permissions
echo -e "${BLUE}Step 5: Set Permissions${NC}"
echo "----------------------"
chmod 600 *-key.pem
chmod 644 *-cert.pem *-bundle.pem ca-cert.pem
echo -e "${GREEN}✓ Permissions set (keys: 600, certs: 644)${NC}"
echo ""

# Step 6: Generate certificate info
echo -e "${BLUE}Step 6: Certificate Information${NC}"
echo "------------------------------"

cat > cert-info.txt <<EOF
mTLS Certificates for ValueCanvas Development
==============================================

Generated: $(date)
Valid for: 365 days (CA: 10 years)

Certificate Authority:
  File: ca-cert.pem
  Subject: /C=US/ST=California/L=San Francisco/O=ValueCanvas Dev/OU=Development/CN=ValueCanvas Dev CA

Server Certificates:
EOF

for SERVER in "${SERVERS[@]}"; do
  EXPIRY=$(openssl x509 -in "${SERVER}-cert.pem" -noout -enddate | cut -d= -f2)
  cat >> cert-info.txt <<EOF
  - ${SERVER}:
    Cert: ${SERVER}-cert.pem
    Key:  ${SERVER}-key.pem
    Bundle: ${SERVER}-bundle.pem
    Expires: ${EXPIRY}
EOF
done

cat >> cert-info.txt <<EOF

Client Certificates:
EOF

for CLIENT in "${CLIENTS[@]}"; do
  EXPIRY=$(openssl x509 -in "${CLIENT}-cert.pem" -noout -enddate | cut -d= -f2)
  cat >> cert-info.txt <<EOF
  - ${CLIENT}:
    Cert: ${CLIENT}-cert.pem
    Key:  ${CLIENT}-key.pem
    Expires: ${EXPIRY}
EOF
done

cat >> cert-info.txt <<EOF

Usage in Docker Compose:
  1. Mount certificates as volumes
  2. Configure services to use cert/key files
  3. Set CA certificate for verification

Example (Traefik):
  volumes:
    - ./infrastructure/tls/certs/ca-cert.pem:/certs/ca.pem:ro
    - ./infrastructure/tls/certs/app-cert.pem:/certs/cert.pem:ro
    - ./infrastructure/tls/certs/app-key.pem:/certs/key.pem:ro

Security Notice:
⚠️  These certificates are for LOCAL DEVELOPMENT ONLY
⚠️  Never use these in production environments
⚠️  CA private key should be rotated regularly
EOF

echo -e "${GREEN}✓ Certificate information saved to cert-info.txt${NC}"
echo ""

# Summary
echo "=================================================="
echo -e "${GREEN}✅ All certificates generated successfully!${NC}"
echo "=================================================="
echo ""
echo "Certificates location: ${CERTS_DIR}"
echo ""
echo "Generated:"
echo "  - 1 Certificate Authority (CA)"
echo "  - ${#SERVERS[@]} Server certificates"
echo "  - ${#CLIENTS[@]} Client certificates"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review cert-info.txt for certificate details"
echo "  2. Configure Traefik to use these certificates"
echo "  3. Restart docker-compose services"
echo ""
echo -e "${YELLOW}Expiry:${NC}"
echo "  - Server/Client certs: 365 days"
echo "  - CA certificate: 10 years"
echo ""
