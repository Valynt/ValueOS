/**
 * Expanded Industry Benchmarks - 50 Industries
 * Comprehensive benchmark data for ValueOS ground truth system
 */

export interface IndustryBenchmarkData {
  naics_code: string;
  industry_name: string;
  metrics: {
    revenue_per_employee: { value: number; unit: "USD"; source: string };
    gross_margin?: { value: [number, number]; unit: "percent"; percentile: 50; source: string };
    operating_margin?: { value: [number, number]; unit: "percent"; percentile: 50; source: string };
    [key: string]: any;
  };
  year: number;
  source: string;
}

export const EXPANDED_INDUSTRY_BENCHMARKS: Record<string, IndustryBenchmarkData> = {
  // Technology & Software (10 industries)
  "541511": {
    naics_code: "541511",
    industry_name: "Custom Computer Programming Services",
    year: 2024,
    source: "BLS Economic Census & Industry Analysis",
    metrics: {
      revenue_per_employee: { value: 250000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [45, 65],
        unit: "percent",
        percentile: 50,
        source: "Industry Analysis",
      },
      operating_margin: {
        value: [15, 30],
        unit: "percent",
        percentile: 50,
        source: "Industry Analysis",
      },
    },
  },

  "511210": {
    naics_code: "511210",
    industry_name: "Software Publishers",
    year: 2024,
    source: "SaaS Industry Benchmarks",
    metrics: {
      revenue_per_employee: { value: 400000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [70, 85],
        unit: "percent",
        percentile: 50,
        source: "SaaS Industry Benchmarks",
      },
      cac_payback_months: {
        value: [12, 18],
        unit: "months",
        percentile: 50,
        source: "SaaS Metrics",
      },
    },
  },

  "518210": {
    naics_code: "518210",
    industry_name: "Data Processing, Hosting, and Related Services",
    year: 2024,
    source: "Cloud Industry Benchmarks",
    metrics: {
      revenue_per_employee: { value: 320000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [65, 80],
        unit: "percent",
        percentile: 50,
        source: "Cloud Industry Benchmarks",
      },
      churn_rate: { value: [5, 15], unit: "percent", percentile: 50, source: "SaaS Benchmarks" },
    },
  },

  "541512": {
    naics_code: "541512",
    industry_name: "Computer Systems Design Services",
    year: 2024,
    source: "IT Services Benchmarks",
    metrics: {
      revenue_per_employee: { value: 280000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [40, 60],
        unit: "percent",
        percentile: 50,
        source: "IT Services Benchmarks",
      },
      project_margin: {
        value: [20, 35],
        unit: "percent",
        percentile: 50,
        source: "Consulting Benchmarks",
      },
    },
  },

  "541513": {
    naics_code: "541513",
    industry_name: "Computer Facilities Management Services",
    year: 2024,
    source: "IT Consulting Benchmarks",
    metrics: {
      revenue_per_employee: { value: 220000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [35, 55],
        unit: "percent",
        percentile: 50,
        source: "IT Consulting Benchmarks",
      },
      utilization_rate: {
        value: [70, 85],
        unit: "percent",
        percentile: 50,
        source: "Professional Services Benchmarks",
      },
    },
  },

  "517110": {
    naics_code: "517110",
    industry_name: "Wired Telecommunications Carriers",
    year: 2024,
    source: "Telecom Industry Benchmarks",
    metrics: {
      revenue_per_employee: { value: 350000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [55, 75],
        unit: "percent",
        percentile: 50,
        source: "Telecom Industry Benchmarks",
      },
      capex_intensity: {
        value: [15, 25],
        unit: "percent",
        percentile: 50,
        source: "Telecom Financial Analysis",
      },
    },
  },

  "517311": {
    naics_code: "517311",
    industry_name: "Wired and Wireless Telecommunications",
    year: 2024,
    source: "ISP Industry Benchmarks",
    metrics: {
      revenue_per_employee: { value: 290000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [50, 70],
        unit: "percent",
        percentile: 50,
        source: "ISP Industry Benchmarks",
      },
      arpu: { value: [45, 75], unit: "USD", percentile: 50, source: "Telecom Metrics" },
    },
  },

  "334111": {
    naics_code: "334111",
    industry_name: "Electronic Computer Manufacturing",
    year: 2024,
    source: "Manufacturing Benchmarks",
    metrics: {
      revenue_per_employee: { value: 180000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [25, 45],
        unit: "percent",
        percentile: 50,
        source: "Manufacturing Benchmarks",
      },
      inventory_turnover: {
        value: [8, 15],
        unit: "times",
        percentile: 50,
        source: "Manufacturing Metrics",
      },
    },
  },

  "334413": {
    naics_code: "334413",
    industry_name: "Semiconductor and Related Device Manufacturing",
    year: 2024,
    source: "Semiconductor Benchmarks",
    metrics: {
      revenue_per_employee: { value: 220000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [35, 55],
        unit: "percent",
        percentile: 50,
        source: "Semiconductor Benchmarks",
      },
      rnd_intensity: {
        value: [12, 18],
        unit: "percent",
        percentile: 50,
        source: "Tech R&D Benchmarks",
      },
    },
  },

  "541712": {
    naics_code: "541712",
    industry_name: "Research and Development in the Physical, Engineering, and Life Sciences",
    year: 2024,
    source: "R&D Benchmarks",
    metrics: {
      revenue_per_employee: { value: 195000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: { value: [30, 50], unit: "percent", percentile: 50, source: "R&D Benchmarks" },
      time_to_market: {
        value: [18, 36],
        unit: "months",
        percentile: 50,
        source: "Innovation Metrics",
      },
    },
  },

  // Healthcare & Life Sciences (10 industries)
  "622110": {
    naics_code: "622110",
    industry_name: "General Medical and Surgical Hospitals",
    year: 2024,
    source: "Healthcare Benchmarks",
    metrics: {
      revenue_per_employee: { value: 120000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [2, 8],
        unit: "percent",
        percentile: 50,
        source: "Healthcare Benchmarks",
      },
      patient_satisfaction: {
        value: [75, 90],
        unit: "percent",
        percentile: 50,
        source: "HCAHPS Scores",
      },
    },
  },

  "621111": {
    naics_code: "621111",
    industry_name: "Offices of Physicians",
    year: 2024,
    source: "Medical Practice Benchmarks",
    metrics: {
      revenue_per_employee: { value: 180000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [15, 30],
        unit: "percent",
        percentile: 50,
        source: "Medical Practice Benchmarks",
      },
      patient_volume_per_provider: {
        value: [2500, 3500],
        unit: "patients",
        percentile: 50,
        source: "Medical Practice Metrics",
      },
    },
  },

  "325412": {
    naics_code: "325412",
    industry_name: "Pharmaceutical Preparation Manufacturing",
    year: 2024,
    source: "Pharma Benchmarks",
    metrics: {
      revenue_per_employee: { value: 290000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [60, 80],
        unit: "percent",
        percentile: 50,
        source: "Pharma Benchmarks",
      },
      rnd_intensity: {
        value: [15, 25],
        unit: "percent",
        percentile: 50,
        source: "Pharma R&D Metrics",
      },
    },
  },

  "541714": {
    naics_code: "541714",
    industry_name: "Research and Development in Biotechnology",
    year: 2024,
    source: "Biotech Benchmarks",
    metrics: {
      revenue_per_employee: { value: 210000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [40, 65],
        unit: "percent",
        percentile: 50,
        source: "Biotech Benchmarks",
      },
      funding_success_rate: {
        value: [15, 35],
        unit: "percent",
        percentile: 50,
        source: "Venture Capital Metrics",
      },
    },
  },

  "339112": {
    naics_code: "339112",
    industry_name: "Surgical and Medical Instrument Manufacturing",
    year: 2024,
    source: "Medical Device Benchmarks",
    metrics: {
      revenue_per_employee: { value: 160000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [45, 65],
        unit: "percent",
        percentile: 50,
        source: "Medical Device Benchmarks",
      },
      regulatory_approval_time: {
        value: [12, 24],
        unit: "months",
        percentile: 50,
        source: "FDA Metrics",
      },
    },
  },

  "623110": {
    naics_code: "623110",
    industry_name: "Nursing Care Facilities",
    year: 2024,
    source: "Healthcare Benchmarks",
    metrics: {
      revenue_per_employee: { value: 85000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [5, 15],
        unit: "percent",
        percentile: 50,
        source: "Healthcare Benchmarks",
      },
      occupancy_rate: {
        value: [85, 95],
        unit: "percent",
        percentile: 50,
        source: "Healthcare Operations",
      },
    },
  },

  "621410": {
    naics_code: "621410",
    industry_name: "Family Planning Centers",
    year: 2024,
    source: "Outpatient Benchmarks",
    metrics: {
      revenue_per_employee: { value: 140000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [12, 25],
        unit: "percent",
        percentile: 50,
        source: "Outpatient Benchmarks",
      },
      patient_visits_per_provider: {
        value: [3000, 4500],
        unit: "visits",
        percentile: 50,
        source: "Medical Practice Metrics",
      },
    },
  },

  "621511": {
    naics_code: "621511",
    industry_name: "Medical Laboratories",
    year: 2024,
    source: "Lab Services Benchmarks",
    metrics: {
      revenue_per_employee: { value: 130000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [35, 55],
        unit: "percent",
        percentile: 50,
        source: "Lab Services Benchmarks",
      },
      test_accuracy_rate: {
        value: [98, 99.5],
        unit: "percent",
        percentile: 50,
        source: "Lab Quality Metrics",
      },
    },
  },

  "621210": {
    naics_code: "621210",
    industry_name: "Offices of Dentists",
    year: 2024,
    source: "Dental Practice Benchmarks",
    metrics: {
      revenue_per_employee: { value: 165000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [20, 35],
        unit: "percent",
        percentile: 50,
        source: "Dental Practice Benchmarks",
      },
      patients_per_day: {
        value: [8, 15],
        unit: "patients",
        percentile: 50,
        source: "Dental Operations",
      },
      regulatory_approval_time: {
        value: [12, 24],
        unit: "months",
        percentile: 50,
        source: "FDA Metrics",
      },
    },
  },

  "621610": {
    naics_code: "621610",
    industry_name: "Home Health Care Services",
    year: 2024,
    source: "Home Health Benchmarks",
    metrics: {
      revenue_per_employee: { value: 95000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [8, 18],
        unit: "percent",
        percentile: 50,
        source: "Home Health Benchmarks",
      },
      patient_satisfaction: {
        value: [80, 92],
        unit: "percent",
        percentile: 50,
        source: "Home Health Metrics",
      },
    },
  },

  // Manufacturing & Industrial (10 industries)
  "336111": {
    naics_code: "336111",
    industry_name: "Automobile Manufacturing",
    year: 2024,
    source: "Auto Manufacturing Benchmarks",
    metrics: {
      revenue_per_employee: { value: 180000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [8, 15],
        unit: "percent",
        percentile: 50,
        source: "Auto Manufacturing Benchmarks",
      },
      inventory_turnover: {
        value: [12, 20],
        unit: "times",
        percentile: 50,
        source: "Manufacturing Metrics",
      },
    },
  },

  "336411": {
    naics_code: "336411",
    industry_name: "Aircraft Manufacturing",
    year: 2024,
    source: "Aerospace Benchmarks",
    metrics: {
      revenue_per_employee: { value: 195000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [12, 22],
        unit: "percent",
        percentile: 50,
        source: "Aerospace Benchmarks",
      },
      rnd_intensity: {
        value: [8, 15],
        unit: "percent",
        percentile: 50,
        source: "Aerospace R&D Metrics",
      },
    },
  },

  "325110": {
    naics_code: "325110",
    industry_name: "Petrochemical Manufacturing",
    year: 2024,
    source: "Chemical Manufacturing Benchmarks",
    metrics: {
      revenue_per_employee: { value: 220000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [20, 35],
        unit: "percent",
        percentile: 50,
        source: "Chemical Manufacturing Benchmarks",
      },
      capacity_utilization: {
        value: [75, 90],
        unit: "percent",
        percentile: 50,
        source: "Manufacturing Operations",
      },
    },
  },

  "311111": {
    naics_code: "311111",
    industry_name: "Dog and Cat Food Manufacturing",
    year: 2024,
    source: "Food Processing Benchmarks",
    metrics: {
      revenue_per_employee: { value: 140000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [18, 32],
        unit: "percent",
        percentile: 50,
        source: "Food Processing Benchmarks",
      },
      inventory_turnover: {
        value: [6, 12],
        unit: "times",
        percentile: 50,
        source: "Food Industry Metrics",
      },
    },
  },

  "236115": {
    naics_code: "236115",
    industry_name: "New Single-Family Housing Construction",
    year: 2024,
    source: "Construction Benchmarks",
    metrics: {
      revenue_per_employee: { value: 120000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [12, 25],
        unit: "percent",
        percentile: 50,
        source: "Construction Benchmarks",
      },
      project_completion_time: {
        value: [6, 12],
        unit: "months",
        percentile: 50,
        source: "Construction Metrics",
      },
    },
  },

  "211120": {
    naics_code: "211120",
    industry_name: "Crude Petroleum Extraction",
    year: 2024,
    source: "Oil & Gas Benchmarks",
    metrics: {
      revenue_per_employee: { value: 450000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [25, 45],
        unit: "percent",
        percentile: 50,
        source: "Oil & Gas Benchmarks",
      },
      reserve_replacement_ratio: {
        value: [80, 120],
        unit: "percent",
        percentile: 50,
        source: "Energy Metrics",
      },
    },
  },

  "221112": {
    naics_code: "221112",
    industry_name: "Fossil Fuel Electric Power Generation",
    year: 2024,
    source: "Utility Benchmarks",
    metrics: {
      revenue_per_employee: { value: 280000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [15, 30],
        unit: "percent",
        percentile: 50,
        source: "Utility Benchmarks",
      },
      capacity_factor: {
        value: [40, 65],
        unit: "percent",
        percentile: 50,
        source: "Energy Operations",
      },
    },
  },

  "333131": {
    naics_code: "333131",
    industry_name: "Mining Machinery and Equipment Manufacturing",
    year: 2024,
    source: "Industrial Equipment Benchmarks",
    metrics: {
      revenue_per_employee: { value: 160000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [22, 38],
        unit: "percent",
        percentile: 50,
        source: "Industrial Equipment Benchmarks",
      },
      order_backlog: {
        value: [6, 18],
        unit: "months",
        percentile: 50,
        source: "Manufacturing Metrics",
      },
    },
  },

  "332111": {
    naics_code: "332111",
    industry_name: "Iron and Steel Forging",
    year: 2024,
    source: "Metal Fabrication Benchmarks",
    metrics: {
      revenue_per_employee: { value: 130000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [15, 28],
        unit: "percent",
        percentile: 50,
        source: "Metal Fabrication Benchmarks",
      },
      on_time_delivery: {
        value: [85, 95],
        unit: "percent",
        percentile: 50,
        source: "Manufacturing Quality",
      },
      project_completion_time: {
        value: [6, 12],
        unit: "months",
        percentile: 50,
        source: "Construction Metrics",
      },
    },
  },

  "322110": {
    naics_code: "322110",
    industry_name: "Pulp Mills",
    year: 2024,
    source: "Paper Industry Benchmarks",
    metrics: {
      revenue_per_employee: { value: 170000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [18, 32],
        unit: "percent",
        percentile: 50,
        source: "Paper Industry Benchmarks",
      },
      capacity_utilization: {
        value: [70, 85],
        unit: "percent",
        percentile: 50,
        source: "Manufacturing Operations",
      },
    },
  },

  // Professional Services (10 industries)
  "541611": {
    naics_code: "541611",
    industry_name: "Administrative Management and General Management Consulting Services",
    year: 2024,
    source: "Consulting Benchmarks",
    metrics: {
      revenue_per_employee: { value: 195000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [25, 45],
        unit: "percent",
        percentile: 50,
        source: "Consulting Benchmarks",
      },
      utilization_rate: {
        value: [65, 80],
        unit: "percent",
        percentile: 50,
        source: "Professional Services",
      },
    },
  },

  "541211": {
    naics_code: "541211",
    industry_name: "Offices of Certified Public Accountants",
    year: 2024,
    source: "Accounting Benchmarks",
    metrics: {
      revenue_per_employee: { value: 150000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [30, 50],
        unit: "percent",
        percentile: 50,
        source: "Accounting Benchmarks",
      },
      client_retention_rate: {
        value: [85, 95],
        unit: "percent",
        percentile: 50,
        source: "Professional Services",
      },
    },
  },

  "541110": {
    naics_code: "541110",
    industry_name: "Offices of Lawyers",
    year: 2024,
    source: "Legal Services Benchmarks",
    metrics: {
      revenue_per_employee: { value: 185000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [35, 55],
        unit: "percent",
        percentile: 50,
        source: "Legal Services Benchmarks",
      },
      billable_hours_rate: {
        value: [75, 85],
        unit: "percent",
        percentile: 50,
        source: "Legal Practice Metrics",
      },
    },
  },

  "541330": {
    naics_code: "541330",
    industry_name: "Engineering Services",
    year: 2024,
    source: "Engineering Consulting Benchmarks",
    metrics: {
      revenue_per_employee: { value: 165000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [28, 45],
        unit: "percent",
        percentile: 50,
        source: "Engineering Consulting Benchmarks",
      },
      project_success_rate: {
        value: [85, 95],
        unit: "percent",
        percentile: 50,
        source: "Engineering Metrics",
      },
    },
  },

  "541810": {
    naics_code: "541810",
    industry_name: "Advertising Agencies",
    year: 2024,
    source: "Advertising Benchmarks",
    metrics: {
      revenue_per_employee: { value: 175000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [20, 40],
        unit: "percent",
        percentile: 50,
        source: "Advertising Benchmarks",
      },
      client_retention_rate: {
        value: [75, 90],
        unit: "percent",
        percentile: 50,
        source: "Marketing Services",
      },
    },
  },

  "541310": {
    naics_code: "541310",
    industry_name: "Architectural Services",
    year: 2024,
    source: "Architecture Benchmarks",
    metrics: {
      revenue_per_employee: { value: 125000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [15, 35],
        unit: "percent",
        percentile: 50,
        source: "Architecture Benchmarks",
      },
      project_completion_rate: {
        value: [80, 95],
        unit: "percent",
        percentile: 50,
        source: "Architecture Metrics",
      },
    },
  },

  "531210": {
    naics_code: "531210",
    industry_name: "Offices of Real Estate Agents and Brokers",
    year: 2024,
    source: "Real Estate Benchmarks",
    metrics: {
      revenue_per_employee: { value: 145000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [25, 45],
        unit: "percent",
        percentile: 50,
        source: "Real Estate Benchmarks",
      },
      transaction_closure_rate: {
        value: [60, 80],
        unit: "percent",
        percentile: 50,
        source: "Real Estate Sales",
      },
    },
  },

  "524113": {
    naics_code: "524113",
    industry_name: "Direct Life Insurance Carriers",
    year: 2024,
    source: "Insurance Benchmarks",
    metrics: {
      revenue_per_employee: { value: 320000, unit: "USD", source: "BLS Economic Census" },
      combined_ratio: {
        value: [95, 105],
        unit: "percent",
        percentile: 50,
        source: "Insurance Benchmarks",
      },
      loss_ratio: {
        value: [65, 85],
        unit: "percent",
        percentile: 50,
        source: "Insurance Underwriting",
      },
    },
  },

  "522110": {
    naics_code: "522110",
    industry_name: "Commercial Banking",
    year: 2024,
    source: "Banking Benchmarks",
    metrics: {
      revenue_per_employee: { value: 190000, unit: "USD", source: "BLS Economic Census" },
      net_interest_margin: {
        value: [2.5, 4.5],
        unit: "percent",
        percentile: 50,
        source: "Banking Benchmarks",
      },
      efficiency_ratio: {
        value: [55, 75],
        unit: "percent",
        percentile: 50,
        source: "Bank Operations",
      },
      client_retention_rate: {
        value: [75, 90],
        unit: "percent",
        percentile: 50,
        source: "Marketing Services",
      },
    },
  },

  "523110": {
    naics_code: "523110",
    industry_name: "Investment Banking and Securities Dealing",
    year: 2024,
    source: "Investment Banking Benchmarks",
    metrics: {
      revenue_per_employee: { value: 450000, unit: "USD", source: "BLS Economic Census" },
      return_on_equity: {
        value: [10, 20],
        unit: "percent",
        percentile: 50,
        source: "Investment Banking Benchmarks",
      },
      deal_success_rate: {
        value: [70, 85],
        unit: "percent",
        percentile: 50,
        source: "M&A Metrics",
      },
    },
  },

  // Retail, Hospitality & Other Services (10 industries)
  "452311": {
    naics_code: "452311",
    industry_name: "Warehouse Clubs and Supercenters",
    year: 2024,
    source: "Retail Benchmarks",
    metrics: {
      revenue_per_employee: { value: 135000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [20, 30],
        unit: "percent",
        percentile: 50,
        source: "Retail Benchmarks",
      },
      inventory_turnover: {
        value: [8, 12],
        unit: "times",
        percentile: 50,
        source: "Retail Operations",
      },
    },
  },

  "722511": {
    naics_code: "722511",
    industry_name: "Full-Service Restaurants",
    year: 2024,
    source: "Restaurant Benchmarks",
    metrics: {
      revenue_per_employee: { value: 65000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [15, 25],
        unit: "percent",
        percentile: 50,
        source: "Restaurant Benchmarks",
      },
      table_turnover_time: {
        value: [45, 75],
        unit: "minutes",
        percentile: 50,
        source: "Restaurant Operations",
      },
    },
  },

  "721110": {
    naics_code: "721110",
    industry_name: "Hotels (except Casino Hotels) and Motels",
    year: 2024,
    source: "Hospitality Benchmarks",
    metrics: {
      revenue_per_employee: { value: 85000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [20, 35],
        unit: "percent",
        percentile: 50,
        source: "Hospitality Benchmarks",
      },
      occupancy_rate: {
        value: [65, 85],
        unit: "percent",
        percentile: 50,
        source: "Hotel Operations",
      },
    },
  },

  "484121": {
    naics_code: "484121",
    industry_name: "General Freight Trucking, Long-Distance",
    year: 2024,
    source: "Transportation Benchmarks",
    metrics: {
      revenue_per_employee: { value: 110000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [12, 22],
        unit: "percent",
        percentile: 50,
        source: "Transportation Benchmarks",
      },
      on_time_delivery: {
        value: [90, 98],
        unit: "percent",
        percentile: 50,
        source: "Logistics Metrics",
      },
    },
  },

  "481111": {
    naics_code: "481111",
    industry_name: "Scheduled Passenger Air Transportation",
    year: 2024,
    source: "Airline Benchmarks",
    metrics: {
      revenue_per_employee: { value: 180000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [5, 15],
        unit: "percent",
        percentile: 50,
        source: "Airline Benchmarks",
      },
      load_factor: {
        value: [75, 90],
        unit: "percent",
        percentile: 50,
        source: "Airline Operations",
      },
    },
  },

  "493110": {
    naics_code: "493110",
    industry_name: "General Warehousing and Storage",
    year: 2024,
    source: "Warehousing Benchmarks",
    metrics: {
      revenue_per_employee: { value: 95000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [18, 32],
        unit: "percent",
        percentile: 50,
        source: "Warehousing Benchmarks",
      },
      facility_utilization: {
        value: [70, 85],
        unit: "percent",
        percentile: 50,
        source: "Logistics Operations",
      },
    },
  },

  "562111": {
    naics_code: "562111",
    industry_name: "Solid Waste Collection",
    year: 2024,
    source: "Waste Management Benchmarks",
    metrics: {
      revenue_per_employee: { value: 75000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [25, 40],
        unit: "percent",
        percentile: 50,
        source: "Waste Management Benchmarks",
      },
      service_reliability: {
        value: [95, 99],
        unit: "percent",
        percentile: 50,
        source: "Municipal Services",
      },
    },
  },

  "561612": {
    naics_code: "561612",
    industry_name: "Security Guards and Patrol Services",
    year: 2024,
    source: "Security Services Benchmarks",
    metrics: {
      revenue_per_employee: { value: 55000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [15, 30],
        unit: "percent",
        percentile: 50,
        source: "Security Services Benchmarks",
      },
      incident_prevention_rate: {
        value: [90, 98],
        unit: "percent",
        percentile: 50,
        source: "Security Operations",
      },
    },
  },

  "561720": {
    naics_code: "561720",
    industry_name: "Janitorial Services",
    year: 2024,
    source: "Cleaning Services Benchmarks",
    metrics: {
      revenue_per_employee: { value: 45000, unit: "USD", source: "BLS Economic Census" },
      gross_margin: {
        value: [20, 35],
        unit: "percent",
        percentile: 50,
        source: "Cleaning Services Benchmarks",
      },
      customer_satisfaction: {
        value: [85, 95],
        unit: "percent",
        percentile: 50,
        source: "Service Quality",
      },
    },
  },

  "611110": {
    naics_code: "611110",
    industry_name: "Elementary and Secondary Schools",
    year: 2024,
    source: "Education Benchmarks",
    metrics: {
      revenue_per_employee: { value: 78000, unit: "USD", source: "BLS Economic Census" },
      operating_margin: {
        value: [8, 18],
        unit: "percent",
        percentile: 50,
        source: "Education Benchmarks",
      },
      graduation_rate: {
        value: [85, 95],
        unit: "percent",
        percentile: 50,
        source: "Education Outcomes",
      },
    },
  },
};
