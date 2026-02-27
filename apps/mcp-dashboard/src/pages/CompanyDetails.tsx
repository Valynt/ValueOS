import {
  Building2,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import {
  FinancialLineChart,
  MetricCard,
} from "../components/charts/FinancialCharts";

interface CompanyData {
  cik: string;
  name: string;
  ticker?: string;
  industry?: string;
  sector?: string;
  description?: string;
  website?: string;
  employees?: number;
  revenue?: number;
  marketCap?: number;
  founded?: number;
  headquarters?: string;
}

interface FinancialMetric {
  period: string;
  revenue: number;
  netIncome: number;
  eps: number;
  totalAssets: number;
  totalDebt: number;
}

export default function CompanyDetails() {
  const { cik } = useParams<{ cik: string }>();
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [financials, setFinancials] = useState<FinancialMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "financials" | "analysis"
  >("overview");

  useEffect(() => {
    if (cik) {
      loadCompanyData(cik);
    }
  }, [cik]);

  const loadCompanyData = async (cik: string) => {
    try {
      setIsLoading(true);

      // This would call the MCP API to get company data
      // For now, using mock data
      const mockCompany: CompanyData = {
        cik,
        name: "Apple Inc.",
        ticker: "AAPL",
        industry: "Technology",
        sector: "Consumer Electronics",
        description:
          "Apple Inc. designs, manufactures, and markets smartphones, personal computers, tablets, wearables, and accessories worldwide.",
        website: "https://www.apple.com",
        employees: 164000,
        revenue: 394328000000,
        marketCap: 2800000000000,
        founded: 1976,
        headquarters: "Cupertino, California",
      };

      const mockFinancials: FinancialMetric[] = [
        {
          period: "FY2020",
          revenue: 274515000000,
          netIncome: 57411000000,
          eps: 3.28,
          totalAssets: 323888000000,
          totalDebt: 112436000000,
        },
        {
          period: "FY2021",
          revenue: 365817000000,
          netIncome: 94680000000,
          eps: 5.61,
          totalAssets: 351002000000,
          totalDebt: 124719000000,
        },
        {
          period: "FY2022",
          revenue: 394328000000,
          netIncome: 99803000000,
          eps: 6.11,
          totalAssets: 352755000000,
          totalDebt: 98922000000,
        },
        {
          period: "FY2023",
          revenue: 383285000000,
          netIncome: 96995000000,
          eps: 6.13,
          totalAssets: 365725000000,
          totalDebt: 106550000000,
        },
      ];

      setCompany(mockCompany);
      setFinancials(mockFinancials);
    } catch (error) {
      console.error("Failed to load company data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value?: number) => {
    if (!value) return "N/A";
    return value.toLocaleString();
  };

  const formatLargeNumber = (value?: number) => {
    if (!value) return "N/A";
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    return value.toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Company Not Found
          </h2>
          <p className="text-gray-600">
            Unable to load company data for CIK: {cik}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {company.name}
              </h1>
              {company.ticker && (
                <p className="text-lg text-gray-600">{company.ticker}</p>
              )}
              <p className="text-sm text-gray-500">CIK: {company.cik}</p>
            </div>
          </div>

          <div className="flex space-x-2">
            <button className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              <FileText className="w-4 h-4 mr-2" />
              View SEC Filings
            </button>
            <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
              <TrendingUp className="w-4 h-4 mr-2" />
              Analyze Company
            </button>
          </div>
        </div>

        {company.description && (
          <p className="mt-4 text-gray-600">{company.description}</p>
        )}

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {company.industry && (
            <div>
              <p className="text-sm text-gray-500">Industry</p>
              <p className="font-medium">{company.industry}</p>
            </div>
          )}
          {company.sector && (
            <div>
              <p className="text-sm text-gray-500">Sector</p>
              <p className="font-medium">{company.sector}</p>
            </div>
          )}
          {company.employees && (
            <div>
              <p className="text-sm text-gray-500">Employees</p>
              <p className="font-medium">{formatNumber(company.employees)}</p>
            </div>
          )}
          {company.founded && (
            <div>
              <p className="text-sm text-gray-500">Founded</p>
              <p className="font-medium">{company.founded}</p>
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Market Cap"
          value={formatLargeNumber(company.marketCap)}
          icon={<DollarSign className="w-6 h-6" />}
        />
        <MetricCard
          title="Annual Revenue"
          value={formatLargeNumber(company.revenue)}
          change={{ value: 7.2, type: "increase" }}
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <MetricCard
          title="Employees"
          value={formatNumber(company.employees)}
          icon={<Users className="w-6 h-6" />}
        />
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {(
              [
                {
                  id: "overview" as const,
                  name: "Overview",
                  current: activeTab === "overview",
                },
                {
                  id: "financials" as const,
                  name: "Financials",
                  current: activeTab === "financials",
                },
                {
                  id: "analysis" as const,
                  name: "Analysis",
                  current: activeTab === "analysis",
                },
              ] satisfies Array<{ id: "overview" | "financials" | "analysis"; name: string; current: boolean }>
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  tab.current
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Company Information
                  </h3>
                  <div className="space-y-3">
                    {company.website && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Website</span>
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {company.website}
                        </a>
                      </div>
                    )}
                    {company.headquarters && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Headquarters</span>
                        <span>{company.headquarters}</span>
                      </div>
                    )}
                    {company.founded && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Founded</span>
                        <span>{company.founded}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">Q4 2024 Earnings</p>
                        <p className="text-xs text-gray-500">
                          Reported 2 days ago
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium">10-K Filing</p>
                        <p className="text-xs text-gray-500">
                          Filed 3 weeks ago
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Financials Tab */}
          {activeTab === "financials" && (
            <div className="space-y-6">
              {/* Revenue Chart */}
              <FinancialLineChart
                data={financials.map((f) => ({
                  period: f.period,
                  value: f.revenue,
                }))}
                title="Revenue Trend"
                height={300}
                color="#10B981"
              />

              {/* Financial Metrics Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Period
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Net Income
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        EPS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Assets
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Debt
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {financials.map((metric) => (
                      <tr key={metric.period}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {metric.period}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(metric.revenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(metric.netIncome)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${metric.eps.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(metric.totalAssets)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(metric.totalDebt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Analysis Tab */}
          {activeTab === "analysis" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Quick Actions
                  </h3>
                  <div className="space-y-3">
                    <button className="w-full text-left p-3 bg-white rounded border hover:border-blue-500 transition-colors">
                      <div className="flex items-center space-x-3">
                        <TrendingUp className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-900">
                            Run Sentiment Analysis
                          </p>
                          <p className="text-sm text-gray-600">
                            Analyze recent SEC filings and earnings calls
                          </p>
                        </div>
                      </div>
                    </button>

                    <button className="w-full text-left p-3 bg-white rounded border hover:border-green-500 transition-colors">
                      <div className="flex items-center space-x-3">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        <div>
                          <p className="font-medium text-gray-900">
                            Generate Forecast
                          </p>
                          <p className="text-sm text-gray-600">
                            Predict future financial performance
                          </p>
                        </div>
                      </div>
                    </button>

                    <button className="w-full text-left p-3 bg-white rounded border hover:border-purple-500 transition-colors">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-purple-500" />
                        <div>
                          <p className="font-medium text-gray-900">
                            Business Intelligence Report
                          </p>
                          <p className="text-sm text-gray-600">
                            Comprehensive company analysis
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Key Insights
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-white rounded border-l-4 border-green-500">
                      <p className="text-sm font-medium text-gray-900">
                        Strong Revenue Growth
                      </p>
                      <p className="text-xs text-gray-600">
                        Consistent 15% YoY growth over past 4 years
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded border-l-4 border-blue-500">
                      <p className="text-sm font-medium text-gray-900">
                        High Profit Margins
                      </p>
                      <p className="text-xs text-gray-600">
                        Operating margins above industry average
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded border-l-4 border-yellow-500">
                      <p className="text-sm font-medium text-gray-900">
                        Market Leadership
                      </p>
                      <p className="text-xs text-gray-600">
                        Leading position in consumer technology sector
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
