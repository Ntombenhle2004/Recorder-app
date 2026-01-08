import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import type { VoiceNote } from "./types";

export const isWeb = Platform.OS === "web";

export const voicesDir: string = (FileSystem as any).documentDirectory
  ? ((FileSystem as any).documentDirectory as string) + "voices"
  : ((FileSystem as any).cacheDirectory as string) + "voices";

export const metadataPath = voicesDir + "/notes.json";

export async function ensureSetup() {
  if (isWeb) return; // FileSystem is not available on web
  const dir = await FileSystem.getInfoAsync(voicesDir);
  if (!dir.exists) {
    await FileSystem.makeDirectoryAsync(voicesDir, { intermediates: true });
  }
}

export async function loadNotes(): Promise<VoiceNote[]> {
  if (isWeb) return [];
  try {
    const info = await FileSystem.getInfoAsync(metadataPath);
    if (!info.exists) return [];
    const content = await FileSystem.readAsStringAsync(metadataPath);
    const data: VoiceNote[] = JSON.parse(content);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function saveNotes(next: VoiceNote[]): Promise<void> {
  if (isWeb) return;
  await FileSystem.writeAsStringAsync(metadataPath, JSON.stringify(next));
}

export async function deleteFileIfExists(uri: string): Promise<void> {
  if (isWeb) return;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {}
}

export async function getDurationMillis(uri: string): Promise<number> {
  if (isWeb) return 0;
  try {
    const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false });
    const status = await sound.getStatusAsync();
    const dur = "durationMillis" in status && typeof status.durationMillis === "number" ? status.durationMillis : 0;
    await sound.unloadAsync();
    return dur;
  } catch {
    return 0;
  }
}
