import { useEffect } from "react";

export function Analytics() {
  const gtmId = import.meta.env.VITE_GTM_CONTAINER_ID;

  useEffect(() => {
    if (!gtmId) return;

    // GTM Initialization
    // Refactored to avoid innerHTML usage (SEC-003)
    (function(w: Window & Record<string, unknown>, d: Document, s: string, l: string, i: string){
      w[l] = w[l] || [];
      w[l].push({
        'gtm.start': new Date().getTime(),
        event: 'gtm.js'
      });

      const f = d.getElementsByTagName(s)[0];
      const j = d.createElement(s);
      const dl = l != 'dataLayer' ? '&l=' + l : '';

      j.async = true;
      j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;

      if (f && f.parentNode) {
        f.parentNode.insertBefore(j, f);
      } else {
        d.head.appendChild(j);
      }
    })(window, document, 'script', 'dataLayer', gtmId);

    // Noscript Iframe
    // Using DOM API instead of innerHTML for security
    const gtmNoscript = document.createElement("noscript");
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
    iframe.height = "0";
    iframe.width = "0";
    iframe.style.display = "none";
    iframe.style.visibility = "hidden";

    gtmNoscript.appendChild(iframe);
    document.body.insertBefore(gtmNoscript, document.body.firstChild);

  }, [gtmId]);

  return null;
}
