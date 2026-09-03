/**
 * Voice-to-Text Integration — CRIM-SYS 2026
 *
 * Supports two engines for court session recording and transcription:
 *
 *   1. Web Speech API (default): instant, browser-native Arabic
 *      recognition. Sends audio to the browser vendor's ASR service.
 *
 *   2. Vosk (offline, open-source): real in-browser WASM recognition
 *      via the `vosk-browser` package (a browser build of Kaldi/Vosk).
 *      The model is fetched as a gzipped tar archive (the format
 *      vosk-browser expects, with conf/model.conf), loaded into a Web
 *      Worker, and cached in IndexedDB by the worker (IDBFS). No audio
 *      ever leaves the device. Model URLs are resolved through
 *      `resolveVoskModelUrl()` — set `VITE_VOSK_MODEL_URL` to point at
 *      a self-hosted Arabic model (vosk-model-small-ar-0.15), otherwise
 *      a CORS-hosted demo model is used.
 */

// ============================================================
// Types
// ============================================================

export type SpeechEngine = 'vosk' | 'webspeech' | 'whisper';

export interface TranscriptionResult {
  text: string;
  confidence: number;
  engine: SpeechEngine;
  language: string;
  duration: number;
  segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface VoiceRecorderConfig {
  engine: SpeechEngine;
  language: string;
  continuous: boolean;
  interimResults: boolean;
  sampleRate: number;
  /** Vosk model id (VOSK_DEMO_MODELS) or a direct tar.gz URL. */
  model?: string;
}

export type RecorderState = 'idle' | 'recording' | 'processing' | 'completed' | 'error';

export interface RecorderCallbacks {
  onStateChange?: (state: RecorderState) => void;
  onTranscript?: (result: TranscriptionResult) => void;
  onInterim?: (text: string) => void;
  onError?: (error: string) => void;
  /** Transient status messages (e.g. "downloading model…"). */
  onStatus?: (status: string) => void;
}

// ============================================================
// Web Speech API Fallback
// ============================================================

class WebSpeechEngine {
  private recognition: SpeechRecognition | null = null;
  private callbacks: RecorderCallbacks;

  constructor(callbacks: RecorderCallbacks) {
    this.callbacks = callbacks;
  }

  async start(config: VoiceRecorderConfig): Promise<void> {
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      this.callbacks.onError?.('متصفحك لا يدعم التعرف على الصوت');
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.lang = config.language;
    this.recognition.continuous = config.continuous;
    this.recognition.interimResults = config.interimResults;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence;

        if (event.results[i].isFinal) {
          this.callbacks.onTranscript?.({
            text: transcript,
            confidence,
            engine: 'webspeech',
            language: config.language,
            duration: 0,
          });
        } else {
          interimTranscript += transcript;
          this.callbacks.onInterim?.(interimTranscript);
        }
      }
    };

    this.recognition.onerror = (event) => {
      this.callbacks.onError?.(`خطأ في التعرف على الصوت: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.callbacks.onStateChange?.('completed');
    };

    try {
      this.recognition.start();
      this.callbacks.onStateChange?.('recording');
    } catch (e) {
      this.callbacks.onError?.(`فشل بدء التسجيل: ${e}`);
    }
  }

  stop(): void {
    this.recognition?.stop();
    this.callbacks.onStateChange?.('processing');
  }

  abort(): void {
    this.recognition?.abort();
    this.callbacks.onStateChange?.('idle');
  }
}

// ============================================================
// Vosk Engine (offline — real WASM recognition via vosk-browser)
// ============================================================

import type { KaldiRecognizer, Model } from 'vosk-browser';

/**
 * CORS-hosted, vosk-browser-ready demo models (gzipped tar with
 * conf/model.conf). Served from w-okada/vosk-browser-ts via
 * raw.githubusercontent.com (access-control-allow-origin: *).
 *
 * Arabic note: no small Arabic model is publicly hosted on a CORS-open
 * host. For Egyptian Arabic set `VITE_VOSK_MODEL_URL` to any self-hosted
 * vosk-browser-ready archive (e.g. vosk-model-small-ar-0.15 with
 * conf/model.conf added).
 */
export interface VoskDemoModel {
  id: string;
  label: string;
  url: string;
}

const VOSK_RAW_BASE =
  'https://raw.githubusercontent.com/w-okada/vosk-browser-ts/master/frontend/public/assets/models';

export const VOSK_DEMO_MODELS: VoskDemoModel[] = [
  { id: 'fa', label: 'فارسي (تجريبي)', url: `${VOSK_RAW_BASE}/vosk-model-small-fa-0.4.tar.gz` },
  { id: 'en-us', label: 'إنجليزي (الولايات المتحدة)', url: `${VOSK_RAW_BASE}/vosk-model-small-en-us-0.15.tar.gz` },
  { id: 'fr', label: 'فرنسي', url: `${VOSK_RAW_BASE}/vosk-model-small-fr-0.22.tar.gz` },
  { id: 'de', label: 'ألماني', url: `${VOSK_RAW_BASE}/vosk-model-small-de-0.15.tar.gz` },
  { id: 'es', label: 'إسباني', url: `${VOSK_RAW_BASE}/vosk-model-small-es-0.42.tar.gz` },
  { id: 'it', label: 'إيطالي', url: `${VOSK_RAW_BASE}/vosk-model-small-it-0.22.tar.gz` },
  { id: 'tr', label: 'تركي', url: `${VOSK_RAW_BASE}/vosk-model-small-tr-0.3.tar.gz` },
  { id: 'ru', label: 'روسي', url: `${VOSK_RAW_BASE}/vosk-model-small-ru-0.22.tar.gz` },
];

/**
 * Resolve the model archive URL: `VITE_VOSK_MODEL_URL` wins (custom /
 * Arabic models), then the requested demo model, then the first demo.
 */
export function resolveVoskModelUrl(modelId?: string): string | null {
  const envUrl = import.meta.env.VITE_VOSK_MODEL_URL as string | undefined;
  if (envUrl) return envUrl;
  const demo = VOSK_DEMO_MODELS.find((m) => m.id === modelId);
  if (demo) return demo.url;
  return VOSK_DEMO_MODELS[0]?.url ?? null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error('انتهت مهلة تحميل نموذج Vosk — تحقق من الاتصال')),
      ms,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Module-level model cache: the worker also persists the extracted
 * model in IndexedDB (IDBFS), so repeated recordings reuse it and
 * subsequent sessions skip the network download entirely.
 */
const voskModelCache: {
  url: string;
  model: Model | null;
  promise: Promise<Model> | null;
} = { url: '', model: null, promise: null };

interface VoskWord {
  conf: number;
  start: number;
  end: number;
  word: string;
}

class VoskEngine {
  private callbacks: RecorderCallbacks;
  private modelUrl: string;
  private model: Model | null = null;
  private recognizer: KaldiRecognizer | null = null;
  private audioContext: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private language: string;

  constructor(callbacks: RecorderCallbacks, modelUrl: string, language: string) {
    this.callbacks = callbacks;
    this.modelUrl = modelUrl;
    this.language = language;
  }

  private loadModel(): Promise<Model> {
    if (voskModelCache.url === this.modelUrl && voskModelCache.model) {
      return Promise.resolve(voskModelCache.model);
    }
    if (voskModelCache.url === this.modelUrl && voskModelCache.promise) {
      return voskModelCache.promise;
    }

    voskModelCache.url = this.modelUrl;
    voskModelCache.promise = (async () => {
      this.callbacks.onStateChange?.('processing');
      this.callbacks.onStatus?.('جارٍ تحميل نموذج Vosk — قد يستغرق دقيقة أو أكثر في أول مرة...');
      try {
        const { createModel } = await import('vosk-browser');
        const model = await withTimeout(createModel(this.modelUrl), 5 * 60 * 1000);
        voskModelCache.model = model;
        this.model = model;
        this.callbacks.onStatus?.('نموذج Vosk جاهز ✓');
        return model;
      } catch (error) {
        voskModelCache.url = '';
        voskModelCache.promise = null;
        throw error;
      } finally {
        this.callbacks.onStateChange?.('idle');
      }
    })();
    return voskModelCache.promise;
  }

  async start(config: VoiceRecorderConfig): Promise<void> {
    try {
      const model = await this.loadModel();

      // Microphone (16kHz mono for Vosk)
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: config.sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      let ctx: AudioContext;
      try {
        ctx = new AudioContext({ sampleRate: config.sampleRate });
      } catch {
        ctx = new AudioContext();
      }
      this.audioContext = ctx;
      const sampleRate = ctx.sampleRate;

      this.recognizer = new model.KaldiRecognizer(sampleRate);
      this.recognizer.setWords(true);
      this.recognizer.on('result', (message) => {
        const msg = message as unknown as {
          event: 'result';
          result?: { text?: string; result?: VoskWord[] };
        };
        const text = msg.result?.text?.trim();
        if (!text) return;
        const words = msg.result?.result ?? [];
        const confidence =
          words.length > 0
            ? words.reduce((sum, w) => sum + w.conf, 0) / words.length
            : 0.8;
        const last = words[words.length - 1];
        this.callbacks.onTranscript?.({
          text,
          confidence,
          engine: 'vosk',
          language: this.language,
          duration: last ? last.end : 0,
          segments: words.map((w) => ({
            start: w.start,
            end: w.end,
            text: w.word,
            confidence: w.conf,
          })),
        });
      });
      this.recognizer.on('partialresult', (message) => {
        const msg = message as unknown as {
          event: 'partialresult';
          result?: { partial?: string };
        };
        const partial = msg.result?.partial?.trim();
        if (partial) this.callbacks.onInterim?.(partial);
      });

      this.sourceNode = ctx.createMediaStreamSource(this.stream);
      this.scriptNode = ctx.createScriptProcessor(4096, 1, 1);
      this.scriptNode.onaudioprocess = (event) => {
        if (!this.recognizer) return;
        try {
          this.recognizer.acceptWaveformFloat(
            event.inputBuffer.getChannelData(0),
            sampleRate,
          );
        } catch {
          // Chunk rejected — keep streaming.
        }
      };
      this.sourceNode.connect(this.scriptNode);
      this.scriptNode.connect(ctx.destination);

      this.callbacks.onStatus?.('');
      this.callbacks.onStateChange?.('recording');
    } catch (error) {
      this.cleanupStream();
      this.callbacks.onError?.(
        error instanceof Error
          ? `Vosk: ${error.message}`
          : 'فشل بدء التعرف الصوتي عبر Vosk',
      );
    }
  }

  async stop(): Promise<void> {
    this.callbacks.onStateChange?.('processing');
    if (this.recognizer) {
      try {
        this.recognizer.retrieveFinalResult();
        // Give the worker a moment to flush the final result event.
        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch {
        // Recognizer already gone.
      }
      try {
        this.recognizer.remove();
      } catch {
        // Already removed.
      }
    }
    this.recognizer = null;
    this.cleanupStream();
    this.callbacks.onStateChange?.('completed');
  }

  abort(): void {
    if (this.recognizer) {
      try {
        this.recognizer.remove();
      } catch {
        // Already removed.
      }
    }
    this.recognizer = null;
    this.cleanupStream();
    this.callbacks.onStateChange?.('idle');
    this.callbacks.onStatus?.('');
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.scriptNode) {
      try {
        this.scriptNode.disconnect();
      } catch {
        // Already disconnected.
      }
      this.scriptNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Already disconnected.
      }
      this.sourceNode = null;
    }
    if (this.audioContext) {
      try {
        void this.audioContext.close();
      } catch {
        // Already closed.
      }
      this.audioContext = null;
    }
  }
}

// ============================================================
// Voice Recorder
// ============================================================

export class VoiceRecorder {
  private engine: WebSpeechEngine | VoskEngine | null = null;
  private state: RecorderState = 'idle';
  private callbacks: RecorderCallbacks;

  constructor(callbacks: RecorderCallbacks = {}) {
    this.callbacks = callbacks;
  }

  async startRecording(config?: Partial<VoiceRecorderConfig>): Promise<void> {
    const fullConfig: VoiceRecorderConfig = {
      engine: config?.engine ?? 'webspeech',
      language: config?.language ?? 'ar-EG',
      continuous: config?.continuous ?? true,
      interimResults: config?.interimResults ?? true,
      sampleRate: config?.sampleRate ?? 16000,
    };

    if (fullConfig.engine === 'vosk') {
      this.engine = new VoskEngine(
        this.callbacks,
        resolveVoskModelUrl(fullConfig.model) ?? '',
        fullConfig.language,
      );
    } else {
      this.engine = new WebSpeechEngine(this.callbacks);
    }

    await this.engine.start(fullConfig);
  }

  async stopRecording(): Promise<void> {
    await this.engine?.stop();
  }

  abort(): void {
    this.engine?.abort();
    this.state = 'idle';
    this.callbacks.onStateChange?.('idle');
  }

  getState(): RecorderState {
    return this.state;
  }

  /**
   * Check available speech engines.
   */
  static getAvailableEngines(): SpeechEngine[] {
    const engines: SpeechEngine[] = [];

    if (typeof window !== 'undefined') {
      if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        engines.push('webspeech');
      }
    }

    return engines;
  }
}

// ============================================================
// Convenience Hook for React
// ============================================================

/**
 * React hook-like utility for voice recording.
 * Returns a controller object for use in components.
 */
export function createVoiceController(callbacks: RecorderCallbacks) {
  return new VoiceRecorder(callbacks);
}

// Type declarations for Web Speech API
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
