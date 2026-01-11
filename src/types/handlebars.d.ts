declare module "handlebars" {
  export function compile(template: string, options?: CompileOptions): TemplateDelegate;
  export function registerHelper(name: string, fn: HelperDelegate): void;
  export function registerPartial(name: string, partial: Template): void;
  export function unregisterHelper(name: string): void;
  export function unregisterPartial(name: string): void;
  export function create(): typeof Handlebars;

  export interface CompileOptions {
    data?: boolean;
    compat?: boolean;
    knownHelpers?: KnownHelpers;
    knownHelpersOnly?: boolean;
    noEscape?: boolean;
    strict?: boolean;
    assumeObjects?: boolean;
    preventIndent?: boolean;
    ignoreStandalone?: boolean;
    explicitPartialContext?: boolean;
  }

  export interface KnownHelpers {
    [name: string]: boolean;
  }

  export type Template = TemplateDelegate | string;
  export type TemplateDelegate<T = any> = (context: T, options?: RuntimeOptions) => string;
  export type HelperDelegate = (...args: any[]) => any;

  export interface RuntimeOptions {
    partial?: boolean;
    depths?: any[];
    helpers?: { [name: string]: HelperDelegate };
    partials?: { [name: string]: Template };
    decorators?: { [name: string]: Function };
    data?: any;
    blockParams?: any[];
  }

  const Handlebars: {
    compile: typeof compile;
    registerHelper: typeof registerHelper;
    registerPartial: typeof registerPartial;
    unregisterHelper: typeof unregisterHelper;
    unregisterPartial: typeof unregisterPartial;
    create: typeof create;
  };

  export default Handlebars;
}
