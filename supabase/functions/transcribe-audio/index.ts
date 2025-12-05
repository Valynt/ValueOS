/**
 * Transcribe Audio Edge Function
 * 
 * Transcribes audio files using OpenAI Whisper API.
 * Returns transcript for sales call analysis.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptionResult {
  success: boolean;
  transcript?: string;
  duration?: number;
  language?: string;
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
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token with Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return jsonResponse({ success: false, error: 'Server configuration error' }, 500);
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': supabaseKey,
      },
    });

    if (!userResponse.ok) {
      return jsonResponse({ success: false, error: 'Invalid or expired token' }, 401);
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return jsonResponse({ 
        success: false, 
        error: 'OpenAI API key not configured' 
      }, 500);
    }

    const contentType = req.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return jsonResponse({ success: false, error: 'Expected multipart/form-data' }, 400);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return jsonResponse({ success: false, error: 'No audio file provided' }, 400);
    }

    // Validate file type
    const validTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/m4a',
      'audio/wav', 'audio/webm', 'audio/ogg', 'video/mp4', 'video/webm'
    ];
    const isValidType = validTypes.some(t => file.type.includes(t.split('/')[1])) ||
      file.name.match(/\.(mp3|mp4|m4a|wav|webm|ogg|mpeg)$/i);

    if (!isValidType) {
      return jsonResponse({ 
        success: false, 
        error: `Unsupported file type: ${file.type}. Supported: MP3, MP4, M4A, WAV, WebM, OGG` 
      }, 400);
    }

    // Validate file size (25MB max for Whisper)
    if (file.size > 25 * 1024 * 1024) {
      return jsonResponse({ 
        success: false, 
        error: 'File too large (max 25MB)' 
      }, 400);
    }

    // Prepare form data for OpenAI
    const whisperFormData = new FormData();
    whisperFormData.append('file', file);
    whisperFormData.append('model', 'whisper-1');
    whisperFormData.append('response_format', 'verbose_json');
    whisperFormData.append('language', 'en'); // Can be made dynamic

    // Call OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: whisperFormData,
    });

    if (!whisperResponse.ok) {
      const errorData = await whisperResponse.json().catch(() => ({}));
      console.error('Whisper API error:', errorData);
      return jsonResponse({
        success: false,
        error: errorData.error?.message || `Transcription failed: ${whisperResponse.status}`,
      }, whisperResponse.status);
    }

    const whisperResult = await whisperResponse.json();

    return jsonResponse({
      success: true,
      transcript: whisperResult.text,
      duration: whisperResult.duration,
      language: whisperResult.language,
    });

  } catch (error) {
    console.error('Transcription error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Transcription failed',
    }, 500);
  }
});

function jsonResponse(data: TranscriptionResult, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
