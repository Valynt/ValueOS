declare global {
  interface Window {
    dataLayer: any[];
  }
}

export function trackEvent(eventName: string, eventParams?: Record<string, any>) {
  if (typeof window === 'undefined') return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event: eventName,
    ...eventParams,
  });
}

export function trackPageView(pagePath: string, pageTitle: string) {
  trackEvent('page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: window.location.href,
  });
}

export function trackButtonClick(buttonName: string, location: string) {
  trackEvent('button_click', {
    button_name: buttonName,
    click_location: location,
    page_location: window.location.href,
  });
}

export function trackFormSubmit(formName: string, formLocation: string) {
  trackEvent('form_submit', {
    form_name: formName,
    form_location: formLocation,
    page_location: window.location.href,
  });
}

export function trackOutboundLink(url: string, linkText: string) {
  trackEvent('outbound_link_click', {
    link_url: url,
    link_text: linkText,
    page_location: window.location.href,
  });
}

export function trackScrollDepth(depth: number) {
  trackEvent('scroll_depth', {
    scroll_depth: depth,
    page_location: window.location.href,
  });
}
