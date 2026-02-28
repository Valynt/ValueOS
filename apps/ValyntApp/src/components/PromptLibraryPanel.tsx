import React, { useState } from "react";

import { PromptLibraryService, type PromptTemplate } from "../services/PromptLibraryService";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const PromptLibraryPanel: React.FC = () => {
  const [templates] = useState<PromptTemplate[]>(PromptLibraryService.getInstance().getTemplates());
  const [search, setSearch] = useState("");

  const filtered = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.includes(search.toLowerCase()))
  );

  return (
    <Card className="p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span role="img" aria-label="Library">
          📚
        </span>{" "}
        AI Prompt Library
      </h3>

      <Input
        placeholder="Search templates or tags..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />

      <div className="space-y-3">
        {filtered.map((t) => (
          <div
            key={t.id}
            className="p-3 border rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-start mb-1">
              <h4 className="font-medium text-sm">{t.name}</h4>
              <div className="flex gap-1">
                {t.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px] px-1">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
            <Button variant="ghost" size="xs" className="mt-2 h-6 text-[10px]">
              Use Template
            </Button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No templates found.</p>
        )}
      </div>
    </Card>
  );
};
