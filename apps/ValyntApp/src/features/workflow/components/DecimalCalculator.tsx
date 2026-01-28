import React, { useState } from "react";
import Decimal from "decimal.js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const DecimalCalculator: React.FC = () => {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = () => {
    setError(null);
    try {
      const decA = new Decimal(a);
      const decB = new Decimal(b);
      const sum = decA.plus(decB);
      setResult(sum.toFixed());
    } catch (e) {
      setError("Invalid input");
      setResult(null);
    }
  };

  return (
    <div className="p-4 border rounded bg-white dark:bg-neutral-900 max-w-xs">
      <h3 className="font-bold mb-2">Decimal.js Calculator</h3>
      <Input
        type="text"
        placeholder="Enter first number"
        value={a}
        onChange={(e) => setA(e.target.value)}
        className="mb-2"
      />
      <Input
        type="text"
        placeholder="Enter second number"
        value={b}
        onChange={(e) => setB(e.target.value)}
        className="mb-2"
      />
      <Button onClick={handleCalculate} className="mb-2 w-full">
        Add
      </Button>
      {result && <div className="text-green-600">Result: {result}</div>}
      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
};
