/**
 * Minimal type declaration for the vosk module.
 *
 * Vosk is an offline speech recognition toolkit that does not ship its own
 * TypeScript declarations.  We only declare the subset of the API we
 * actually use so the project compiles without installing a separate
 * @types/vosk package.
 */
declare module 'vosk' {
  export class Model {
    constructor(modelPath: string);
    dispose(): void;
  }

  export class Recognizer {
    constructor(model: Model, sampleRate: number);
    setAudio(audioBuffer: ArrayBuffer): void;
    acceptWaveform(audioBuffer: ArrayBuffer): boolean;
    finalResult(): { text?: string };
    partialResult(): { partial?: string };
    reset(): void;
    free(): void;
  }
}
