/**
 * Parse Document Edge Function
 * 
 * Extracts text content from PDF, DOCX, and text files.
 * Returns plain text for LLM analysis.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// PDF.js for PDFs (using pdf-parse compatible approach)
// For DOCX, we extract the XML content directly

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseResult {
  success: boolean;
  text?: string;
  metadata?: {
    pageCount?: number;
    wordCount?: number;
    fileName?: string;
    fileType?: string;
  };
  error?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ success: false, error: 'Expected multipart/form-data' }, 400);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return jsonResponse({ success: false, error: 'No file provided' }, 400);
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return jsonResponse({ success: false, error: 'File too large (max 10MB)' }, 400);
    }

    const fileName = file.name.toLowerCase();
    let text = '';
    let metadata: ParseResult['metadata'] = {
      fileName: file.name,
      fileType: file.type,
    };

    // Route to appropriate parser based on file type
    if (fileName.endsWith('.txt') || fileName.endsWith('.md') || file.type === 'text/plain') {
      text = await file.text();
    } else if (fileName.endsWith('.pdf') || file.type === 'application/pdf') {
      text = await parsePDF(file);
    } else if (fileName.endsWith('.docx') || file.type.includes('wordprocessingml')) {
      text = await parseDOCX(file);
    } else if (fileName.endsWith('.doc')) {
      // Legacy .doc format - basic extraction
      text = await parseBasicText(file);
    } else {
      return jsonResponse({ 
        success: false, 
        error: `Unsupported file type: ${file.type || fileName}` 
      }, 400);
    }

    // Clean up extracted text
    text = cleanText(text);
    
    metadata.wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

    return jsonResponse({
      success: true,
      text,
      metadata,
    });

  } catch (error) {
    console.error('Document parse error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to parse document',
    }, 500);
  }
});

/**
 * Parse PDF file
 * Uses a simple text extraction approach for Deno environment
 */
async function parsePDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  
  // Simple PDF text extraction
  // Looks for text streams in the PDF structure
  const text = extractPDFText(bytes);
  
  if (!text || text.length < 50) {
    // Fallback message if extraction fails
    return `[PDF Document: ${file.name}]\n\nThis PDF could not be fully parsed. It may contain scanned images or complex formatting.\n\nPlease paste the text content directly for best results.`;
  }
  
  return text;
}

/**
 * Extract text from PDF bytes
 * Basic extraction that handles most text-based PDFs
 */
function extractPDFText(bytes: Uint8Array): string {
  const decoder = new TextDecoder('latin1');
  const content = decoder.decode(bytes);
  
  const textParts: string[] = [];
  
  // Find text streams between BT (Begin Text) and ET (End Text)
  const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
  let match;
  
  while ((match = streamRegex.exec(content)) !== null) {
    const stream = match[1];
    
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(stream)) !== null) {
      const text = decodePDFString(tjMatch[1]);
      if (text.trim()) {
        textParts.push(text);
      }
    }
    
    // Extract text from TJ arrays
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjArrayMatch;
    while ((tjArrayMatch = tjArrayRegex.exec(stream)) !== null) {
      const arrayContent = tjArrayMatch[1];
      const stringRegex = /\(([^)]*)\)/g;
      let stringMatch;
      while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
        const text = decodePDFString(stringMatch[1]);
        if (text.trim()) {
          textParts.push(text);
        }
      }
    }
  }
  
  // Also try to find plain text content
  const plainTextRegex = /\/Contents\s*\(([^)]+)\)/g;
  while ((match = plainTextRegex.exec(content)) !== null) {
    textParts.push(decodePDFString(match[1]));
  }
  
  return textParts.join(' ').trim();
}

/**
 * Decode PDF string escapes
 */
function decodePDFString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\')
    .replace(/\\(\d{3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

/**
 * Parse DOCX file
 * DOCX is a ZIP containing XML files
 */
async function parseDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  try {
    // DOCX files are ZIP archives
    // The main content is in word/document.xml
    const zip = await unzip(new Uint8Array(arrayBuffer));
    
    const documentXml = zip['word/document.xml'];
    if (!documentXml) {
      throw new Error('Invalid DOCX: missing document.xml');
    }
    
    const decoder = new TextDecoder('utf-8');
    const xmlContent = decoder.decode(documentXml);
    
    // Extract text from XML
    return extractTextFromWordXML(xmlContent);
  } catch (error) {
    console.error('DOCX parse error:', error);
    // Fallback to basic extraction
    return parseBasicText(file);
  }
}

/**
 * Simple ZIP extraction for DOCX
 */
async function unzip(data: Uint8Array): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  
  // Find central directory
  let pos = data.length - 22;
  while (pos >= 0 && !(data[pos] === 0x50 && data[pos + 1] === 0x4b && 
         data[pos + 2] === 0x05 && data[pos + 3] === 0x06)) {
    pos--;
  }
  
  if (pos < 0) {
    throw new Error('Invalid ZIP file');
  }
  
  const centralDirOffset = data[pos + 16] | (data[pos + 17] << 8) | 
                          (data[pos + 18] << 16) | (data[pos + 19] << 24);
  
  pos = centralDirOffset;
  
  while (pos < data.length - 4) {
    if (data[pos] !== 0x50 || data[pos + 1] !== 0x4b || 
        data[pos + 2] !== 0x01 || data[pos + 3] !== 0x02) {
      break;
    }
    
    const compressionMethod = data[pos + 10] | (data[pos + 11] << 8);
    const compressedSize = data[pos + 20] | (data[pos + 21] << 8) | 
                          (data[pos + 22] << 16) | (data[pos + 23] << 24);
    const fileNameLength = data[pos + 28] | (data[pos + 29] << 8);
    const extraLength = data[pos + 30] | (data[pos + 31] << 8);
    const commentLength = data[pos + 32] | (data[pos + 33] << 8);
    const localHeaderOffset = data[pos + 42] | (data[pos + 43] << 8) | 
                             (data[pos + 44] << 16) | (data[pos + 45] << 24);
    
    const fileName = new TextDecoder().decode(
      data.slice(pos + 46, pos + 46 + fileNameLength)
    );
    
    // Read from local header
    const localPos = localHeaderOffset;
    const localFileNameLength = data[localPos + 26] | (data[localPos + 27] << 8);
    const localExtraLength = data[localPos + 28] | (data[localPos + 29] << 8);
    const dataStart = localPos + 30 + localFileNameLength + localExtraLength;
    
    if (compressionMethod === 0) {
      // Stored (no compression)
      files[fileName] = data.slice(dataStart, dataStart + compressedSize);
    } else if (compressionMethod === 8) {
      // Deflate - use DecompressionStream
      try {
        const compressed = data.slice(dataStart, dataStart + compressedSize);
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(compressed);
        writer.close();
        
        const reader = ds.readable.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.length;
        }
        
        files[fileName] = result;
      } catch {
        // Skip files that fail to decompress
      }
    }
    
    pos += 46 + fileNameLength + extraLength + commentLength;
  }
  
  return files;
}

/**
 * Extract text from Word XML content
 */
function extractTextFromWordXML(xml: string): string {
  const textParts: string[] = [];
  
  // Extract text from <w:t> elements
  const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  
  while ((match = textRegex.exec(xml)) !== null) {
    textParts.push(match[1]);
  }
  
  // Join with appropriate spacing
  // Look for paragraph breaks
  let result = '';
  const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
  
  while ((match = paragraphRegex.exec(xml)) !== null) {
    const paragraphContent = match[1];
    const paragraphTexts: string[] = [];
    
    const innerTextRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let innerMatch;
    while ((innerMatch = innerTextRegex.exec(paragraphContent)) !== null) {
      paragraphTexts.push(innerMatch[1]);
    }
    
    if (paragraphTexts.length > 0) {
      result += paragraphTexts.join('') + '\n';
    }
  }
  
  return result.trim() || textParts.join(' ');
}

/**
 * Basic text extraction fallback
 */
async function parseBasicText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let text = decoder.decode(arrayBuffer);
    
    // Remove null bytes and non-printable characters
    text = text.replace(/\x00/g, '');
    text = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    
    // If still too garbled, return fallback
    const readableRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
    if (readableRatio < 0.3) {
      return `[Document: ${file.name}]\n\nThis document format could not be parsed. Please paste the text content directly.`;
    }
    
    return text;
  } catch {
    return `[Document: ${file.name}]\n\nFailed to read document. Please paste the text content directly.`;
  }
}

/**
 * Clean extracted text
 */
function cleanText(text: string): string {
  return text
    // Normalize whitespace
    .replace(/[ \t]+/g, ' ')
    // Normalize line breaks
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove excessive blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim();
}

/**
 * JSON response helper
 */
function jsonResponse(data: ParseResult, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
