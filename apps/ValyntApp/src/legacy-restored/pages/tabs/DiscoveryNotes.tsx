// /workspaces/ValueOS/src/pages/tabs/DiscoveryNotes.tsx
import React, { useState, useEffect } from "react";

interface DiscoveryNotesProps {
  dealId: string;
}

const DiscoveryNotes: React.FC<DiscoveryNotesProps> = ({ dealId }) => {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(`notes-${dealId}`);
    if (stored) setNotes(stored);
  }, [dealId]);

  const handleChange = (value: string) => {
    setNotes(value);
    localStorage.setItem(`notes-${dealId}`, value);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">Discovery Notes</h2>
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Enter discovery notes..."
        className="w-full p-4 border rounded"
        rows={20}
      />
    </div>
  );
};

export default DiscoveryNotes;
