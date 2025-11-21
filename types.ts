export interface AnimationFrame {
  id: string;
  dataUrl: string;
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  READY_TO_GENERATE = 'READY_TO_GENERATE',
  GENERATING = 'GENERATING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface GenerationConfig {
  fps: number;
  removeBackground: boolean;
}

export interface CharacterData {
  originalImage: string;
  description: string;
}
