// packages/backend/src/components/templates/TemplateMap.ts
export interface Template {
  id: string;
  name: string;
  content: string;
}

export const templateMap: Record<string, Template> = {
  default: {
    id: 'default',
    name: 'Default Template',
    content: '<div>Hello World</div>',
  },
};
