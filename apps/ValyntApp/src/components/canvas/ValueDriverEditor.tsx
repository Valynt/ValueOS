/**
 * ValueDriverEditor - Formula editor with Monaco integration
 *
 * Provides syntax highlighting, autocomplete, and validation for value driver formulas.
 */

import React, { useState, useEffect, useRef } from "react";
import { X, Check, AlertCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { calculationEngine } from "@/services/CalculationEngine";
import useValueCanvasStore from "@/stores/valueCanvasStore";

interface ValueDriverEditorProps {
  nodeId: string;
  initialFormula: string;
  onSave: (formula: string) => void;
  onClose: () => void;
}

export const ValueDriverEditor: React.FC<ValueDriverEditorProps> = ({
  nodeId,
  initialFormula,
  onSave,
  onClose,
}) => {
  const [formula, setFormula] = useState(initialFormula);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    error?: string;
    suggestions?: string[];
  }>({ isValid: true });
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewValue, setPreviewValue] = useState<number | null>(null);

  const { driverDefinitions, driverValues } = useValueCanvasStore();

  // Monaco Editor ref
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  // Load Monaco Editor dynamically
  useEffect(() => {
    let isMounted = true;

    const loadMonaco = async () => {
      try {
        const { default: MonacoEditor } = await import("@monaco-editor/react");

        if (isMounted) {
          // Monaco will be loaded when the component mounts
        }
      } catch (error) {
        console.error("Failed to load Monaco Editor:", error);
      }
    };

    loadMonaco();

    return () => {
      isMounted = false;
    };
  }, []);

  // Validate formula on change
  useEffect(() => {
    if (!formula.trim()) {
      setValidationResult({ isValid: true });
      setPreviewValue(null);
      return;
    }

    try {
      const result = calculationEngine.validateFormula(formula);

      if (result.isValid) {
        // Try to calculate preview value
        try {
          const preview = calculationEngine.calculatePreview(formula);
          setPreviewValue(preview);
        } catch {
          setPreviewValue(null);
        }
      } else {
        setPreviewValue(null);
      }

      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        isValid: false,
        error: "Formula validation failed",
      });
      setPreviewValue(null);
    }
  }, [formula]);

  // Monaco Editor setup
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Configure Monaco for formula editing
    monaco.languages.setMonarchTokensProvider("formula", {
      tokenizer: {
        root: [
          // Functions
          [/[A-Z_][A-Z0-9_]*/, "function"],
          // Numbers
          [/\d*\.\d+|\d+/, "number"],
          // Operators
          [/[\+\-\*\/=<>!&|]/, "operator"],
          // Cell references (like A1, B2)
          [/[A-Z]+\d+/, "variable"],
          // Named ranges (our node IDs)
          [/[a-zA-Z_][a-zA-Z0-9_]*/, "variable"],
          // Parentheses
          [/[()]/, "delimiter"],
          // Strings
          [/"([^"\\]|\\.)*$/, "string.invalid"],
          [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],
        ],
        string: [
          [/[^\\"]+/, "string"],
          [/\\./, "string.escape"],
          [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
        ],
      },
    });

    // Set language
    monaco.editor.setModelLanguage(editor.getModel(), "formula");

    // Configure autocomplete
    monaco.languages.registerCompletionItemProvider("formula", {
      provideCompletionItems: (model: any, position: any) => {
        const suggestions = getFormulaSuggestions();
        return { suggestions };
      },
    });

    // Configure hover provider for help
    monaco.languages.registerHoverProvider("formula", {
      provideHover: (model: any, position: any) => {
        const word = model.getWordAtPosition(position);
        if (word) {
          const help = getFunctionHelp(word.word);
          if (help) {
            return {
              contents: [
                { value: `**${word.word}**` },
                { value: help.description },
                { value: `*Example: ${help.example}*` },
              ],
            };
          }
        }
        return null;
      },
    });
  };

  // Get available variables for autocomplete
  const getFormulaSuggestions = () => {
    const suggestions = [];

    // Add other driver names as variables
    Object.entries(driverDefinitions).forEach(([id, def]) => {
      if (id !== nodeId) {
        suggestions.push({
          label: def.label || id,
          kind: monacoRef.current?.languages.CompletionItemKind.Variable,
          insertText: def.label || id,
          detail: "Value Driver",
        });
      }
    });

    // Add common Excel functions
    const functions = [
      "SUM",
      "AVERAGE",
      "MIN",
      "MAX",
      "COUNT",
      "IF",
      "AND",
      "OR",
      "NOT",
      "ROUND",
      "ROUNDUP",
      "ROUNDDOWN",
      "ABS",
      "SQRT",
      "POWER",
    ];

    functions.forEach((func) => {
      const help = getFunctionHelp(func);
      suggestions.push({
        label: func,
        kind: monacoRef.current?.languages.CompletionItemKind.Function,
        insertText: `${func}()`,
        detail: help?.description || "Excel function",
      });
    });

    return suggestions;
  };

  // Get help for functions
  const getFunctionHelp = (funcName: string) => {
    const helpMap: Record<string, { description: string; example: string }> = {
      SUM: {
        description: "Returns the sum of a series of numbers",
        example: "SUM(A1:A10)",
      },
      AVERAGE: {
        description: "Returns the average of a series of numbers",
        example: "AVERAGE(A1:A10)",
      },
      IF: {
        description: "Returns one value if a condition is true, another if false",
        example: 'IF(A1 > 10, "High", "Low")',
      },
      ROUND: {
        description: "Rounds a number to a specified number of digits",
        example: "ROUND(A1, 2)",
      },
    };

    return helpMap[funcName.toUpperCase()];
  };

  const handleSave = () => {
    if (validationResult.isValid) {
      onSave(formula);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const currentDriver = driverDefinitions[nodeId];
  const currentValue = driverValues[nodeId];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Edit Formula
              {currentDriver?.label && <Badge variant="outline">{currentDriver.label}</Badge>}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0">
          {/* Current Value Display */}
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">Current Value</div>
            <div className="text-lg font-mono">
              {currentValue !== undefined
                ? formatValue(currentValue, currentDriver?.format || "number")
                : "No value"}
            </div>
          </div>

          {/* Formula Editor */}
          <div className="flex-1 flex flex-col min-h-0 mb-4">
            <div className="text-sm font-medium mb-2">Formula</div>
            <div className="flex-1 border rounded-lg overflow-hidden">
              <MonacoEditor
                height="100%"
                language="formula"
                value={formula}
                onChange={(value) => setFormula(value || "")}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "off",
                  folding: false,
                  lineDecorationsWidth: 0,
                  wordWrap: "on",
                  automaticLayout: true,
                  suggestOnTriggerCharacters: true,
                  quickSuggestions: true,
                  parameterHints: { enabled: true },
                  hover: { enabled: true },
                }}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          {/* Preview */}
          {previewValue !== null && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-600 mb-1">Preview Result</div>
              <div className="text-lg font-mono text-blue-800">
                {formatValue(previewValue, currentDriver?.format || "number")}
              </div>
            </div>
          )}

          {/* Validation */}
          {!validationResult.isValid && (
            <Alert className="mb-4" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {validationResult.error}
                {validationResult.suggestions && validationResult.suggestions.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium">Suggestions:</div>
                    <ul className="text-sm list-disc list-inside mt-1">
                      {validationResult.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Help */}
          <div className="mb-4">
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm">
                  <strong>Tips:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Use driver names as variables (e.g., Revenue, Cost_of_Goods_Sold)</li>
                    <li>Start formulas with = for Excel compatibility</li>
                    <li>Press Ctrl+Enter to save, Escape to cancel</li>
                    <li>Hover over functions for help and examples</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </div>

          <Separator className="my-4" />

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!validationResult.isValid}>
              <Check className="w-4 h-4 mr-1" />
              Save Formula
            </Button>
          </div>
        </CardContent>
      </Card>
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

// Monaco Editor component (lazy loaded)
const MonacoEditor = React.lazy(() =>
  import("@monaco-editor/react").then((module) => ({ default: module.default }))
);
