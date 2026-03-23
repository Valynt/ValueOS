export const salesCloudData = {
    root: {
        id: "root",
        title: "Sales Cloud Value",
        description: "Core revenue engine for the global enterprise, focused on Agentic Productivity.",
        impact: 100,
        children: ["growth", "monetization", "durability"]
    },
    growth: {
        id: "growth",
        title: "Growth Engine",
        subtitle: "Net-new + Expansion",
        impact: 80,
        description: "Acquire ICP-fit customers and expand seats/roles across GTM teams.",
        enablers: ["Partner & Channel", "Einstein Prospecting", "Marketing Cloud Sync"],
        efficiencyLevers: ["Guided Setup", "Self-Serve Onboarding", "Automated Lead Qualification"],
        kpi: "Logos/Seats"
    },
    monetization: {
        id: "monetization",
        title: "Monetization",
        subtitle: "ARPU / SKU Mix",
        impact: 65,
        description: "Tier upgrades and add-ons (CPQ, Einstein, revenue intelligence) increase yield.",
        enablers: ["Revenue Cloud", "Add-on Bundles", "AI Pricing Guardrails"],
        efficiencyLevers: ["Product-Led Trials", "Automated Quoting", "Standardized Implementations"],
        kpi: "Uplift"
    },
    durability: {
        id: "durability",
        title: "Durability",
        subtitle: "Retention & NRR",
        impact: 70,
        description: "Deep feature adoption (pipeline, forecasts, automation) drives durable NRR.",
        enablers: ["Customer Success AI", "Adoption Dashboard", "AppExchange Ecosystem"],
        efficiencyLevers: ["Automated Renewals", "In-Product Nudges", "Usage Health Signals"],
        kpi: "GRR/NRR"
    },
    recommendations: [
        "Lock pricing guardrails for Einstein 1 SKU",
        "Launch guided onboarding for SMB segment",
        "Deploy top-3 automation recipes for mid-market",
        "Accelerate connectors for core Data Cloud sources"
    ],
    kpis: {
        labels: ['Growth', 'ARPU', 'Retention'],
        impactScores: [80, 65, 70]
    }
};
