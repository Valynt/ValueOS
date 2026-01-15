import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Building2, TrendingUp, Users, DollarSign } from "lucide-react";
import { MetricCard } from "../components/charts/FinancialCharts";

interface Company {
  cik: string;
  name: string;
  ticker?: string;
  industry?: string;
  marketCap?: number;
  revenue?: number;
  employees?: number;
}

export default function CompanySearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<Company[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Load recent searches from localStorage
    const saved = localStorage.getItem("recentCompanySearches");
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    try {
      // This would call the MCP API to search for companies
      // For now, using mock data
      const mockResults: Company[] = [
        {
          cik: "0000320193",
          name: "Apple Inc.",
          ticker: "AAPL",
          industry: "Technology",
          marketCap: 2800000000000,
          revenue: 394000000000,
          employees: 164000,
        },
        {
          cik: "0001018724",
          name: "Amazon.com, Inc.",
          ticker: "AMZN",
          industry: "Retail",
          marketCap: 1500000000000,
          revenue: 574000000000,
          employees: 1525000,
        },
        {
          cik: "0000789019",
          name: "Microsoft Corporation",
          ticker: "MSFT",
          industry: "Technology",
          marketCap: 2500000000000,
          revenue: 211000000000,
          employees: 221000,
        },
      ].filter(
        (company) =>
          company.name.toLowerCase().includes(query.toLowerCase()) ||
          company.ticker?.toLowerCase().includes(query.toLowerCase()) ||
          company.cik.includes(query)
      );

      setSearchResults(mockResults);

      // Add to recent searches only if results exist
      if (mockResults.length > 0) {
        const updatedRecent = [
          mockResults[0],
          ...recentSearches.filter((c) => c.cik !== mockResults[0].cik),
        ].slice(0, 5);
        setRecentSearches(updatedRecent);
        localStorage.setItem(
          "recentCompanySearches",
          JSON.stringify(updatedRecent)
        );
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySelect = (company: Company) => {
    navigate(`/companies/${company.cik}`);
  };

  const formatCurrency = (value?: number) => {
    if (!value) return "N/A";
    return `$${(value / 1000000000).toFixed(1)}B`;
  };

  const formatNumber = (value?: number) => {
    if (!value) return "N/A";
    return value.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Company Search</h1>
        <p className="text-gray-600">
          Search and analyze public companies using SEC data
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="max-w-2xl">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search by company name, ticker, or CIK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleSearch(searchQuery);
                }
              }}
            />
          </div>
          <button
            onClick={() => handleSearch(searchQuery)}
            disabled={isLoading || !searchQuery.trim()}
            className="mt-3 w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Searching..." : "Search Companies"}
          </button>
        </div>
      </div>

      {/* Recent Searches */}
      {recentSearches.length > 0 && searchResults.length === 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Searches
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentSearches.map((company) => (
              <div
                key={company.cik}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                onClick={() => handleCompanySelect(company)}
              >
                <div className="flex items-center space-x-3">
                  <Building2 className="w-8 h-8 text-blue-500" />
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {company.name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {company.ticker} • CIK: {company.cik}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Search Results ({searchResults.length})
          </h3>

          <div className="space-y-4">
            {searchResults.map((company) => (
              <div
                key={company.cik}
                className="border border-gray-200 rounded-lg p-6 hover:border-blue-500 cursor-pointer transition-colors"
                onClick={() => handleCompanySelect(company)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <Building2 className="w-6 h-6 text-blue-500" />
                      <h4 className="text-lg font-semibold text-gray-900">
                        {company.name}
                      </h4>
                      {company.ticker && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {company.ticker}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-600">CIK</p>
                        <p className="font-medium">{company.cik}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Industry</p>
                        <p className="font-medium">
                          {company.industry || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Market Cap</p>
                        <p className="font-medium">
                          {formatCurrency(company.marketCap)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Employees</p>
                        <p className="font-medium">
                          {formatNumber(company.employees)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-4">
                    <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!isLoading && searchQuery && searchResults.length === 0 && (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No companies found
          </h3>
          <p className="text-gray-600">
            Try searching with a different company name, ticker symbol, or CIK
            number.
          </p>
        </div>
      )}

      {/* Popular Companies */}
      {searchResults.length === 0 && !searchQuery && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Popular Companies
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { cik: "0000320193", name: "Apple Inc.", ticker: "AAPL" },
              {
                cik: "0000789019",
                name: "Microsoft Corporation",
                ticker: "MSFT",
              },
              { cik: "0001018724", name: "Amazon.com, Inc.", ticker: "AMZN" },
              { cik: "0001652044", name: "Alphabet Inc.", ticker: "GOOGL" },
              { cik: "0001318605", name: "Tesla, Inc.", ticker: "TSLA" },
              { cik: "0000320187", name: "NVIDIA Corporation", ticker: "NVDA" },
            ].map((company) => (
              <div
                key={company.cik}
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
                onClick={() => navigate(`/companies/${company.cik}`)}
              >
                <div className="flex items-center space-x-3">
                  <Building2 className="w-8 h-8 text-blue-500" />
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {company.name}
                    </h4>
                    <p className="text-sm text-gray-600">{company.ticker}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
