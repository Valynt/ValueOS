import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
}

export function SEO({
  title = "VALYNT | The Value Operating System - Value Intelligence Platform",
  description = "VALYNT is the AI-native Value Operating System that models, measures, and proves your outcomes automatically. Achieve 3.4× faster value realization, reduce churn by 67%, and increase expansion revenue by 2.1× with autonomous agents.",
  keywords = "value operating system, VOS, value intelligence platform, VALYNT, AI agents, value realization, outcome orchestration, economic truth, business case automation, sales enablement, customer success, value engineering",
  ogImage = "https://valynt.xyz/og-image.jpg",
  canonicalUrl = "https://valynt.xyz",
}: SEOProps) {
  useEffect(() => {
    document.title = title;

    const resourceHints = [
      { rel: "dns-prefetch", href: "https://fonts.googleapis.com" },
      { rel: "dns-prefetch", href: "https://fonts.gstatic.com" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
    ];

    resourceHints.forEach(({ rel, href, crossOrigin }) => {
      let link = document.querySelector(
        `link[rel="${rel}"][href="${href}"]`,
      ) as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = rel;
        link.href = href;
        if (crossOrigin) link.crossOrigin = crossOrigin;
        document.head.appendChild(link);
      }
    });

    const metaTags = [
      { name: "description", content: description },
      { name: "keywords", content: keywords },
      { name: "author", content: "VALYNT Inc." },
      {
        name: "robots",
        content:
          "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      },
      { name: "googlebot", content: "index, follow" },
      { name: "bingbot", content: "index, follow" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "theme-color", content: "#050505" },
      { name: "format-detection", content: "telephone=no" },
      { name: "language", content: "English" },
      { name: "revisit-after", content: "7 days" },
      { name: "rating", content: "general" },
      { name: "application-name", content: "VALYNT" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      { name: "apple-mobile-web-app-title", content: "VALYNT" },
      { name: "msapplication-TileColor", content: "#050505" },
      { name: "msapplication-TileImage", content: "/ms-icon-144x144.png" },

      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: ogImage },
      {
        property: "og:image:alt",
        content: "VALYNT - AI-Powered Value Operating System",
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:url", content: canonicalUrl },
      { property: "og:site_name", content: "VALYNT" },
      { property: "og:locale", content: "en_US" },

      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@valuecanvas" },
      { name: "twitter:creator", content: "@valuecanvas" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
      {
        name: "twitter:image:alt",
        content: "VALYNT - AI-Powered Value Operating System",
      },

      { property: "article:publisher", content: "https://valynt.xyz" },
      { property: "article:author", content: "VALYNT Inc." },

      { name: "pinterest-rich-pin", content: "true" },
    ];

    metaTags.forEach(({ name, property, content }) => {
      const attribute = property ? "property" : "name";
      const value = property || name;
      let element = document.querySelector(`meta[${attribute}="${value}"]`);

      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, value as string);
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    });

    let canonicalLink = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonicalUrl;

    const structuredDataArray = [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "VALYNT",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: description,
        url: canonicalUrl,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: "4.9",
          ratingCount: "127",
        },
        publisher: {
          "@type": "Organization",
          name: "VALYNT Inc.",
          logo: {
            "@type": "ImageObject",
            url: "https://valynt.xyz/logo.png",
          },
          url: "https://valynt.xyz",
          sameAs: [
            "https://twitter.com/valuecanvas",
            "https://linkedin.com/company/valuecanvas",
            "https://github.com/valuecanvas",
          ],
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "VALYNT Inc.",
        url: "https://valynt.xyz",
        logo: "https://valynt.xyz/logo.png",
        description:
          "AI-powered Value Operating System for enterprise value realization",
        sameAs: [
          "https://twitter.com/valuecanvas",
          "https://linkedin.com/company/valuecanvas",
          "https://github.com/valuecanvas",
        ],
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "Sales",
          email: "sales@valuecanvas.ai",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "VALYNT",
        url: canonicalUrl,
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: "https://valuecanvas.ai/search?q={search_term_string}",
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://valynt.xyz",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "The Problem",
            item: "https://valynt.xyz/#problem",
          },
          {
            "@type": "ListItem",
            position: 3,
            name: "The Solution",
            item: "https://valynt.xyz/#solution",
          },
          {
            "@type": "ListItem",
            position: 4,
            name: "How It Works",
            item: "https://valynt.xyz/#how-it-works",
          },
        ],
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Can I trust AI-generated numbers?",
            acceptedAnswer: {
              "@type": "Answer",
              text: 'Trust is our core product. We employ a specialized Integrity Agent whose sole job is to audit other agents. It enforces "Manifesto Compliance," ensuring every metric is traceable, evidence-based, and conservative.',
            },
          },
          {
            "@type": "Question",
            name: "Is my customer data safe?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Absolutely. VALYNT is built on a multi-tenant architecture with strict security and enterprise-grade secrets management. Your data is isolated, encrypted, and governed by strict compliance.",
            },
          },
          {
            "@type": "Question",
            name: "Will this replace my team?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. It creates a force multiplier. By automating the research and modeling grunt work, your team focuses on strategic relationships. We don't replace the strategist; we replace the spreadsheet drudgery.",
            },
          },
        ],
      },
    ];

    const existingScripts = document.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    existingScripts.forEach((script) => script.remove());

    structuredDataArray.forEach((data, index) => {
      const scriptTag = document.createElement("script");
      scriptTag.type = "application/ld+json";
      scriptTag.id = `structured-data-${index}`;
      scriptTag.textContent = JSON.stringify(data);
      document.head.appendChild(scriptTag);
    });
  }, [title, description, keywords, ogImage, canonicalUrl]);

  return null;
}
