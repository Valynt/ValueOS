export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  tags: string[];
}

export class PromptLibraryService {
  private static instance: PromptLibraryService;
  private templates: PromptTemplate[] = [
    {
      id: "industry-deep-dive",
      name: "Industry Pain Point Deep Dive",
      description: "Extract industry-specific pain points from discovery notes.",
      template:
        "Analyze the following discovery notes for {{industry}} and identify the top 3 financial pain points: {{notes}}",
      tags: ["discovery", "industry"],
    },
    {
      id: "cfo-summary",
      name: "CFO Executive Summary",
      description: "Generate a high-level ROI summary for a CFO persona.",
      template:
        "Summarize the ROI case for a CFO, focusing on NPV, IRR, and payback period: {{modelData}}",
      tags: ["modeling", "persona"],
    },
  ];

  private constructor() {}

  public static getInstance(): PromptLibraryService {
    if (!PromptLibraryService.instance) {
      PromptLibraryService.instance = new PromptLibraryService();
    }
    return PromptLibraryService.instance;
  }

  public getTemplates(): PromptTemplate[] {
    return [...this.templates];
  }

  public getTemplateById(id: string): PromptTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }
}
