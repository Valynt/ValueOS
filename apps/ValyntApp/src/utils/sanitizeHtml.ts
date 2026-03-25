import DOMPurify from "isomorphic-dompurify";

const DEFAULT_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    "a", "b", "blockquote", "br", "code", "div", "em",
    "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
    "li", "ol", "p", "pre", "span", "strong",
    "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
  ],
  ALLOWED_ATTR: ["alt", "class", "height", "href", "rel", "src", "target", "title", "width"],
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
  ALLOW_DATA_ATTR: false,
};

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";

  const sanitized = DOMPurify.sanitize(dirty, DEFAULT_CONFIG) as string;
  if (typeof document === "undefined") {
    return sanitized;
  }

  const template = document.createElement("template");
  // eslint-disable-next-line no-restricted-syntax
  template.innerHTML = sanitized;

  template.content.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (href && !/^(https?:|mailto:|tel:)/i.test(href)) {
      anchor.removeAttribute("href");
    }

    if (anchor.getAttribute("target") === "_blank" || (href && /^https?:/i.test(href))) {
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  });

  template.content.querySelectorAll("img").forEach((image) => {
    const src = image.getAttribute("src");
    if (src && /^(data:|javascript:)/i.test(src.trim())) {
      image.removeAttribute("src");
    }
  });

  return template.innerHTML;
}
