# Phase 2: Infrastructure & Security Configuration Checklist

**Manual infrastructure steps required to complete Phase 2 security hardening**

---

## ✅ Checklist Overview

- [ ] mTLS / Service Mesh Deployment
- [ ] Network Policies / Security Groups
- [ ] Service-to-Service Authentication
- [ ] Autonomy Level Configuration
- [ ] Approval Gates & Dual Control
- [ ] Verification Testing

---

## 🔐 Part 1: mTLS / Service Mesh Deployment

### 1.1 SPIFFE/SPIRE Setup

Deploy SPIFFE/SPIRE for workload identity:

#### Install SPIRE Server

```bash
# Kubernetes deployment
kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: spire
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: spire-server
  namespace: spire
spec:
  serviceName: spire-server
  replicas: 1
  selector:
    matchLabels:
      app: spire-server
  template:
    metadata:
      labels:
        app: spire-server
    spec:
      serviceAccountName: spire-server
      containers:
      - name: spire-server
        image: ghcr.io/spiffe/spire-server:1.8.0
        args:
          - -config
          - /run/spire/config/server.conf
        ports:
          - containerPort: 8081
        volumeMounts:
          - name: spire-config
            mountPath: /run/spire/config
            readOnly: true
          - name: spire-data
            mountPath: /run/spire/data
      volumes:
        - name: spire-config
          configMap:
            name: spire-server
        - name: spire-data
          persistentVolumeClaim:
            claimName: spire-data
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: spire-server
  namespace: spire
data:
  server.conf: |
    server {
      bind_address = "0.0.0.0"
      bind_port = "8081"
      trust_domain = "valuecanvas.example.com"
      data_dir = "/run/spire/data"
      log_level = "INFO"
      ca_ttl = "87600h"
      default_x509_svid_ttl = "1h"
    }

    plugins {
      DataStore "sql" {
        plugin_data {
          database_type = "postgres"
          connection_string = "postgresql://spire:password@postgres:5432/spire"
        }
      }

      NodeAttestor "k8s_psat" {
        plugin_data {
          clusters = {
            "valuecanvas-cluster" = {
              service_account_allow_list = ["spire:spire-agent"]
            }
          }
        }
      }

      KeyManager "disk" {
        plugin_data {
          keys_path = "/run/spire/data/keys.json"
        }
      }

      Notifier "k8sbundle" {
        plugin_data {}
      }
    }
EOF
```

#### Install SPIRE Agent (DaemonSet)

```bash
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: spire-agent
  namespace: spire
spec:
  selector:
    matchLabels:
      app: spire-agent
  template:
    metadata:
      labels:
        app: spire-agent
    spec:
      hostPID: true
      hostNetwork: true
      dnsPolicy: ClusterFirstWithHostNet
      serviceAccountName: spire-agent
      containers:
      - name: spire-agent
        image: ghcr.io/spiffe/spire-agent:1.8.0
        args:
          - -config
          - /run/spire/config/agent.conf
        volumeMounts:
          - name: spire-config
            mountPath: /run/spire/config
            readOnly: true
          - name: spire-bundle
            mountPath: /run/spire/bundle
          - name: spire-agent-socket
            mountPath: /run/spire/sockets
      volumes:
        - name: spire-config
          configMap:
            name: spire-agent
        - name: spire-bundle
          configMap:
            name: spire-bundle
        - name: spire-agent-socket
          hostPath:
            path: /run/spire/sockets
            type: DirectoryOrCreate
EOF
```

### 1.2 Configure STRICT mTLS

#### Istio Service Mesh (Recommended)

```bash
# Install Istio with strict mTLS
istioctl install --set profile=default -y

# Enable automatic sidecar injection
kubectl label namespace default istio-injection=enabled

# Apply strict mTLS policy
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
EOF
```

#### Configure Authorization Policies

```yaml
# File: k8s/istio/authz-policy.yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: valuecanvas-authz
  namespace: default
spec:
  # Default deny all
  action: DENY
  rules:
  - from:
    - source:
        notNamespaces: ["default"]

---
# Allow specific service-to-service communication
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-frontend-to-api
  namespace: default
spec:
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/frontend"]
    to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/*"]

---
# Allow API to database
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-api-to-db
  namespace: default
spec:
  selector:
    matchLabels:
      app: postgres
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/api-service"]
    to:
    - operation:
        ports: ["5432"]
```

Apply:
```bash
kubectl apply -f k8s/istio/authz-policy.yaml
```

### 1.3 Egress Control

```yaml
# File: k8s/istio/egress-policy.yaml
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: external-llm-api
spec:
  hosts:
  - "api.together.xyz"
  - "api.openai.com"
  ports:
  - number: 443
    name: https
    protocol: HTTPS
  location: MESH_EXTERNAL
  resolution: DNS

---
# Default deny egress (allowlist-based)
apiVersion: networking.istio.io/v1beta1
kind: Sidecar
metadata:
  name: default-egress-policy
  namespace: default
spec:
  outboundTrafficPolicy:
    mode: REGISTRY_ONLY
  egress:
  - hosts:
    - "./*"
    - "istio-system/*"
    - "external-llm-api"
```

Apply:
```bash
kubectl apply -f k8s/istio/egress-policy.yaml
```

---

## 🌐 Part 2: Network Policies / Security Groups

### 2.1 Kubernetes NetworkPolicies

```yaml
# File: k8s/network-policies/default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: default
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

---
# Allow frontend to API
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-api
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: api-service
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3000

---
# Allow API to database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-to-db
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-service
    ports:
    - protocol: TCP
      port: 5432

---
# Allow API egress to external LLM APIs
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-api-egress
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: api-service
  policyTypes:
  - Egress
  egress:
  - to:
    - namespaceSelector: {}
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - ports:
    - protocol: TCP
      port: 443  # HTTPS for external APIs
    - protocol: TCP
      port: 53   # DNS
      protocol: UDP
      port: 53
```

Apply:
```bash
kubectl apply -f k8s/network-policies/
```

### 2.2 AWS Security Groups (if using AWS)

```bash
# Create security groups
aws ec2 create-security-group \
  --group-name valuecanvas-frontend \
  --description "Frontend tier" \
  --vpc-id vpc-xxxxx

aws ec2 create-security-group \
  --group-name valuecanvas-api \
  --description "API tier" \
  --vpc-id vpc-xxxxx

aws ec2 create-security-group \
  --group-name valuecanvas-db \
  --description "Database tier" \
  --vpc-id vpc-xxxxx

# Allow frontend -> API
aws ec2 authorize-security-group-ingress \
  --group-id sg-api-xxxxx \
  --protocol tcp \
  --port 3000 \
  --source-group sg-frontend-xxxxx

# Allow API -> DB
aws ec2 authorize-security-group-ingress \
  --group-id sg-db-xxxxx \
  --protocol tcp \
  --port 5432 \
  --source-group sg-api-xxxxx

# Allow API -> Internet (egress for LLM APIs)
aws ec2 authorize-security-group-egress \
  --group-id sg-api-xxxxx \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

---

## 🔑 Part 3: Service-to-Service Authentication

### 3.1 Verify Signed Request Implementation

The code scaffolding exists in `src/middleware/serviceIdentityMiddleware.ts`. Ensure all internal service calls use it:

```typescript
// Example: API Gateway to Backend Service
import { addServiceIdentityHeader } from '../middleware/serviceIdentityMiddleware';

async function callBackendService(endpoint: string, data: any) {
  const headers = addServiceIdentityHeader({
    'Content-Type': 'application/json',
  });
  
  const response = await fetch(`http://backend-service/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  
  return response.json();
}
```

### 3.2 Enable Verification on All Services

Ensure all internal endpoints verify service identity:

```typescript
// File: src/api/internal.ts
import { Router } from 'express';
import { serviceIdentityMiddleware } from '../middleware/serviceIdentityMiddleware';

const router = Router();

// Apply to ALL internal routes
router.use(serviceIdentityMiddleware);

router.post('/internal/agent/execute', async (req, res) => {
  // Only reachable if service identity is valid
  // req.serviceIdentity contains verified service info
  const { agentId, task } = req.body;
  // ... execute task
});

export default router;
```

### 3.3 Deployment Checklist

- [ ] All service-to-service calls include signed headers (nonce + timestamp)
- [ ] All internal endpoints verify `serviceIdentityMiddleware`
- [ ] Service identity headers include: `X-Service-Identity`, `X-Service-Nonce`, `X-Service-Timestamp`, `X-Service-Signature`
- [ ] Nonce store configured (Redis or in-memory)
- [ ] Clock skew tolerance configured (default: 2 minutes)

---

## 🤖 Part 4: Autonomy Level Configuration

### 4.1 Configure Agent Autonomy Levels

```typescript
// File: src/config/autonomy.ts (update existing)
export const autonomyConfig = {
  agents: {
    CoordinatorAgent: {
      level: 'medium',
      maxCost: 100,        // USD
      maxDuration: 3600,   // 1 hour
      requiresApproval: {
        highCost: true,    // > $100
        destructive: true, // DELETE operations
        dataExport: true,  // Data exports
      },
    },
    
    OpportunityAgent: {
      level: 'high',
      maxCost: 50,
      maxDuration: 1800,
      requiresApproval: {
        highCost: true,    // > $50
        destructive: false,
        dataExport: false,
      },
    },
    
    ValueEvalAgent: {
      level: 'low',
      maxCost: 10,
      maxDuration: 600,
      requiresApproval: {
        highCost: false,
        destructive: true,
        dataExport: true,
      },
    },
  },
  
  global: {
    // Global limits (applies to all agents)
    maxTotalCostPerHour: 500,
    maxConcurrentAgents: 10,
    
    // Actions that ALWAYS require approval
    alwaysRequireApproval: [
      'DELETE_USER',
      'DELETE_CASE',
      'EXPORT_ALL_DATA',
      'MODIFY_BILLING',
      'GRANT_ADMIN_ACCESS',
    ],
  },
};
```

### 4.2 Enforce Autonomy in Agent Execution

```typescript
// File: src/lib/agent-fabric/agents/BaseAgent.ts (add to existing)
import { getAutonomyConfig } from '../../config/autonomy';

export abstract class BaseAgent {
  async execute(task: Task): Promise<Result> {
    const config = getAutonomyConfig();
    const agentConfig = config.agents[this.constructor.name];
    
    // Check if action requires approval
    const requiresApproval = this.checkApprovalRequired(task, agentConfig);
    
    if (requiresApproval) {
      // Queue for human approval
      await this.requestApproval(task);
      throw new Error('Task requires human approval');
    }
    
    // Check cost limits
    if (task.estimatedCost > agentConfig.maxCost) {
      throw new Error(`Task cost (${task.estimatedCost}) exceeds limit (${agentConfig.maxCost})`);
    }
    
    // Proceed with execution
    return super.execute(task);
  }
  
  private checkApprovalRequired(task: Task, config: any): boolean {
    const { global } = getAutonomyConfig();
    
    // Check global always-approve list
    if (global.alwaysRequireApproval.includes(task.action)) {
      return true;
    }
    
    // Check agent-specific rules
    if (config.requiresApproval.destructive && task.isDestructive) {
      return true;
    }
    
    if (config.requiresApproval.highCost && task.estimatedCost > config.maxCost) {
      return true;
    }
    
    if (config.requiresApproval.dataExport && task.involvesDataExport) {
      return true;
    }
    
    return false;
  }
  
  private async requestApproval(task: Task): Promise<void> {
    // Store approval request in database
    await supabase.from('approval_requests').insert({
      agent_id: this.id,
      task_id: task.id,
      action: task.action,
      estimated_cost: task.estimatedCost,
      requested_at: new Date(),
      status: 'pending',
    });
    
    // Notify admins (email, Slack, etc.)
    await this.notifyAdmins(task);
  }
}
```

---

## ✅ Part 5: Approval Gates & Dual Control

### 5.1 UI Approval Flow

```typescript
// File: src/components/ApprovalGate/ApprovalRequest.tsx
import React from 'react';

interface ApprovalRequestProps {
  requestId: string;
  action: string;
  estimatedCost: number;
  agentName: string;
  onApprove: () => void;
  onReject: () => void;
}

export const ApprovalRequest: React.FC<ApprovalRequestProps> = ({
  requestId,
  action,
  estimatedCost,
  agentName,
  onApprove,
  onReject,
}) => {
  const [secondApprover, setSecondApprover] = React.useState('');
  const [requiresDualControl] = React.useState(estimatedCost > 100);
  
  const handleApprove = async () => {
    if (requiresDualControl && !secondApprover) {
      alert('This action requires dual control approval');
      return;
    }
    
    await fetch(`/api/approvals/${requestId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secondApprover }),
    });
    
    onApprove();
  };
  
  return (
    <div className="approval-request">
      <h3>Approval Required</h3>
      <p><strong>Agent:</strong> {agentName}</p>
      <p><strong>Action:</strong> {action}</p>
      <p><strong>Estimated Cost:</strong> ${estimatedCost}</p>
      
      {requiresDualControl && (
        <div>
          <label>Second Approver (required for high-cost actions):</label>
          <input
            type="email"
            value={secondApprover}
            onChange={(e) => setSecondApprover(e.target.value)}
            placeholder="approver@example.com"
          />
        </div>
      )}
      
      <button onClick={handleApprove}>Approve</button>
      <button onClick={onReject}>Reject</button>
    </div>
  );
};
```

### 5.2 Backend Approval Logic

```typescript
// File: src/api/approvals.ts
import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { csrfProtectionMiddleware } from '../middleware/securityMiddleware';

const router = Router();

router.post(
  '/:requestId/approve',
  csrfProtectionMiddleware,
  async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const { secondApprover } = req.body;
    const approverId = (req as any).user.id;
    
    // Get approval request
    const { data: request, error } = await supabase
      .from('approval_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    
    if (error || !request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Check dual control requirement
    const requiresDualControl = request.estimated_cost > 100;
    
    if (requiresDualControl && !secondApprover) {
      return res.status(400).json({
        error: 'Dual control required for high-cost actions',
      });
    }
    
    // Record approval
    await supabase.from('approvals').insert({
      request_id: requestId,
      approver_id: approverId,
      second_approver: secondApprover,
      approved_at: new Date(),
    });
    
    // Update request status
    await supabase
      .from('approval_requests')
      .update({ status: 'approved' })
      .eq('id', requestId);
    
    // Execute the approved task
    await executeApprovedTask(request);
    
    res.json({ success: true });
  }
);

router.post(
  '/:requestId/reject',
  csrfProtectionMiddleware,
  async (req: Request, res: Response) => {
    const { requestId } = req.params;
    const approverId = (req as any).user.id;
    
    await supabase.from('approvals').insert({
      request_id: requestId,
      approver_id: approverId,
      approved_at: new Date(),
      decision: 'rejected',
    });
    
    await supabase
      .from('approval_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId);
    
    res.json({ success: true });
  }
);

export default router;
```

### 5.3 Database Schema for Approvals

```sql
-- File: supabase/migrations/YYYYMMDDHHMMSS_add_approval_system.sql

CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  action TEXT NOT NULL,
  estimated_cost DECIMAL(10, 2),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  requester_id UUID REFERENCES auth.users(id),
  metadata JSONB
);

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES approval_requests(id),
  approver_id UUID REFERENCES auth.users(id),
  second_approver TEXT,
  approved_at TIMESTAMPTZ DEFAULT NOW(),
  decision TEXT CHECK (decision IN ('approved', 'rejected')) DEFAULT 'approved',
  notes TEXT
);

CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX idx_approvals_request ON approvals(request_id);
```

Apply:
```bash
supabase db push
```

---

## ✅ Part 6: Verification Testing

### 6.1 Run Tests

```bash
# Run all tests
npm test

# Run specific Phase 2 tests
npm test -- src/middleware/__tests__/serviceIdentityMiddleware.test.ts
npm test -- src/lib/agent-fabric/__tests__/
npm test -- src/config/__tests__/autonomy.test.ts
```

### 6.2 Manual Verification

#### Test mTLS

```bash
# Verify mTLS is enforced
kubectl exec -it <pod-name> -- curl -v http://api-service:3000/api/health

# Should fail without valid certificate
# Expected: TLS handshake error or 403
```

#### Test Service Identity

```bash
# Attempt internal call without service identity header
curl -X POST http://api-service/internal/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"agentId":"test","task":"test"}'

# Expected: 401 Unauthorized (missing service identity)
```

#### Test Network Policies

```bash
# Try to access database directly from frontend pod
kubectl exec -it frontend-pod -- nc -zv postgres-service 5432

# Expected: Connection refused (NetworkPolicy blocks)
```

#### Test Approval Gates

```bash
# Trigger high-cost action
curl -X POST http://api-service/api/agent/execute \
  -H "Content-Type: application/json" \
  -d '{"action":"EXPENSIVE_OPERATION","estimatedCost":150}'

# Expected: 202 Accepted with approval_request_id
# Check approval_requests table for pending request
```

#### Test Dual Control

```bash
# Approve high-cost action without second approver
curl -X POST http://api-service/api/approvals/{id}/approve \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: 400 Bad Request (dual control required)
```

---

## 📋 Deployment Checklist

Before going to production:

- [ ] SPIFFE/SPIRE deployed and issuing workload identities
- [ ] Istio/service mesh configured with STRICT mTLS
- [ ] Authorization policies applied (default deny, explicit allow)
- [ ] Egress control configured (allowlist external APIs)
- [ ] Kubernetes NetworkPolicies applied (default deny)
- [ ] AWS Security Groups configured (if using AWS)
- [ ] All service-to-service calls use signed requests
- [ ] Service identity middleware applied to all internal endpoints
- [ ] Autonomy levels defined for all agents
- [ ] Approval gate UI implemented
- [ ] Dual control enforced for high-cost/destructive actions
- [ ] Approval database schema deployed
- [ ] Tests passing (`npm test`)
- [ ] Manual verification completed
- [ ] Monitoring/alerts configured for approval requests
- [ ] Documentation updated with approval workflow

---

## 🔗 References

- [SPIFFE/SPIRE Documentation](https://spiffe.io/docs/)
- [Istio Security](https://istio.io/latest/docs/concepts/security/)
- [Kubernetes NetworkPolicies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Zero Trust Architecture](https://www.nist.gov/publications/zero-trust-architecture)
- Project docs: `docs/agent-fabric/AGENT_AUTONOMY_GUIDE.md`

---

**Status:** Manual infrastructure configuration required  
**Owner:** DevOps / Infrastructure / Security Teams  
**Timeline:** Complete before production deployment
