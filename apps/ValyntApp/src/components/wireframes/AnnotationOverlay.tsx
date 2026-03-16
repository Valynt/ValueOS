import * as React from "react";

export interface Annotation {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface AnnotationOverlayProps {
  annotations?: Annotation[];
  visible?: boolean;
}

export function AnnotationOverlay(_props: AnnotationOverlayProps): React.ReactElement {
  return React.createElement("div", null);
}

export interface AnnotatedSectionProps {
  children?: React.ReactNode;
  annotation?: string;
}

export function AnnotatedSection(props: AnnotatedSectionProps): React.ReactElement {
  return React.createElement("div", null, props.children);
}

export const ANNOTATIONS: Record<string, Annotation> = {};
