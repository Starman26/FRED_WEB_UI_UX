/**
 * useAgentChat.ts
 * ===============
 * React hook to consume SSE events from the Sentinela agent API.
 * 
 * Place in: src/components/useAgentChat.ts
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ── Types ──

export interface AgentEvent {
  type: string;
  source: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface AgentQuestion {
  question: string;
  options?: string[];
  type?: string;
}

interface UseAgentChatOptions {
  apiUrl?: string;
  userId?: string;
  userName?: string;
  sessionId?: string;
  interactionMode?: string;
  llmModel?: string;
  onEvent?: (event: AgentEvent) => void;
  onResponse?: (content: string) => void;
  onError?: (error: string) => void;
  onAudioChunk?: (chunk: string) => void;
  onAudioDone?: () => void;
  onStreamEnd?: () => void;
}

export interface ChatImage {
  mediaType: string;   // e.g. "image/png"
  base64: string;       // raw base64 data (no data: prefix)
}

interface UseAgentChatReturn {
  sendMessage: (message: string, images?: ChatImage[]) => Promise<void>;
  confirmAnswers: (answers: { question: string; answer: string }[]) => Promise<void>;
  events: AgentEvent[];
  response: string | null;
  suggestions: string[];
  questions: AgentQuestion[];
  isStreaming: boolean;
  sessionId: string | null;
  error: string | null;
  clearChat: () => void;
}

// ── SSE Parser ──

function parseSSE(text: string): { event: string; data: string }[] {
  const events: { event: string; data: string }[] = [];
  const blocks = text.split('\n\n');
  
  for (const block of blocks) {
    if (!block.trim()) continue;
    
    let eventType = 'message';
    let data = '';
    
    for (const line of block.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        data = line.slice(6);
      }
    }
    
    if (data) {
      events.push({ event: eventType, data });
    }
  }
  
  return events;
}

// ── Hook ──

export function useAgentChat(options: UseAgentChatOptions = {}): UseAgentChatReturn {
  const {
    apiUrl = import.meta.env.VITE_AGENT_API_URL || 'http://localhost:8000',
    userId,
    userName = 'Usuario',
    interactionMode = 'chat',
    llmModel = '',
  } = options;

  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [response, setResponse] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [questions, setQuestions] = useState<AgentQuestion[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(options.sessionId || null);
  const [error, setError] = useState<string | null>(null);
  
  const abortRef = useRef<AbortController | null>(null);

  // ── Stable callback refs (prevents stale closures & double fires) ──
  const onEventRef = useRef(options.onEvent);
  const onResponseRef = useRef(options.onResponse);
  const onErrorRef = useRef(options.onError);
  const onAudioChunkRef = useRef(options.onAudioChunk);
  const onAudioDoneRef = useRef(options.onAudioDone);
  const onStreamEndRef = useRef(options.onStreamEnd);

  useEffect(() => { onEventRef.current = options.onEvent; }, [options.onEvent]);
  useEffect(() => { onResponseRef.current = options.onResponse; }, [options.onResponse]);
  useEffect(() => { onErrorRef.current = options.onError; }, [options.onError]);
  useEffect(() => { onAudioChunkRef.current = options.onAudioChunk; }, [options.onAudioChunk]);
  useEffect(() => { onAudioDoneRef.current = options.onAudioDone; }, [options.onAudioDone]);
  useEffect(() => { onStreamEndRef.current = options.onStreamEnd; }, [options.onStreamEnd]);

  // ── Dedup: track last response to prevent double fire ──
  const lastResponseRef = useRef<string>('');

  const processStream = useCallback(async (
    url: string,
    body: Record<string, any>
  ) => {
    // Reset state
    setEvents([]);
    setResponse(null);
    setSuggestions([]);
    setQuestions([]);
    setError(null);
    setIsStreaming(true);
    lastResponseRef.current = '';

    // Abort previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${apiUrl}${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse complete SSE events from buffer
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const sseEvents = parseSSE(part + '\n\n');
          
          for (const sse of sseEvents) {
            // Events that work without JSON data
            if (sse.event === 'audio_done') {
              console.log('[SSE] audio_done received');
              onAudioDoneRef.current?.();
              continue;
            }
            if (sse.event === 'done') continue;

            try {
              const data = JSON.parse(sse.data);

              switch (sse.event) {
                case 'session':
                  setSessionId(data.session_id);
                  break;

                case 'node_update': {
                  const evt: AgentEvent = {
                    type: data.type || 'report',
                    source: data.source || 'unknown',
                    content: data.content || '',
                    timestamp: data.timestamp || new Date().toISOString(),
                    metadata: data.metadata,
                  };
                  setEvents(prev => [...prev, evt]);
                  onEventRef.current?.(evt);
                  break;
                }

                case 'response':
                  // Dedup: skip if same response already fired
                  if (lastResponseRef.current === data.content) break;
                  lastResponseRef.current = data.content;

                  setResponse(data.content);
                  onResponseRef.current?.(data.content);
                  break;

                case 'suggestions':
                  setSuggestions(data.suggestions || []);
                  break;

                case 'questions':
                  setQuestions(data.questions || []);
                  break;

                case 'tokens':
                  // Pass token info to onEvent so Dashboard can update balance
                  onEventRef.current?.({
                    type: 'tokens',
                    source: 'system',
                    content: `Tokens used: ${data.used || 0}`,
                    timestamp: new Date().toISOString(),
                    metadata: data,
                  });
                  break;

                case 'audio_chunk': {
                  // Try common field names for the base64 audio data
                  const chunkData = data.chunk || data.audio || data.data || data.content;
                  if (chunkData) {
                    console.log('[SSE] audio_chunk received, size:', chunkData.length);
                    onAudioChunkRef.current?.(chunkData);
                  } else {
                    console.warn('[SSE] audio_chunk has no recognizable data field:', Object.keys(data));
                  }
                  break;
                }

                case 'error':
                  setError(data.message);
                  onErrorRef.current?.(data.message);
                  break;
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE data:', sse.event, sse.data, parseErr);
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const msg = err.message || 'Connection error';
        setError(msg);
        onErrorRef.current?.(msg);
      }
    } finally {
      setIsStreaming(false);
      onStreamEndRef.current?.();
    }
  }, [apiUrl]); // Only apiUrl - callbacks are stable via refs

  const sendMessage = useCallback(async (message: string, images?: ChatImage[]) => {
    // Build message field: plain string if no images, or multimodal content blocks
    let messagePayload: string | Record<string, any>[] = message;
    if (images && images.length > 0) {
      const blocks: Record<string, any>[] = [];
      // Add text block first
      if (message.trim()) {
        blocks.push({ type: 'text', text: message });
      }
      // Add image blocks (LangChain image_url format with data URI)
      for (const img of images) {
        blocks.push({
          type: 'image_url',
          image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
        });
      }
      messagePayload = blocks;
    }

    await processStream('/api/chat', {
      message: messagePayload,
      user_id: userId,
      user_name: userName,
      session_id: sessionId,
      interaction_mode: interactionMode,
      llm_model: llmModel,
    });
  }, [processStream, userId, userName, sessionId, interactionMode, llmModel]);

  const confirmAnswers = useCallback(async (
    answers: { question: string; answer: string }[]
  ) => {
    if (!sessionId) {
      setError('No session ID for confirmation');
      return;
    }
    // Reset dedup ref so the resumed response can come through
    lastResponseRef.current = '';
    await processStream('/api/confirm', {
      session_id: sessionId,
      answers,
    });
  }, [processStream, sessionId]);

  const clearChat = useCallback(() => {
    setEvents([]);
    setResponse(null);
    setSuggestions([]);
    setQuestions([]);
    setError(null);
    setSessionId(null);
    lastResponseRef.current = '';
  }, []);

  return {
    sendMessage,
    confirmAnswers,
    events,
    response,
    suggestions,
    questions,
    isStreaming,
    sessionId,
    error,
    clearChat,
  };
}