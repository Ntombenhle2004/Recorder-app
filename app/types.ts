export type VoiceNote = {
  id: string;
  name: string;
  uri: string;
  createdAt: number;
  durationMillis: number;
  amplitudes?: number[]; // normalized 0..1 amplitudes for waveform bars
};
