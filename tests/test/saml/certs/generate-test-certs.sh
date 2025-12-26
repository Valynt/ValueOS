#!/bin/bash
# ============================================================================
# SAML Test Certificate Generation
# ============================================================================
# Creates self-signed certificates for SAML testing
# WARNING: FOR TESTING ONLY - Never use in production
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Generating SAML test certificates..."

# Create valid certificate (10 year validity)
openssl req -x509 -newkey rsa:4096 -keyout saml-sp-key.pem -out saml-sp-cert.pem \
  -days 3650 -nodes -subj "/CN=valuecanvas-test-sp/O=ValueCanvas/C=US"

# Create expired certificate (expired 1 year ago)
openssl req -x509 -newkey rsa:4096 -keyout saml-sp-expired-key.pem -out saml-sp-expired-cert.pem \
  -days 1 -nodes -subj "/CN=valuecanvas-expired-sp/O=ValueCanvas/C=US"
faketime '2 years ago' touch saml-sp-expired-cert.pem || echo "Warning: faketime not available, expired cert may not be properly backdated"

# Create IdP certificate
openssl req -x509 -newkey rsa:4096 -keyout saml-idp-key.pem -out saml-idp-cert.pem \
  -days 3650 -nodes -subj "/CN=valuecanvas-test-idp/O=ValueCanvas/C=US"

# Set appropriate permissions
chmod 600 *.pem

echo "✓ Certificates generated successfully"
echo "  - saml-sp-cert.pem (SP public certificate)"
echo "  - saml-sp-key.pem (SP private key)"
echo "  - saml-sp-expired-cert.pem (Expired certificate for testing)"
echo "  - saml-idp-cert.pem (IdP public certificate)"
echo "  - saml-idp-key.pem (IdP private key)"
