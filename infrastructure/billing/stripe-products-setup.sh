#!/bin/bash
# ValueCanvas - Stripe Products & Prices Setup
# Creates metered products and tiered pricing in Stripe

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Stripe Products & Prices Setup                   ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for Stripe CLI
if ! command -v stripe &> /dev/null; then
    echo -e "${RED}❌ Stripe CLI not found${NC}"
    echo -e "${YELLOW}Install from: https://stripe.com/docs/stripe-cli${NC}"
    exit 1
fi

# Check for API key
if [ -z "$STRIPE_API_KEY" ]; then
    echo -e "${YELLOW}STRIPE_API_KEY not set. Using Stripe CLI auth...${NC}"
fi

echo -e "${BLUE}Creating Stripe products and prices...${NC}"
echo ""

# ============================================================================
# Product 1: LLM Tokens
# ============================================================================

echo -e "${YELLOW}Creating LLM Tokens product...${NC}"

LLM_PRODUCT=$(stripe products create \
  --name="LLM Tokens" \
  --description="AI model token usage" \
  --unit-label="tokens" \
  --format=json 2>/dev/null || echo '{"id":""}')

LLM_PRODUCT_ID=$(echo $LLM_PRODUCT | jq -r '.id')

if [ -n "$LLM_PRODUCT_ID" ] && [ "$LLM_PRODUCT_ID" != "" ]; then
    echo -e "${GREEN}✅ LLM Tokens Product: $LLM_PRODUCT_ID${NC}"
    
    # Free tier: $0/month, $0.01/1000 overage
    LLM_FREE=$(stripe prices create \
      --product=$LLM_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=tiered \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=sum \
      --tiers-mode=graduated \
      --tiers[0][up-to]=10000 \
      --tiers[0][unit-amount]=0 \
      --tiers[1][up-to]=inf \
      --tiers[1][unit-amount]=0.00001 \
      --nickname="LLM Tokens - Free" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Free tier price: $(echo $LLM_FREE | jq -r '.id')${NC}"
    
    # Standard tier: $0.01/1000 tokens
    LLM_STANDARD=$(stripe prices create \
      --product=$LLM_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=sum \
      --unit-amount-decimal=0.00001 \
      --nickname="LLM Tokens - Standard" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Standard tier price: $(echo $LLM_STANDARD | jq -r '.id')${NC}"
    
    # Enterprise tier: $0.005/1000 tokens
    LLM_ENTERPRISE=$(stripe prices create \
      --product=$LLM_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=sum \
      --unit-amount-decimal=0.000005 \
      --nickname="LLM Tokens - Enterprise" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Enterprise tier price: $(echo $LLM_ENTERPRISE | jq -r '.id')${NC}"
else
    echo -e "${RED}❌ Failed to create LLM Tokens product${NC}"
fi

echo ""

# ============================================================================
# Product 2: Agent Executions
# ============================================================================

echo -e "${YELLOW}Creating Agent Executions product...${NC}"

AGENT_PRODUCT=$(stripe products create \
  --name="Agent Executions" \
  --description="AI agent task executions" \
  --unit-label="executions" \
  --format=json 2>/dev/null || echo '{"id":""}')

AGENT_PRODUCT_ID=$(echo $AGENT_PRODUCT | jq -r '.id')

if [ -n "$AGENT_PRODUCT_ID" ] && [ "$AGENT_PRODUCT_ID" != "" ]; then
    echo -e "${GREEN}✅ Agent Executions Product: $AGENT_PRODUCT_ID${NC}"
    
    # Free tier: up to 100 free
    AGENT_FREE=$(stripe prices create \
      --product=$AGENT_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=tiered \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=sum \
      --tiers-mode=graduated \
      --tiers[0][up-to]=100 \
      --tiers[0][unit-amount]=0 \
      --tiers[1][up-to]=inf \
      --tiers[1][unit-amount]=0 \
      --nickname="Agent Executions - Free" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Free tier price: $(echo $AGENT_FREE | jq -r '.id')${NC}"
    
    # Standard tier: $0.10/execution
    AGENT_STANDARD=$(stripe prices create \
      --product=$AGENT_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=sum \
      --unit-amount=10 \
      --nickname="Agent Executions - Standard" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Standard tier price: $(echo $AGENT_STANDARD | jq -r '.id')${NC}"
    
    # Enterprise tier: $0.05/execution
    AGENT_ENTERPRISE=$(stripe prices create \
      --product=$AGENT_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=sum \
      --unit-amount=5 \
      --nickname="Agent Executions - Enterprise" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Enterprise tier price: $(echo $AGENT_ENTERPRISE | jq -r '.id')${NC}"
else
    echo -e "${RED}❌ Failed to create Agent Executions product${NC}"
fi

echo ""

# ============================================================================
# Product 3: API Calls
# ============================================================================

echo -e "${YELLOW}Creating API Calls product...${NC}"

API_PRODUCT=$(stripe products create \
  --name="API Calls" \
  --description="API request usage" \
  --unit-label="calls" \
  --format=json 2>/dev/null || echo '{"id":""}')

API_PRODUCT_ID=$(echo $API_PRODUCT | jq -r '.id')

if [ -n "$API_PRODUCT_ID" ] && [ "$API_PRODUCT_ID" != "" ]; then
    echo -e "${GREEN}✅ API Calls Product: $API_PRODUCT_ID${NC}"
    
    # Free tier: up to 1000 free
    API_FREE=$(stripe prices create \
      --product=$API_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=tiered \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=sum \
      --tiers-mode=graduated \
      --tiers[0][up-to]=1000 \
      --tiers[0][unit-amount]=0 \
      --tiers[1][up-to]=inf \
      --tiers[1][unit-amount]=0 \
      --nickname="API Calls - Free" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Free tier price: $(echo $API_FREE | jq -r '.id')${NC}"
    
    # Standard tier: $0.001/call
    API_STANDARD=$(stripe prices create \
      --product=$API_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=sum \
      --unit-amount-decimal=0.1 \
      --nickname="API Calls - Standard" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Standard tier price: $(echo $API_STANDARD | jq -r '.id')${NC}"
    
    # Enterprise tier: $0.0005/call
    API_ENTERPRISE=$(stripe prices create \
      --product=$API_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=sum \
      --unit-amount-decimal=0.05 \
      --nickname="API Calls - Enterprise" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Enterprise tier price: $(echo $API_ENTERPRISE | jq -r '.id')${NC}"
else
    echo -e "${RED}❌ Failed to create API Calls product${NC}"
fi

echo ""

# ============================================================================
# Product 4: Storage
# ============================================================================

echo -e "${YELLOW}Creating Storage product...${NC}"

STORAGE_PRODUCT=$(stripe products create \
  --name="Storage" \
  --description="Data storage in GB" \
  --unit-label="GB" \
  --format=json 2>/dev/null || echo '{"id":""}')

STORAGE_PRODUCT_ID=$(echo $STORAGE_PRODUCT | jq -r '.id')

if [ -n "$STORAGE_PRODUCT_ID" ] && [ "$STORAGE_PRODUCT_ID" != "" ]; then
    echo -e "${GREEN}✅ Storage Product: $STORAGE_PRODUCT_ID${NC}"
    
    # Free tier: 1 GB included
    STORAGE_FREE=$(stripe prices create \
      --product=$STORAGE_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=tiered \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=max \
      --tiers-mode=graduated \
      --tiers[0][up-to]=1 \
      --tiers[0][unit-amount]=0 \
      --tiers[1][up-to]=inf \
      --tiers[1][unit-amount]=0 \
      --nickname="Storage - Free" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Free tier price: $(echo $STORAGE_FREE | jq -r '.id')${NC}"
    
    # Standard tier: $0.50/GB
    STORAGE_STANDARD=$(stripe prices create \
      --product=$STORAGE_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=max \
      --unit-amount=50 \
      --nickname="Storage - Standard" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Standard tier price: $(echo $STORAGE_STANDARD | jq -r '.id')${NC}"
    
    # Enterprise tier: $0.25/GB
    STORAGE_ENTERPRISE=$(stripe prices create \
      --product=$STORAGE_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=max \
      --unit-amount=25 \
      --nickname="Storage - Enterprise" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Enterprise tier price: $(echo $STORAGE_ENTERPRISE | jq -r '.id')${NC}"
else
    echo -e "${RED}❌ Failed to create Storage product${NC}"
fi

echo ""

# ============================================================================
# Product 5: User Seats
# ============================================================================

echo -e "${YELLOW}Creating User Seats product...${NC}"

SEATS_PRODUCT=$(stripe products create \
  --name="User Seats" \
  --description="Active user seats" \
  --unit-label="seats" \
  --format=json 2>/dev/null || echo '{"id":""}')

SEATS_PRODUCT_ID=$(echo $SEATS_PRODUCT | jq -r '.id')

if [ -n "$SEATS_PRODUCT_ID" ] && [ "$SEATS_PRODUCT_ID" != "" ]; then
    echo -e "${GREEN}✅ User Seats Product: $SEATS_PRODUCT_ID${NC}"
    
    # Free tier: 3 seats included
    SEATS_FREE=$(stripe prices create \
      --product=$SEATS_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=tiered \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=max \
      --tiers-mode=graduated \
      --tiers[0][up-to]=3 \
      --tiers[0][unit-amount]=0 \
      --tiers[1][up-to]=inf \
      --tiers[1][unit-amount]=0 \
      --nickname="User Seats - Free" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Free tier price: $(echo $SEATS_FREE | jq -r '.id')${NC}"
    
    # Standard tier: $5/seat
    SEATS_STANDARD=$(stripe prices create \
      --product=$SEATS_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=max \
      --unit-amount=500 \
      --nickname="User Seats - Standard" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Standard tier price: $(echo $SEATS_STANDARD | jq -r '.id')${NC}"
    
    # Enterprise tier: Unlimited (tracked but not charged)
    SEATS_ENTERPRISE=$(stripe prices create \
      --product=$SEATS_PRODUCT_ID \
      --currency=usd \
      --billing-scheme=per-unit \
      --recurring[interval]=month \
      --recurring[usage-type]=metered \
      --recurring[aggregate-usage]=max \
      --unit-amount=0 \
      --nickname="User Seats - Enterprise (Unlimited)" \
      --format=json 2>/dev/null || echo '{"id":""}')
    
    echo -e "${GREEN}  ✓ Enterprise tier price: $(echo $SEATS_ENTERPRISE | jq -r '.id')${NC}"
else
    echo -e "${RED}❌ Failed to create User Seats product${NC}"
fi

echo ""

# ============================================================================
# Save Product/Price IDs to Config File
# ============================================================================

echo -e "${BLUE}Saving product/price IDs to config...${NC}"

CONFIG_FILE="./stripe-config.json"

cat > $CONFIG_FILE << EOF
{
  "products": {
    "llm_tokens": {
      "product_id": "$LLM_PRODUCT_ID",
      "prices": {
        "free": "$(echo $LLM_FREE | jq -r '.id')",
        "standard": "$(echo $LLM_STANDARD | jq -r '.id')",
        "enterprise": "$(echo $LLM_ENTERPRISE | jq -r '.id')"
      }
    },
    "agent_executions": {
      "product_id": "$AGENT_PRODUCT_ID",
      "prices": {
        "free": "$(echo $AGENT_FREE | jq -r '.id')",
        "standard": "$(echo $AGENT_STANDARD | jq -r '.id')",
        "enterprise": "$(echo $AGENT_ENTERPRISE | jq -r '.id')"
      }
    },
    "api_calls": {
      "product_id": "$API_PRODUCT_ID",
      "prices": {
        "free": "$(echo $API_FREE | jq -r '.id')",
        "standard": "$(echo $API_STANDARD | jq -r '.id')",
        "enterprise": "$(echo $API_ENTERPRISE | jq -r '.id')"
      }
    },
    "storage_gb": {
      "product_id": "$STORAGE_PRODUCT_ID",
      "prices": {
        "free": "$(echo $STORAGE_FREE | jq -r '.id')",
        "standard": "$(echo $STORAGE_STANDARD | jq -r '.id')",
        "enterprise": "$(echo $STORAGE_ENTERPRISE | jq -r '.id')"
      }
    },
    "user_seats": {
      "product_id": "$SEATS_PRODUCT_ID",
      "prices": {
        "free": "$(echo $SEATS_FREE | jq -r '.id')",
        "standard": "$(echo $SEATS_STANDARD | jq -r '.id')",
        "enterprise": "$(echo $SEATS_ENTERPRISE | jq -r '.id')"
      }
    }
  }
}
EOF

echo -e "${GREEN}✅ Config saved to: $CONFIG_FILE${NC}"
echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${BLUE}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                     Summary                           ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}✅ Stripe products and prices created!${NC}"
echo ""
echo -e "Products created:"
echo -e "  1. LLM Tokens (${LLM_PRODUCT_ID})"
echo -e "  2. Agent Executions (${AGENT_PRODUCT_ID})"
echo -e "  3. API Calls (${API_PRODUCT_ID})"
echo -e "  4. Storage (${STORAGE_PRODUCT_ID})"
echo -e "  5. User Seats (${SEATS_PRODUCT_ID})"
echo ""
echo -e "Next steps:"
echo -e "  1. Copy product/price IDs to src/config/billing.ts"
echo -e "  2. Set STRIPE_SECRET_KEY in .env"
echo -e "  3. Set STRIPE_WEBHOOK_SECRET after creating webhook"
echo -e "  4. Run database migration"
echo ""
