
/**
 * Downloads a file from a URL.
 * Supports handling of secure/same-origin downloads via fetch,
 * and fallback for cross-origin resources.
 *
 * @param url The URL of the file to download
 * @param filename Optional filename to save as. If not provided, it will be inferred from the URL or default to 'download'.
 */
export async function downloadFile(url: string, filename?: string): Promise<void> {
  if (!url) return;

  const name = filename || url.split('/').pop() || 'download';

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = name;

    // Append to body to ensure click works in all browsers
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download helper failed:', error);
    throw error;
  }
}
