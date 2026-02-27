/**
 * BrandingPage - Brand customization for exported proposals
 * 
 * Logo, colors, fonts, boilerplate, team signatures.
 */

import { useState } from "react";
import {
  Download,
  Eye,
  GripVertical,
  Image,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SimpleSelect } from "@/components/ui/select";
import { UserAvatar } from "@/components/ui/avatar";
import { SettingsRow, SettingsSection } from "@/components/settings";
import { cn } from "@/lib/utils";

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  background: string;
}

interface TeamMember {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedIn: string;
  includeInProposals: boolean;
}

interface BoilerplateSection {
  id: string;
  name: string;
  content: string;
  type: "intro" | "closing" | "legal" | "custom";
}

const FONT_OPTIONS = [
  { value: "inter", label: "Inter (Modern)" },
  { value: "roboto", label: "Roboto (Clean)" },
  { value: "opensans", label: "Open Sans (Friendly)" },
  { value: "lato", label: "Lato (Professional)" },
  { value: "montserrat", label: "Montserrat (Bold)" },
  { value: "sourcesans", label: "Source Sans Pro (Technical)" },
];

const DEFAULT_COLORS: BrandColors = {
  primary: "#2563eb",
  secondary: "#64748b",
  accent: "#10b981",
  text: "#1e293b",
  background: "#ffffff",
};

const DEFAULT_TEAM: TeamMember[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    title: "Solutions Consultant",
    email: "sarah@acmecorp.com",
    phone: "+1 (555) 123-4567",
    linkedIn: "linkedin.com/in/sarahjohnson",
    includeInProposals: true,
  },
  {
    id: "2",
    name: "Michael Chen",
    title: "Account Executive",
    email: "michael@acmecorp.com",
    phone: "+1 (555) 234-5678",
    linkedIn: "linkedin.com/in/michaelchen",
    includeInProposals: true,
  },
];

const DEFAULT_BOILERPLATE: BoilerplateSection[] = [
  {
    id: "1",
    name: "Company Introduction",
    type: "intro",
    content: "Acme Corp is a leading provider of enterprise solutions, helping organizations transform their operations and drive measurable business value.",
  },
  {
    id: "2",
    name: "Proposal Closing",
    type: "closing",
    content: "We look forward to partnering with you on this initiative. Our team is committed to delivering exceptional results and ensuring your success.",
  },
  {
    id: "3",
    name: "Legal Disclaimer",
    type: "legal",
    content: "This proposal is confidential and intended solely for the use of the recipient. The information contained herein is subject to change without notice.",
  },
];

export function BrandingPage() {
  const [logo, setLogo] = useState<string | null>(null);
  const [logoVariant, setLogoVariant] = useState<string | null>(null);
  const [colors, setColors] = useState<BrandColors>(DEFAULT_COLORS);
  const [headingFont, setHeadingFont] = useState("inter");
  const [bodyFont, setBodyFont] = useState("inter");
  const [team, setTeam] = useState<TeamMember[]>(DEFAULT_TEAM);
  const [boilerplate, setBoilerplate] = useState<BoilerplateSection[]>(DEFAULT_BOILERPLATE);
  const [editingBoilerplate, setEditingBoilerplate] = useState<string | null>(null);

  const handleColorChange = (key: keyof BrandColors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleToggleTeamMember = (id: string) => {
    setTeam((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, includeInProposals: !m.includeInProposals } : m
      )
    );
  };

  const handleBoilerplateChange = (id: string, content: string) => {
    setBoilerplate((prev) =>
      prev.map((b) => (b.id === id ? { ...b, content } : b))
    );
  };

  return (
    <div>
      {/* Logo Section */}
      <SettingsSection
        title="Logo"
        description="Upload your company logo for proposals and exports"
      >
        <div className="p-4 space-y-4">
          {/* Primary Logo */}
          <div className="flex items-start gap-6">
            <div
              className={cn(
                "w-40 h-24 rounded-lg border-2 border-dashed flex items-center justify-center",
                logo ? "border-transparent bg-muted" : "border-muted-foreground/30"
              )}
            >
              {logo ? (
                <img src={logo} alt="Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="text-center">
                  <Image className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground mt-1">Primary logo</p>
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Primary logo</p>
              <p className="text-sm text-muted-foreground mb-3">
                Used in proposal headers. Recommended size: 400x100px, PNG or SVG.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                {logo && (
                  <Button variant="ghost" size="sm" onClick={() => setLogo(null)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Logo Variant */}
          <div className="flex items-start gap-6 pt-4 border-t">
            <div
              className={cn(
                "w-40 h-24 rounded-lg border-2 border-dashed flex items-center justify-center bg-slate-800",
                logoVariant ? "border-transparent" : "border-slate-600"
              )}
            >
              {logoVariant ? (
                <img src={logoVariant} alt="Logo variant" className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="text-center">
                  <Image className="h-8 w-8 mx-auto text-slate-500" />
                  <p className="text-xs text-slate-500 mt-1">Light variant</p>
                </div>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Light variant (optional)</p>
              <p className="text-sm text-muted-foreground mb-3">
                For dark backgrounds. White or light-colored version of your logo.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                {logoVariant && (
                  <Button variant="ghost" size="sm" onClick={() => setLogoVariant(null)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Color Palette */}
      <SettingsSection
        title="Color palette"
        description="Define your brand colors for proposals"
      >
        <div className="p-4">
          <div className="grid grid-cols-5 gap-4">
            {(Object.keys(colors) as Array<keyof BrandColors>).map((key) => (
              <div key={key} className="space-y-2">
                <div
                  className="w-full h-16 rounded-lg border shadow-sm cursor-pointer"
                  style={{ backgroundColor: colors[key] }}
                  onClick={() => {
                    const input = document.getElementById(`color-${key}`);
                    input?.click();
                  }}
                />
                <input
                  id={`color-${key}`}
                  type="color"
                  value={colors[key]}
                  onChange={(e) => handleColorChange(key, e.target.value)}
                  className="sr-only"
                />
                <p className="text-xs font-medium capitalize text-center">{key}</p>
                <p className="text-xs text-muted-foreground text-center uppercase">
                  {colors[key]}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Colors will be applied to headings, buttons, and accents in exported proposals.
            </p>
            <Button variant="outline" size="sm" onClick={() => setColors(DEFAULT_COLORS)}>
              Reset to defaults
            </Button>
          </div>
        </div>
      </SettingsSection>

      {/* Typography */}
      <SettingsSection
        title="Typography"
        description="Choose fonts for your proposals"
      >
        <div className="px-4">
          <SettingsRow label="Heading font" value={FONT_OPTIONS.find(f => f.value === headingFont)?.label || ""} editable={false}>
            <SimpleSelect
              value={headingFont}
              onValueChange={setHeadingFont}
              options={FONT_OPTIONS}
            />
          </SettingsRow>
          <SettingsRow label="Body font" value={FONT_OPTIONS.find(f => f.value === bodyFont)?.label || ""} editable={false}>
            <SimpleSelect
              value={bodyFont}
              onValueChange={setBodyFont}
              options={FONT_OPTIONS}
            />
          </SettingsRow>
        </div>
        
        {/* Font Preview */}
        <div className="mx-4 mb-4 p-4 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Preview</p>
          <p className="text-xl font-semibold mb-2" style={{ fontFamily: headingFont }}>
            Value Proposition Heading
          </p>
          <p className="text-sm text-muted-foreground" style={{ fontFamily: bodyFont }}>
            This is how your body text will appear in exported proposals. The selected fonts will be embedded in PDF exports for consistent rendering.
          </p>
        </div>
      </SettingsSection>

      {/* Boilerplate Text */}
      <SettingsSection
        title="Boilerplate text"
        description="Reusable text blocks for proposals"
      >
        <div className="divide-y">
          {boilerplate.map((section) => (
            <div key={section.id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                  <div>
                    <p className="text-sm font-medium">{section.name}</p>
                    <Badge variant="secondary" className="text-xs capitalize mt-1">
                      {section.type}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingBoilerplate(
                      editingBoilerplate === section.id ? null : section.id
                    )}
                  >
                    {editingBoilerplate === section.id ? "Done" : "Edit"}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {editingBoilerplate === section.id ? (
                <Textarea
                  value={section.content}
                  onChange={(e) => handleBoilerplateChange(section.id, e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              ) : (
                <p className="text-sm text-muted-foreground line-clamp-2 ml-6">
                  {section.content}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add boilerplate section
          </Button>
        </div>
      </SettingsSection>

      {/* Team Profiles / Signatures */}
      <SettingsSection
        title="Team profiles"
        description="Contact information shown in proposal signatures"
      >
        <div className="divide-y">
          {team.map((member) => (
            <div key={member.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <UserAvatar name={member.name} size="md" />
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-sm text-muted-foreground">{member.title}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span>{member.email}</span>
                      <span>{member.phone}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={member.includeInProposals}
                      onChange={() => handleToggleTeamMember(member.id)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="text-sm text-muted-foreground">Include in proposals</span>
                  </label>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t">
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add team member
          </Button>
        </div>
      </SettingsSection>

      {/* Export Settings */}
      <SettingsSection
        title="Export settings"
        description="Default settings for proposal exports"
      >
        <div className="px-4">
          <SettingsRow
            label="Default format"
            value="PDF"
            editable={false}
          >
            <SimpleSelect
              value="pdf"
              onValueChange={() => {}}
              options={[
                { value: "pdf", label: "PDF" },
                { value: "pptx", label: "PowerPoint" },
                { value: "docx", label: "Word" },
              ]}
            />
          </SettingsRow>
          <SettingsRow
            label="Include cover page"
            value="Yes"
            editable={false}
          >
            <SimpleSelect
              value="yes"
              onValueChange={() => {}}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
            />
          </SettingsRow>
          <SettingsRow
            label="Page numbering"
            value="Bottom center"
            editable={false}
          >
            <SimpleSelect
              value="bottom-center"
              onValueChange={() => {}}
              options={[
                { value: "bottom-center", label: "Bottom center" },
                { value: "bottom-right", label: "Bottom right" },
                { value: "none", label: "None" },
              ]}
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      {/* Preview & Actions */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <p className="font-medium">Preview your brand settings</p>
          <p className="text-sm text-muted-foreground">
            See how your branding will appear in exported proposals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Export brand kit
          </Button>
        </div>
      </div>
    </div>
  );
}

export default BrandingPage;
