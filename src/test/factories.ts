import { ComponentTemplate } from '../services/TemplateLibrary';

type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

export function createTemplate(
  overrides: PartialExcept<ComponentTemplate, 'id'>
): ComponentTemplate {
  const base: ComponentTemplate = {
    id: 'template-id',
    name: 'Example Template',
    description: 'A helpful starting point',
    category: 'metrics',
    components: [],
    tags: ['baseline'],
    ...overrides,
  };

  return base;
}
