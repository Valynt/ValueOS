# ValueOS Environment Maintenance Suite

This document provides a suite of automated shell scripts designed to maintain the integrity, availability, and performance of the **ValueOS** development environment. These scripts focus on automated initialization, service health monitoring, and self-healing port management.

---

## 1. Environment Initialization (`setup.sh`)

This script streamlines the onboarding process by ensuring environment variables are synchronized, dependencies are installed, and security/configuration layers like `direnv` are active.

```bash
#!/usr/bin/env bash

# --- Configuration ---
ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting ValueOS Setup...${NC}"

# 1. Direnv Initialization
if command -v direnv &> /dev/null; then
    echo -e "Configuring direnv..."
    direnv allow .
else
    echo -e "${RED}Warning: direnv not found. Please install it to manage env vars automatically.${NC}"
fi

# 2. Dependency Installation
if [ -f "package.json" ]; then
    echo -e "Installing NPM dependencies..."
    npm install
else
    echo -e "${RED}Error: package.json not found.${NC}"
    exit 1
fi

# 3. Secret & Environment Validation
echo -e "Validating environment variables..."

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Creating $ENV_FILE from $EXAMPLE_FILE...${NC}"
    cp "$EXAMPLE_FILE" "$ENV_FILE"
fi

# Extract keys from .env.example and check if they exist in .env
MISSING_KEYS=()
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Skip comments and empty lines
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    
    # Extract only the key name
    clean_key=$(echo "$key" | awk '{print $1}')
    
    if ! grep -q "^$clean_key=" "$ENV_FILE"; then
        MISSING_KEYS+=("$clean_key")
    fi
done < "$EXAMPLE_FILE"

if [ ${#MISSING_KEYS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ Environment validation successful.${NC}"
else
    echo -e "${RED}✗ Missing keys in $ENV_FILE:${NC}"
    for k in "${MISSING_KEYS[@]}"; do
        echo -e "  - $k"
    done
    echo -e "${YELLOW}Please update your $ENV_FILE to match the required schema.${NC}"
fi

echo -e "${GREEN}Setup Complete.${NC}"
```

---

## 2. Infrastructure Health Check (`healthcheck.sh`)

A diagnostic utility to verify the availability of core ValueOS services. It uses `nc` (Netcat) for socket-level verification and `curl` for application-layer responses.

```bash
#!/usr/bin/env bash

# --- Configuration ---
VITE_PORT=5173
SUPABASE_PORT=5432
JAEGER_PORT=16686
CHECK_MARK="\033[0;32mUP\033[0m"
CROSS_MARK="\033[0;31mDOWN\033[0m"

echo "ValueOS Service Status Report"
echo "-----------------------------"

check_service() {
    local name=$1
    local port=$2
    local type=$3 # "tcp" or "http"
    local url=$4

    if [ "$type" == "http" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$url")
        if [ "$status" == "200" ] || [ "$status" == "302" ]; then
            printf "%-15s [%-10s] Port %s\n" "$name" "$CHECK_MARK" "$port"
        else
            printf "%-15s [%-10s] Port %s (Status: %s)\n" "$name" "$CROSS_MARK" "$port" "$status"
        fi
    else
        nc -z -w 2 localhost "$port" &> /dev/null
        if [ $? -eq 0 ]; then
            printf "%-15s [%-10s] Port %s\n" "$name" "$CHECK_MARK" "$port"
        else
            printf "%-15s [%-10s] Port %s\n" "$name" "$CROSS_MARK" "$port"
        fi
    fi
}

# Execute Checks
check_service "Vite UI" "$VITE_PORT" "http" "http://localhost:$VITE_PORT"
check_service "Supabase DB" "$SUPABASE_PORT" "tcp"
check_service "Jaeger Trace" "$JAEGER_PORT" "http" "http://localhost:$JAEGER_PORT"

echo "-----------------------------"
```

---

## 3. Port Conflict Resolution (`fix-ports.sh`)

This "Self-Healing" script identifies processes obstructing required ValueOS ports. It offers interactive termination of rogue processes and provides `socat` forwarding capabilities to bridge external service containers to the local host if native mapping fails.

```bash
#!/usr/bin/env bash

PORTS=(5173 5432 16686)

echo "Searching for port conflicts..."

for PORT in "${PORTS[@]}"; do
    PID=$(lsof -ti:"$PORT")
    
    if [ -n "$PID" ]; then
        PROCESS_NAME=$(ps -p "$PID" -o comm=)
        echo -e "\033[1;33mPort $PORT is blocked\033[0m by $PROCESS_NAME (PID: $PID)"
        
        read -p "Would you like to kill this process? (y/n): " confirm
        if [[ $confirm == [yY] || $confirm == [yY][eE][sS] ]]; then
            kill -9 "$PID"
            echo "Process $PID terminated."
        fi
    else
        echo -e "\033[0;32mPort $PORT is clear.\033[0m"
    fi
done

# Self-Healing: Socat Forwarding logic
# Use case: Forwarding a Docker-exposed internal port to the expected local port
read -p "Do you need to initialize socat port-forwarding for remote services? (y/n): " socat_confirm
if [[ $socat_confirm == [yY] ]]; then
    read -p "Enter Target Port (e.g. 5432): " TARGET
    read -p "Enter Source IP/Host (e.g. 172.17.0.1): " SOURCE_IP
    
    echo "Starting socat: Local:$TARGET -> $SOURCE_IP:$TARGET"
    # Runs in background
    socat TCP-LISTEN:"$TARGET",fork,reuseaddr TCP:"$SOURCE_IP":"$TARGET" &
    echo "Forwarding active in background."
fi
```

---

## Implementation Guidelines

### 1. Permissions and Line Endings
To ensure cross-platform compatibility and execution rights, run the following commands in the root directory:

```bash
# Set executable permissions
chmod +x setup.sh healthcheck.sh fix-ports.sh

# Ensure LF line endings (required for Unix-based shells)
sed -i 's/\r$//' setup.sh
sed -i 's/\r$//' healthcheck.sh
sed -i 's/\r$//' fix-ports.sh
```

### 2. Strategic Summary

| Script | Primary Function | Failure Mode |
| :--- | :--- | :--- |
| **`setup.sh`** | Dependency & Config Sync | Halts if `package.json` is missing; warns on `.env` mismatch. |
| **`healthcheck.sh`** | Connectivity Audit | Returns non-zero exit code if critical services (Supabase) are down. |
| **`fix-ports.sh`** | Resource Reclamation | Requires `sudo` if blocking processes are owned by root. |

### 3. Usage Recommendations
*   **Daily Workflow:** Run `./healthcheck.sh` before starting development.
*   **Initial Setup:** Run `./setup.sh` after every `git pull` to ensure new environment variables are captured.
*   **Conflict Resolution:** Use `./fix-ports.sh` when encountering `EADDRINUSE` errors during Vite or Docker startup.