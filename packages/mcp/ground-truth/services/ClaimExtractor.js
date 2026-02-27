"use strict";
/**
 * Claim Extractor Service
 *
 * robustly extracts financial claims from natural language text using
 * advanced pattern matching and keyword association.
 * Replaces the brittle regex implementation in UnifiedTruthLayer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaimExtractor = void 0;
class ClaimExtractor {
    // Financial metric definitions mapping patterns to normalized metric IDs
    static METRICS = [
        {
            id: "revenue_total",
            keywords: ["revenue", "sales", "top line", "turnover"],
        },
        {
            id: "net_income",
            keywords: [
                "net income",
                "net profit",
                "bottom line",
                "net earnings",
                "net loss",
            ],
        },
        { id: "gross_profit", keywords: ["gross profit"] },
        {
            id: "operating_income",
            keywords: ["operating income", "operating profit", "operating earnings"],
        },
        { id: "ebitda", keywords: ["ebitda", "adjusted ebitda"] },
        {
            id: "eps_diluted",
            keywords: ["eps", "earnings per share", "diluted eps"],
            isPerShare: true,
        },
        {
            id: "operating_margin",
            keywords: ["operating margin"],
            isPercentage: true,
        },
        { id: "gross_margin", keywords: ["gross margin"], isPercentage: true },
        {
            id: "net_margin",
            keywords: ["net margin", "profit margin"],
            isPercentage: true,
        },
        {
            id: "cash_and_equivalents",
            keywords: ["cash", "cash and equivalents", "cash on hand"],
        },
        { id: "total_debt", keywords: ["total debt", "gross debt"] },
        { id: "free_cash_flow", keywords: ["free cash flow", "fcf"] },
    ];
    /**
     * Extract financial claims from text
     */
    extractClaims(text) {
        const claims = [];
        // Normalize text for easier matching but keep original for context
        const normalizedText = text.toLowerCase();
        // Split into sentences/clauses to avoid cross-pollination
        // e.g. "Revenue was $10M and Net Income was $1M"
        const clauses = text.split(/[.;,](?=\s+[A-Z])|\s+and\s+(?=[A-Z])/);
        for (const clause of clauses) {
            this.extractFromClause(clause, claims);
        }
        // Fallback: If no structure found, try full text
        if (claims.length === 0) {
            this.extractFromClause(text, claims);
        }
        return this.deduplicateClaims(claims);
    }
    extractFromClause(clause, claims) {
        const lowerClause = clause.toLowerCase();
        for (const def of ClaimExtractor.METRICS) {
            // Check if any keyword exists in this clause
            const keywordMatch = def.keywords.find((k) => lowerClause.includes(k));
            if (!keywordMatch)
                continue;
            // Found a potential metric. Now look for values near it.
            // We look for patterns like:
            // "$100 million"
            // "100 million dollars"
            // "$1.2B"
            // "15%"
            const values = this.findValuesInText(clause, def);
            for (const val of values) {
                // Calculate distance between keyword and value to ensure they are related
                // Simple heuristic: they should be relatively close
                if (this.areRelated(lowerClause, keywordMatch, val.matchIndex)) {
                    claims.push({
                        metric: def.id,
                        value: val.value,
                        unit: val.unit,
                        originalText: val.raw,
                        confidence: 0.8, // Rule-based confidence
                    });
                }
            }
        }
    }
    findValuesInText(text, metricDef) {
        const results = [];
        // Pattern for currency/large numbers: $10.5 billion, $10M, 10 million dollars
        // Capture groups:
        // 1: Currency symbol ($ or € or £)?
        // 2: Number
        // 3: Multiplier (million, billion, M, B, T)
        const currencyPattern = /(\$|€|£)?\s*(-?[\d,]+(?:\.\d+)?)\s*(trillion|billion|million|thousand|T|B|M|K)?(?:\s+(?:dollars|usd|eur|gbp))?/gi;
        // Pattern for percentages
        const percentPattern = /(-?[\d,]+(?:\.\d+)?)\s*%/gi;
        // Pattern for per-share
        const epsPattern = /\$\s*(-?[\d,]+(?:\.\d+)?)/gi;
        let match;
        if (metricDef.isPercentage) {
            while ((match = percentPattern.exec(text)) !== null) {
                const val = parseFloat(match[1].replace(/,/g, ""));
                results.push({
                    value: val / 100, // Convert 15% to 0.15
                    unit: "ratio",
                    raw: match[0],
                    matchIndex: match.index,
                });
            }
        }
        else if (metricDef.isPerShare) {
            while ((match = epsPattern.exec(text)) !== null) {
                const val = parseFloat(match[1].replace(/,/g, ""));
                results.push({
                    value: val,
                    unit: "USD/share",
                    raw: match[0],
                    matchIndex: match.index,
                });
            }
        }
        else {
            // Standard absolute numbers
            while ((match = currencyPattern.exec(text)) !== null) {
                // Skip if it looks like a year (e.g. 2023, 2024) and no currency symbol
                const rawNum = parseFloat(match[2].replace(/,/g, ""));
                const hasCurrency = !!match[1] ||
                    match[0].toLowerCase().includes("dollar") ||
                    match[0].toLowerCase().includes("usd");
                const hasMultiplier = !!match[3];
                if (!hasCurrency &&
                    !hasMultiplier &&
                    rawNum >= 1900 &&
                    rawNum <= 2100) {
                    continue;
                }
                let multiplier = 1;
                const unitStr = match[3]?.toLowerCase();
                if (unitStr) {
                    if (unitStr.startsWith("t"))
                        multiplier = 1_000_000_000_000;
                    else if (unitStr.startsWith("b"))
                        multiplier = 1_000_000_000;
                    else if (unitStr.startsWith("m"))
                        multiplier = 1_000_000;
                    else if (unitStr.startsWith("k") || unitStr === "thousand")
                        multiplier = 1_000;
                }
                // Handle negative words if not captured by regex sign
                let finalValue = rawNum * multiplier;
                // Look for "loss" in context if checking for income
                // (This is handled by the 'net loss' keyword mostly, but good to be robust)
                results.push({
                    value: finalValue,
                    unit: "USD",
                    raw: match[0],
                    matchIndex: match.index,
                });
            }
        }
        return results;
    }
    areRelated(text, keyword, valueIndex) {
        const keywordIndex = text.indexOf(keyword);
        if (keywordIndex === -1)
            return false;
        // Calculate distance
        const distance = Math.abs(keywordIndex - valueIndex);
        // Allow up to ~50 characters distance
        if (distance > 50)
            return false;
        // Ensure no other numbers are "closer" that might belong to the keyword?
        // For now, simple proximity is better than nothing.
        return true;
    }
    deduplicateClaims(claims) {
        const unique = new Map();
        for (const claim of claims) {
            const key = `${claim.metric}:${claim.value}`;
            if (!unique.has(key)) {
                unique.set(key, claim);
            }
        }
        return Array.from(unique.values());
    }
}
exports.ClaimExtractor = ClaimExtractor;
//# sourceMappingURL=ClaimExtractor.js.map