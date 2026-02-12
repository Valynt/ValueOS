/**
 * ValueDriverLibrary - Sidebar component for adding new value drivers
 *
 * Provides templates and drag-and-drop functionality for adding drivers to the canvas.
 */

import React, { useState } from "react";
import { X, Plus, Calculator, DollarSign, Percent, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ValueDriverTemplate {
  id: string;
  name: string;
  description: string;
  type: "input" | "calculated";
  category: string;
  formula?: string;
  defaultValue: number;
  format: "number" | "currency" | "percentage";
  icon: React.ReactNode;
}

const driverTemplates: ValueDriverTemplate[] = [
  // Input Drivers
  {
    id: "revenue",
    name: "Revenue",
    description: "Total revenue or sales amount",
    type: "input",
    category: "Financial",
    defaultValue: 1000000,
    format: "currency",
    icon: <DollarSign className="w-4 h-4" />,
  },
  {
    id: "cost_of_goods",
    name: "Cost of Goods Sold",
    description: "Direct costs of producing goods/services",
    type: "input",
    category: "Financial",
    defaultValue: 600000,
    format: "currency",
    icon: <DollarSign className="w-4 h-4" />,
  },
  {
    id: "operating_expenses",
    name: "Operating Expenses",
    description: "Day-to-day business operating costs",
    type: "input",
    category: "Financial",
    defaultValue: 200000,
    format: "currency",
    icon: <DollarSign className="w-4 h-4" />,
  },
  {
    id: "customer_count",
    name: "Customer Count",
    description: "Number of customers or users",
    type: "input",
    category: "Operational",
    defaultValue: 10000,
    format: "number",
    icon: <Hash className="w-4 h-4" />,
  },
  {
    id: "conversion_rate",
    name: "Conversion Rate",
    description: "Percentage of visitors who convert",
    type: "input",
    category: "Marketing",
    defaultValue: 0.03,
    format: "percentage",
    icon: <Percent className="w-4 h-4" />,
  },

  // Calculated Drivers
  {
    id: "gross_profit",
    name: "Gross Profit",
    description: "Revenue minus cost of goods sold",
    type: "calculated",
    category: "Financial",
    formula: "=Revenue - Cost_of_Goods_Sold",
    defaultValue: 400000,
    format: "currency",
    icon: <Calculator className="w-4 h-4" />,
  },
  {
    id: "gross_margin",
    name: "Gross Margin",
    description: "Gross profit as percentage of revenue",
    type: "calculated",
    category: "Financial",
    formula: "=Gross_Profit / Revenue",
    defaultValue: 0.4,
    format: "percentage",
    icon: <Percent className="w-4 h-4" />,
  },
  {
    id: "net_profit",
    name: "Net Profit",
    description: "Profit after all expenses",
    type: "calculated",
    category: "Financial",
    formula: "=Gross_Profit - Operating_Expenses",
    defaultValue: 200000,
    format: "currency",
    icon: <Calculator className="w-4 h-4" />,
  },
  {
    id: "profit_margin",
    name: "Profit Margin",
    description: "Net profit as percentage of revenue",
    type: "calculated",
    category: "Financial",
    formula: "=Net_Profit / Revenue",
    defaultValue: 0.2,
    format: "percentage",
    icon: <Percent className="w-4 h-4" />,
  },
  {
    id: "customer_acquisition_cost",
    name: "Customer Acquisition Cost",
    description: "Cost to acquire each customer",
    type: "calculated",
    category: "Marketing",
    formula: "=Operating_Expenses * 0.3 / Customer_Count",
    defaultValue: 60,
    format: "currency",
    icon: <Calculator className="w-4 h-4" />,
  },
];

interface ValueDriverLibraryProps {
  onAddDriver: (driverType: "input" | "calculated", template?: ValueDriverTemplate) => void;
  onClose: () => void;
}

export const ValueDriverLibrary: React.FC<ValueDriverLibraryProps> = ({ onAddDriver, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const categories = ["All", ...Array.from(new Set(driverTemplates.map((t) => t.category)))];

  const filteredTemplates =
    selectedCategory === "All"
      ? driverTemplates
      : driverTemplates.filter((t) => t.category === selectedCategory);

  const inputTemplates = filteredTemplates.filter((t) => t.type === "input");
  const calculatedTemplates = filteredTemplates.filter((t) => t.type === "calculated");

  const handleAddTemplate = (template: ValueDriverTemplate) => {
    onAddDriver(template.type, template);
  };

  const handleAddBlank = (type: "input" | "calculated") => {
    onAddDriver(type);
  };

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Add Value Driver</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Category Filter */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Blank Drivers */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Blank Drivers</h3>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleAddBlank("input")}
              >
                <CardContent className="p-3 text-center">
                  <Hash className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <div className="text-sm font-medium">Input Driver</div>
                  <div className="text-xs text-gray-500">Manual value entry</div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleAddBlank("calculated")}
              >
                <CardContent className="p-3 text-center">
                  <Calculator className="w-6 h-6 mx-auto mb-2 text-green-500" />
                  <div className="text-sm font-medium">Calculated Driver</div>
                  <div className="text-xs text-gray-500">Formula-based</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Input Drivers */}
          {inputTemplates.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Hash className="w-4 h-4 text-blue-500" />
                Input Drivers
              </h3>
              <div className="space-y-2">
                {inputTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleAddTemplate(template)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">{template.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-sm font-medium truncate">{template.name}</div>
                            <Badge variant="secondary" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">{template.description}</div>
                          <div className="text-xs text-gray-400">
                            Default: {formatValue(template.defaultValue, template.format)}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Calculated Drivers */}
          {calculatedTemplates.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-green-500" />
                Calculated Drivers
              </h3>
              <div className="space-y-2">
                {calculatedTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleAddTemplate(template)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">{template.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="text-sm font-medium truncate">{template.name}</div>
                            <Badge variant="secondary" className="text-xs">
                              {template.category}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 mb-2">{template.description}</div>
                          <div className="text-xs text-gray-400 mb-1">
                            Formula: {template.formula}
                          </div>
                          <div className="text-xs text-gray-400">
                            Default: {formatValue(template.defaultValue, template.format)}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// Helper function to format values
const formatValue = (value: number, format: string): string => {
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case "percentage":
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value);
    default:
      return new Intl.NumberFormat("en-US").format(value);
  }
};
