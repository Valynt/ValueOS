export type ArtifactType = "document" | "presentation" | "report" | "template";

export interface BrandingProfile {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
}

export interface ArtifactTemplate {
  id: string;
  name: string;
  type: ArtifactType;
  branding?: BrandingProfile;
  content: string;
}
