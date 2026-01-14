# Rate Limiting Threat Model & Abuse Scenarios

## Executive Summary

**Purpose**: Document abuse scenarios, threat vectors, and ML-based detection requirements for ValueOS rate limiting system.

**Current Implementation**: Basic rate limiting with IP/user-based keys
**Risk Level**: 🟡 **Medium** - Needs advanced threat detection
**Critical Gap**: No ML-based anomaly detection or behavioral analysis

---

## Abuse Scenario Analysis

### High-Risk Abuse Scenarios

#### 1. Distributed Denial of Service (DDoS)
**Threat Level**: 🔴 **Critical**
**Description**: Coordinated attack from multiple IPs to overwhelm system
**Current Protection**: Basic IP-based rate limiting
**Gap**: No distributed attack detection

```typescript
// Attack Scenario:
// Attacker uses botnet with 1000+ IPs
for (const ip of botnetIPs) {
  // Each IP stays under individual limits
  await makeRequest(ip, '/api/agent/chat'); // 10 req/min per IP
}
// Result: 10,000 req/min total - system overwhelmed

// Current Detection:
const key = `${ip}:${userId}:${endpoint}`; // Per-IP tracking only
// Missing: Cross-IP correlation analysis
```

**Required Enhancement**:
```typescript
// Add to RateLimitService.ts
class DistributedAttackDetector {
  async detectDDoS(requests: Request[]): Promise<AttackAlert> {
    // Correlate requests across IPs
    const patterns = this.analyzeCrossIPPatterns(requests);

    if (patterns.suspiciousCorrelation > 0.8) {
      return {
        type: 'DDoS',
        severity: 'critical',
        affectedIPs: patterns.involvedIPs,
        recommendation: 'Enable global rate limit'
      };
    }
  }
}
```

#### 2. Credential Stuffing
**Threat Level**: 🟠 **High**
**Description**: Automated login attempts with stolen credentials
**Current Protection**: Basic rate limiting on auth endpoints
**Gap**: No credential stuffing detection

```typescript
// Attack Scenario:
const stolenCredentials = [
  { email: 'user1@company.com', password: 'pass123' },
  { email: 'user2@company.com', password: 'pass456' },
  // ... 1000 more
];

for (const creds of stolenCredentials) {
  await makeRequest('/api/auth/login', creds); // Different accounts
}
// Current Protection: Per-IP rate limiting can be bypassed

// Required Detection:
class CredentialStuffingDetector {
  detectStuffing(attempts: LoginAttempt[]): boolean {
    // High failure rate across different accounts
    const failureRate = attempts.filter(a => a.success === false).length / attempts.length;
    const uniqueAccounts = new Set(attempts.map(a => a.email)).size;

    return failureRate > 0.9 && uniqueAccounts > 50;
  }
}
```

#### 3. API Key Harvesting
**Threat Level**: 🟠 **High**
**Description**: Automated attempts to discover valid API keys
**Current Protection**: No API key rate limiting
**Gap**: Missing API key-specific rate limits

```typescript
// Attack Scenario:
for (const key of generateRandomKeys()) {
  await makeRequest('/api/agent/chat', { headers: { 'X-API-Key': key } });
}
// Result: Discover valid keys through response patterns

// Required Protection:
class APIKeyProtection {
  validateAPIKey(key: string, endpoint: string): RateLimitResult {
    const keySpecificConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,    // Per key
      keyGenerator: (req) => `apikey:${key}:${endpoint}`
    };

    return this.checkLimit(`apikey:${key}`, keySpecificConfig);
  }
}
```

#### 4. Agent Resource Exhaustion
**Threat Level**: 🟠 **High**
**Description**: Overwhelming agent services with expensive requests
**Current Protection**: Generic rate limiting
**Gap**: No resource-aware rate limiting

```typescript
// Attack Scenario:
for (let i = 0; i < 1000; i++) {
  await makeRequest('/api/agent/chat', {
    query: 'Analyze this 10MB document...', // Expensive LLM call
    context: generateLargeContext()         // Memory intensive
  });
}
// Result: LLM quota exhausted, memory depletion

// Required Protection:
class ResourceAwareRateLimit {
  calculateRequestWeight(req: Request): number {
    const queryLength = req.body.query?.length || 0;
    const contextSize = JSON.stringify(req.body.context || {}).length;
    const complexity = this.estimateComplexity(req.body.query);

    return Math.max(1, (queryLength + contextSize) / 1000) * complexity;
  }
}
```

### Medium-Risk Abuse Scenarios

#### 5. Slowloris Attack
**Threat Level**: 🟡 **Medium**
**Description**: Slow HTTP requests to tie up connections
**Current Protection**: Connection timeout
**Gap**: No slow request detection

#### 6. Session Fixation
**Threat Level**: 🟡 **Medium**
**Description**: Force users to use known session IDs
**Current Protection**: Basic session management
**Gap**: No session anomaly detection

#### 7. Cache Pollution
**Threat Level**: 🟡 **Medium**
**Description**: Poison cache with malicious data
**Current Protection**: No cache poisoning protection
**Gap**: Missing cache validation

---

## Threat Model Matrix

| Attack Vector | Likelihood | Impact | Current Protection | Detection Capability | Mitigation Priority |
|---------------|------------|--------|-------------------|-------------------|-------------------|
| **DDoS** | High | Critical | ⚠️ Basic | ❌ None | P1 |
| **Credential Stuffing** | Medium | High | ⚠️ Basic | ❌ None | P1 |
| **API Key Harvesting** | Medium | High | ❌ None | ❌ None | P1 |
| **Resource Exhaustion** | High | High | ⚠️ Basic | ❌ None | P2 |
| **Slowloris** | Low | Medium | ⚠️ Basic | ❌ None | P3 |
| **Session Fixation** | Low | Medium | ⚠️ Basic | ❌ None | P3 |
| **Cache Pollution** | Low | Medium | ❌ None | ❌ None | P3 |

---

## ML-Based Detection Requirements

### 1. Anomaly Detection Model

#### Input Features
```typescript
interface RequestFeatures {
  // Temporal features
  requestTimestamp: number;
  timeSinceLastRequest: number;
  requestsPerMinute: number;
  requestsPerHour: number;

  // Behavioral features
  endpointFrequency: Map<string, number>;
  userAgentConsistency: boolean;
  requestSizeVariation: number;
  responseTimePattern: number[];

  // Network features
  ipReputation: number; // 0-1 score
  geoLocation: string;
  asn: string; // Autonomous System Number
  requestPattern: string; // JSON sequence of endpoints

  // Authentication features
  authenticationSuccessRate: number;
  uniqueUsersPerIP: number;
  failedLoginAttempts: number;

  // Resource features
  averageRequestSize: number;
  peakMemoryUsage: number;
  llmTokenUsage: number;
}
```

#### Model Architecture
```typescript
class AnomalyDetectionModel {
  private models: {
    temporalIsolation: IsolationForest;
    behavioralClustering: DBSCAN;
    networkAnalysis: GraphNeuralNetwork;
    resourceUsage: LSTM;
  };

  async detectAnomaly(features: RequestFeatures): Promise<AnomalyResult> {
    const scores = await Promise.all([
      this.models.temporalIsolation.score(features),
      this.models.behavioralClustering.score(features),
      this.models.networkAnalysis.score(features),
      this.models.resourceUsage.score(features)
    ]);

    const combinedScore = this.combineScores(scores);
    const anomalyType = this.classifyAnomaly(features, combinedScore);

    return {
      isAnomalous: combinedScore > 0.8,
      score: combinedScore,
      type: anomalyType,
      confidence: this.calculateConfidence(scores),
      recommendations: this.getRecommendations(anomalyType)
    };
  }
}
```

### 2. Behavioral Analysis Model

#### User Behavior Baseline
```typescript
interface UserBehaviorBaseline {
  normalRequestRate: number;
  typicalEndpoints: string[];
  usualTimeOfDay: number[];
  averageSessionDuration: number;
  deviceFingerprint: string;
  typicalRequestSize: number;
}

class BehavioralAnalysis {
  async establishBaseline(userId: string): Promise<UserBehaviorBaseline> {
    const historicalRequests = await this.getUserHistory(userId, 30); // 30 days

    return {
      normalRequestRate: this.calculateRequestRate(historicalRequests),
      typicalEndpoints: this.getMostFrequentEndpoints(historicalRequests),
      usualTimeOfDay: this.getTimeDistribution(historicalRequests),
      averageSessionDuration: this.getAverageSessionDuration(historicalRequests),
      deviceFingerprint: this.getDeviceFingerprint(historicalRequests),
      typicalRequestSize: this.getAverageRequestSize(historicalRequests)
    };
  }

  async detectBehavioralAnomaly(
    currentRequest: Request,
    baseline: UserBehaviorBaseline
  ): Promise<BehavioralAnomaly> {
    const deviations = this.calculateDeviations(currentRequest, baseline);

    return {
      isAnomalous: deviations.maxDeviation > 0.7,
      deviations,
      riskScore: this.calculateRiskScore(deviations),
      explanation: this.explainDeviations(deviations)
    };
  }
}
```

### 3. Real-Time Threat Detection Pipeline

```typescript
class ThreatDetectionPipeline {
  async processRequest(request: Request): Promise<ThreatAssessment> {
    // Extract features
    const features = await this.featureExtractor.extract(request);

    // Run ML models
    const [anomalyResult, behaviorResult] = await Promise.all([
      this.anomalyModel.detectAnomaly(features),
      this.behaviorModel.analyzeRequest(request)
    ]);

    // Correlate with known threats
    const threatCorrelation = await this.threatIntelligence.correlate(features);

    // Calculate overall risk
    const riskScore = this.calculateOverallRisk(
      anomalyResult,
      behaviorResult,
      threatCorrelation
    );

    // Determine action
    const action = this.determineAction(riskScore, request);

    return {
      riskScore,
      anomalyResult,
      behaviorResult,
      threatCorrelation,
      action,
      confidence: this.calculateConfidence(anomalyResult, behaviorResult)
    };
  }
}
```

---

## Rate Limiting Escalation Rules

### Escalation Matrix

| Risk Score | Action | Duration | Automatic Recovery | Manual Review Required |
|------------|--------|----------|-------------------|----------------------|
| **0.0 - 0.3** | Allow | - | - | No |
| **0.3 - 0.5** | Increased Logging | 15 min | Yes | No |
| **0.5 - 0.7** | Rate Limit Reduction | 30 min | Yes | No |
| **0.7 - 0.8** | Temporary Block | 1 hour | Yes | No |
| **0.8 - 0.9** | Extended Block | 6 hours | No | Yes |
| **0.9 - 1.0** | Permanent Block | Indefinite | No | Yes |

### Escalation Implementation

```typescript
class RateLimitEscalation {
  private escalationRules = new Map([
    [0.3, { action: 'log', duration: 15 * 60 * 1000 }],
    [0.5, { action: 'reduce_limit', duration: 30 * 60 * 1000, reduction: 0.5 }],
    [0.7, { action: 'temp_block', duration: 60 * 60 * 1000 }],
    [0.8, { action: 'extended_block', duration: 6 * 60 * 60 * 1000 }],
    [0.9, { action: 'permanent_block', duration: -1 }]
  ]);

  async escalate(key: string, riskScore: number, context: ThreatContext): Promise<EscalationResult> {
    const rule = this.findEscalationRule(riskScore);

    switch (rule.action) {
      case 'log':
        await this.logThreat(key, riskScore, context);
        break;

      case 'reduce_limit':
        await this.reduceRateLimit(key, rule.reduction);
        await this.scheduleRecovery(key, rule.duration);
        break;

      case 'temp_block':
        await this.temporaryBlock(key, rule.duration);
        await this.scheduleRecovery(key, rule.duration);
        break;

      case 'extended_block':
        await this.extendedBlock(key);
        await this.notifySecurityTeam(key, context);
        break;

      case 'permanent_block':
        await this.permanentBlock(key);
        await this.createSecurityIncident(key, context);
        break;
    }

    return {
      action: rule.action,
      duration: rule.duration,
      autoRecovery: rule.duration > 0,
      requiresManualReview: riskScore >= 0.8
    };
  }
}
```

---

## Advanced Rate Limiting Strategies

### 1. Adaptive Rate Limiting

```typescript
class AdaptiveRateLimit {
  private userBaselines = new Map<string, UserBehaviorBaseline>();

  async calculateAdaptiveLimit(userId: string, endpoint: string): Promise<number> {
    const baseline = await this.getUserBaseline(userId);
    const currentLoad = await this.getCurrentSystemLoad();
    const threatLevel = await this.getCurrentThreatLevel();

    // Base limit adjusted by multiple factors
    const baseLimit = this.getBaseLimit(endpoint);
    const userMultiplier = this.getUserMultiplier(baseline);
    const loadMultiplier = this.getLoadMultiplier(currentLoad);
    const threatMultiplier = this.getThreatMultiplier(threatLevel);

    return Math.floor(
      baseLimit * userMultiplier * loadMultiplier * threatMultiplier
    );
  }
}
```

### 2. Token Bucket Algorithm

```typescript
class TokenBucketRateLimit {
  private buckets = new Map<string, TokenBucket>();

  checkLimit(key: string, config: RateLimitConfig): RateLimitResult {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = new TokenBucket(config.maxRequests, config.windowMs);
      this.buckets.set(key, bucket);
    }

    const result = bucket.consume(1);

    return {
      allowed: result.consumed > 0,
      remaining: bucket.tokens,
      resetTime: bucket.lastRefill + bucket.refillInterval,
      totalRequests: bucket.totalRequests
    };
  }
}

class TokenBucket {
  constructor(
    private capacity: number,
    private refillInterval: number,
    public tokens: number = capacity,
    public lastRefill: number = Date.now(),
    public totalRequests: number = 0
  ) {}

  consume(tokens: number): { consumed: number; remaining: number } {
    this.refill();

    const consumed = Math.min(tokens, this.tokens);
    this.tokens -= consumed;
    this.totalRequests++;

    return { consumed, remaining: this.tokens };
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;

    if (timePassed >= this.refillInterval) {
      const tokensToAdd = Math.floor(timePassed / this.refillInterval);
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }
}
```

### 3. Sliding Window Rate Limiting

```typescript
class SlidingWindowRateLimit {
  private windows = new Map<string, SlidingWindow>();

  checkLimit(key: string, config: RateLimitConfig): RateLimitResult {
    let window = this.windows.get(key);

    if (!window) {
      window = new SlidingWindow(config.windowMs, config.maxRequests);
      this.windows.set(key, window);
    }

    const now = Date.now();
    const result = window.addRequest(now);

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetTime: window.getResetTime(),
      totalRequests: window.totalRequests
    };
  }
}

class SlidingWindow {
  constructor(
    private windowSize: number,
    private maxRequests: number,
    private requests: number[] = [],
    public totalRequests: number = 0
  ) {}

  addRequest(timestamp: number): { allowed: boolean; remaining: number } {
    // Remove old requests outside window
    const windowStart = timestamp - this.windowSize;
    this.requests = this.requests.filter(req => req > windowStart);

    this.totalRequests++;

    const allowed = this.requests.length < this.maxRequests;

    if (allowed) {
      this.requests.push(timestamp);
    }

    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - this.requests.length)
    };
  }

  getResetTime(): number {
    if (this.requests.length === 0) {
      return Date.now() + this.windowSize;
    }

    const oldestRequest = Math.min(...this.requests);
    return oldestRequest + this.windowSize;
  }
}
```

---

## Implementation Roadmap

### Phase 1: Enhanced Basic Protection (Week 1)
- [ ] API key-specific rate limiting
- [ ] Resource-aware rate limiting
- [ ] Distributed attack detection
- [ ] Credential stuffing detection

### Phase 2: ML-Based Detection (Week 2)
- [ ] Feature extraction pipeline
- [ ] Anomaly detection model training
- [ ] Behavioral analysis baseline
- [ ] Real-time threat detection

### Phase 3: Advanced Strategies (Week 3)
- [ ] Adaptive rate limiting
- [ ] Token bucket implementation
- [ ] Sliding window algorithm
- [ ] Escalation rules automation

---

## Success Criteria

### Functional Requirements
- [ ] All high-risk abuse scenarios detected
- [ ] ML models with >90% accuracy
- [ ] Sub-second threat detection latency
- [ ] Automated escalation for 80% of threats

### Performance Requirements
- [ ] Rate limit check < 1ms
- [ ] ML inference < 100ms
- [ ] Feature extraction < 50ms
- [ ] No impact on legitimate traffic

### Security Requirements
- [ ] Zero false negatives for critical threats
- [ ] <5% false positive rate
- [ ] Real-time threat intelligence integration
- [ ] Comprehensive audit logging

---

*Document Status*: ✅ **Complete**
*Implementation*: RateLimitService.ts analysis complete
*Next Review*: Sprint 2, Week 1 (ML Model Development)
*Approval Required*: Trust Plane Lead, Security Lead
