  await db.insert(simulationScenarios).values({
    title: "ROI Business Case for Enterprise CRM Migration",
    type: "business_case",
    pillarId: 4, // Business Case Development
    difficulty: "advanced",
    targetMaturityLevel: 3,
    vosRole: null,
    description: "Build a comprehensive ROI business case for a Fortune 500 company considering a CRM migration from legacy system to modern platform.",
    scenario: {
      context: "GlobalManufacture Corp (15,000 employees, $5B revenue) is evaluating a CRM migration. Their current system is 12 years old, lacks mobile access, and requires extensive manual data entry. You need to build a compelling business case for the CFO and CIO.",
      customerProfile: {
        company: "GlobalManufacture Corp",
        industry: "Industrial Manufacturing",
        size: "15,000 employees, $5B annual revenue, 2,500 sales reps",
        challenges: [
          "Legacy CRM system with 12-year-old technology",
          "No mobile access for field sales team",
          "Manual data entry consuming 10 hours/week per rep",
          "Poor data quality leading to missed opportunities",
          "Limited integration with ERP and marketing automation"
        ]
      },
      objectives: [
        "Calculate total cost of ownership (TCO) for current vs. new system",
        "Quantify revenue impact from improved sales productivity",
        "Identify cost savings from automation and efficiency gains",
        "Build risk mitigation case for data quality and compliance",
        "Create 3-year ROI projection with conservative assumptions"
      },
      steps: [