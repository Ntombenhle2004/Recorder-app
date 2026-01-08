import { Ionicons } from "@expo/vector-icons";
import type { AVPlaybackStatus } from "expo-av";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RecorderControls from "./components/RecorderControls";
import {
  deleteFileIfExists,
  ensureSetup,
  loadNotes as loadStoredNotes,
  saveNotes as persistNotes,
  voicesDir,
} from "./storage";
import type { VoiceNote } from "./types";

function formatTime(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function Index() {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [search, setSearch] = useState("");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<number | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [renameTarget, setRenameTarget] = useState<VoiceNote | null>(null);
  const [renameText, setRenameText] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [menuTarget, setMenuTarget] = useState<VoiceNote | null>(null);
  const waveformWidthRef = useRef(0);
  const amplitudeSamplesRef = useRef<number[]>([]);

  function nextRecordingName(existing: VoiceNote[]): string {
    // Find highest N where name matches "Recording N"
    let maxN = 0;
    const re = /^Recording\s+(\d+)$/i;
    for (const n of existing) {
      const m = n.name.match(re);
      if (m) {
        const num = parseInt(m[1], 10);
        if (!isNaN(num)) maxN = Math.max(maxN, num);
      }
    }
    return `Recording ${maxN + 1}`;
  }

  async function ensureLoaded(note: VoiceNote, shouldPlay: boolean) {
    if (currentId === note.id && soundRef.current) {
      if (shouldPlay && !isPlaying) {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
      return;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch {}
      soundRef.current = null;
    }
    const { sound } = await Audio.Sound.createAsync(
      { uri: note.uri },
      { shouldPlay: false },
      (status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;
        setDurationMillis(status.durationMillis ?? 0);
        setPositionMillis(status.positionMillis ?? 0);
        setIsPlaying(status.isPlaying ?? false);
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPositionMillis(status.durationMillis ?? 0);
        }
      }
    );
    try {
      await sound.setProgressUpdateIntervalAsync(50);
      await sound.setRateAsync(playbackRate, true);
    } catch {}
    soundRef.current = sound;
    setCurrentId(note.id);
    if (shouldPlay) {
      try {
        await sound.playAsync();
        setIsPlaying(true);
      } catch {}
    }
  }

  useEffect(() => {
    (async () => {
      await ensureSetup();
      const storedNotes = await loadStoredNotes();
      setNotes(storedNotes);
    })();
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [...notes].sort((a, b) => b.createdAt - a.createdAt);
    return [...notes]
      .filter((n) => n.name.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [notes, search]);

  // Storage helpers are imported from ./storage

  async function requestAudioPermissions() {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission required",
        "Please allow microphone access to record."
      );
      throw new Error("mic-permission-denied");
    }
  }

  async function startRecording() {
    try {
      await requestAudioPermissions();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      });
      const rec = new Audio.Recording();
      // enable metering so we can capture amplitude during recording (platform support varies)
      const opts: any = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        ios: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
          extension: ".m4a",
          outputFormat: 2,
          audioQuality: 0,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRateStrategy: 0,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
          meteringEnabled: true,
        },
        android: {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
          extension: ".m4a",
          outputFormat: 2,
          audioEncoder: 3,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 64000,
        },
      };
      try {
        // prepare with metering-enabled options where supported
        await rec.prepareToRecordAsync(opts as any);
      } catch {
        await rec.prepareToRecordAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
      }
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setIsPaused(false);
      amplitudeSamplesRef.current = [];
      try {
        // capture metering periodically; some platforms may not provide metering
        rec.setProgressUpdateInterval(100);
        // @ts-ignore
        rec.setOnRecordingStatusUpdate?.((status: any) => {
          const m = status?.metering ?? status?.meteringPeak ?? undefined;
          if (typeof m === "number" && isFinite(m)) {
            // Expo returns dBFS typically in [-160..0]; normalize to 0..1
            const norm = Math.max(0, Math.min(1, (m + 160) / 160));
            amplitudeSamplesRef.current.push(norm);
          }
        });
      } catch {}
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(
        () => setRecordingDuration((d) => d + 1000),
        1000
      );
    } catch (e) {
      setIsRecording(false);
    }
  }

  async function pauseRecording() {
    if (!recording) return;
    try {
      await recording.pauseAsync();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch {}
  }

  async function resumeRecording() {
    if (!recording) return;
    try {
      await recording.startAsync();
      setIsPaused(false);
      if (!timerRef.current) {
        timerRef.current = setInterval(
          () => setRecordingDuration((d) => d + 1000),
          1000
        );
      }
    } catch {}
  }

  // Cancel current recording and discard the temp file
  async function cancelRecording() {
    if (!recording) return;
    try {
      const tempUri = recording.getURI();
      await recording.stopAndUnloadAsync();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecording(null);
      setIsRecording(false);
      setIsPaused(false);
      setRecordingDuration(0);
      if (tempUri) {
        try {
          await FileSystem.deleteAsync(tempUri, { idempotent: true });
        } catch {}
      }
    } catch {}
  }

  async function stopRecording() {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingDuration(0);
      if (!uri) return;
      const id = `${Date.now()}`;
      const target = `${voicesDir}/${id}.m4a`;
      await FileSystem.moveAsync({ from: uri, to: target });
      const { sound } = await Audio.Sound.createAsync(
        { uri: target },
        { shouldPlay: false }
      );
      const status = await sound.getStatusAsync();
      const dur =
        "durationMillis" in status && typeof status.durationMillis === "number"
          ? status.durationMillis
          : 0;
      await sound.unloadAsync();
      const createdAt = Date.now();
      const name = nextRecordingName(notes);
      // Downsample recorded amplitude samples to a fixed bar count
      const raw = amplitudeSamplesRef.current;
      const BAR_COUNT = 48;
      let amps: number[] | undefined = undefined;
      if (raw && raw.length > 0) {
        const len = raw.length;
        const step = Math.max(1, Math.floor(len / BAR_COUNT));
        const out: number[] = [];
        for (let i = 0; i < len; i += step) {
          const slice = raw.slice(i, Math.min(i + step, len));
          const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
          out.push(avg);
        }
        // ensure exactly BAR_COUNT by resampling/interpolating if necessary
        const scaled: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          const t = (i / (BAR_COUNT - 1)) * (out.length - 1);
          const i0 = Math.floor(t);
          const i1 = Math.min(out.length - 1, i0 + 1);
          const frac = t - i0;
          scaled.push(out[i0] * (1 - frac) + out[i1] * frac);
        }
        // normalize to [0.1..1] to avoid invisible tiny bars
        const min = Math.min(...scaled);
        const max = Math.max(...scaled);
        const norm = scaled.map((v) => {
          const x = max > min ? (v - min) / (max - min) : 0;
          return Math.max(0.1, Math.min(1, x));
        });
        amps = norm;
      }
      const next: VoiceNote[] = [
        {
          id,
          name,
          uri: target,
          createdAt,
          durationMillis: dur,
          amplitudes: amps,
        },
        ...notes,
      ];
      setNotes(next);
      await persistNotes(next);
    } catch {}
  }

  async function playNote(note: VoiceNote) {
    if (currentId === note.id && isPlaying) {
      await pause();
      return;
    }
    if (currentId !== note.id) {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: note.uri },
        { shouldPlay: true },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          setDurationMillis(status.durationMillis ?? 0);
          setPositionMillis(status.positionMillis ?? 0);
          setIsPlaying(status.isPlaying ?? false);
          if (status.didJustFinish) {
            // Stop at end; require manual tap to play again
            setIsPlaying(false);
            setPositionMillis(status.durationMillis ?? 0);
          }
        }
      );
      try {
        await sound.setProgressUpdateIntervalAsync(50);
        await sound.setRateAsync(playbackRate, true);
      } catch {}
      soundRef.current = sound;
      setCurrentId(note.id);
    } else {
      if (soundRef.current) {
        // If we're at or near the end, rewind to start before playing
        try {
          if (
            durationMillis > 0 &&
            positionMillis >= Math.max(0, durationMillis - 30)
          ) {
            await soundRef.current.setPositionAsync(0);
            setPositionMillis(0);
          }
        } catch {}
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    }
  }

  async function pause() {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    }
  }

  async function stopIfPlaying(id?: string) {
    if (currentId && (!id || id === currentId)) {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setIsPlaying(false);
      setCurrentId(null);
      setPositionMillis(0);
      setDurationMillis(0);
    }
  }

  async function deleteNote(note: VoiceNote) {
    await stopIfPlaying(note.id);
    await deleteFileIfExists(note.uri);
    const next = notes.filter((n) => n.id !== note.id);
    setNotes(next);
    await persistNotes(next);
  }

  function openRename(note: VoiceNote) {
    setRenameTarget(note);
    setRenameText(note.name);
  }

  async function confirmRename() {
    if (!renameTarget) return;
    const newName = renameText.trim();
    const next = notes.map((n) =>
      n.id === renameTarget.id ? { ...n, name: newName || n.name } : n
    );
    setNotes(next);
    await persistNotes(next);
    setRenameTarget(null);
    setRenameText("");
  }

  function renderItem({ item }: { item: VoiceNote }) {
    const selected = currentId === item.id;
    const showPos = selected ? positionMillis : 0;
    const BAR_COUNT = 48;
    const minH = 6;
    const maxH = 26;
    const amps =
      item.amplitudes && item.amplitudes.length === BAR_COUNT
        ? item.amplitudes
        : Array.from(
            { length: BAR_COUNT },
            (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 0.55))
          );
    const bars = amps.map((a) => Math.round(minH + a * (maxH - minH)));
    const barsCount = BAR_COUNT;
    // snap playback position to a bar index [0..barsCount-1]
    const progressIndex = durationMillis
      ? Math.max(
          0,
          Math.min(
            barsCount - 1,
            Math.floor((showPos / durationMillis) * barsCount)
          )
        )
      : 0;
    return (
      <View
        style={{
          marginHorizontal: 12,
          marginTop: 12,
          backgroundColor: "#f2f2f2",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#e6e6e6",
          padding: 12,
        }}
      >
        {/* Title row with 3-dots */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{ color: "#0a0a0a", fontSize: 16, fontWeight: "600" }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <TouchableOpacity
                onPress={() => setMenuTarget(item)}
                accessibilityLabel="More options"
              >
                <Ionicons name="ellipsis-vertical" size={18} color="#0a0a0a" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: "#0a0a0a", opacity: 0.6, marginTop: 2 }}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            {/* WhatsApp-like inline player */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 8,
              }}
            >
              {/* Speed pill */}
              <TouchableOpacity
                disabled={isRecording}
                onPress={() => {
                  const order = [1, 1.5, 2];
                  const idx = order.indexOf(playbackRate as 1 | 1.5 | 2);
                  const nextRate = order[(idx + 1) % order.length];
                  setPlaybackRate(nextRate);
                  if (selected && soundRef.current) {
                    soundRef.current
                      .setRateAsync(nextRate, true)
                      .catch(() => {});
                  }
                }}
                style={{
                  backgroundColor: "#d0d7db",
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  marginRight: 8,
                  opacity: isRecording ? 0.4 : 1,
                }}
                accessibilityLabel="Toggle playback speed"
              >
                <Text style={{ color: "#0a0a0a", fontWeight: "700" }}>
                  {playbackRate.toFixed(1)}x
                </Text>
              </TouchableOpacity>

              {/* Play/Pause */}
              <TouchableOpacity
                disabled={isRecording}
                onPress={() => playNote(item)}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#ffffff",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 10,
                  opacity: isRecording ? 0.4 : 1,
                }}
                accessibilityLabel={
                  currentId === item.id && isPlaying
                    ? "Pause playback"
                    : "Play note"
                }
              >
                <Ionicons
                  name={currentId === item.id && isPlaying ? "pause" : "play"}
                  size={22}
                  color="#0a0a0a"
                />
              </TouchableOpacity>

              {/* Waveform with tap/drag seek (continuous) */}
              <View
                style={{ flex: 1, height: 32, justifyContent: "center" }}
                onLayout={(e) => {
                  waveformWidthRef.current = e.nativeEvent.layout.width;
                }}
                onStartShouldSetResponder={() =>
                  !isRecording &&
                  (selected ? durationMillis : item.durationMillis) > 0
                }
                onMoveShouldSetResponder={() =>
                  !isRecording &&
                  (selected ? durationMillis : item.durationMillis) > 0
                }
                onResponderGrant={(e) => {
                  if (isRecording) return;
                  const x = e.nativeEvent.locationX;
                  const w = waveformWidthRef.current || 1;
                  const frac = Math.max(0, Math.min(1, x / w));
                  if (!selected) {
                    const seek = Math.floor(frac * item.durationMillis);
                    ensureLoaded(item, false).then(() => {
                      soundRef.current?.setPositionAsync(seek).catch(() => {});
                      setPositionMillis(seek);
                    });
                    return;
                  }
                  if (!soundRef.current) return;
                  const seek = Math.floor(frac * durationMillis);
                  soundRef.current.setPositionAsync(seek).catch(() => {});
                  setPositionMillis(seek);
                }}
                onResponderMove={(e) => {
                  if (isRecording) return;
                  const x = e.nativeEvent.locationX;
                  const w = waveformWidthRef.current || 1;
                  const frac = Math.max(0, Math.min(1, x / w));
                  if (!selected) {
                    // ignore drag updates on non-selected to avoid auto-playing continuously
                    return;
                  }
                  if (!soundRef.current) return;
                  const seek = Math.floor(frac * durationMillis);
                  soundRef.current.setPositionAsync(seek).catch(() => {});
                  setPositionMillis(seek);
                }}
                onResponderRelease={(e) => {
                  if (isRecording) return;
                  const x = e.nativeEvent.locationX;
                  const w = waveformWidthRef.current || 1;
                  const frac = Math.max(0, Math.min(1, x / w));
                  if (!selected) {
                    const seek = Math.floor(frac * item.durationMillis);
                    ensureLoaded(item, false).then(() => {
                      soundRef.current?.setPositionAsync(seek).catch(() => {});
                      setPositionMillis(seek);
                    });
                    return;
                  }
                  if (!soundRef.current) return;
                  const seek = Math.floor(frac * durationMillis);
                  soundRef.current.setPositionAsync(seek).catch(() => {});
                  setPositionMillis(seek);
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    gap: 1,
                  }}
                >
                  {bars.map((h, idx) => {
                    const filled = selected && idx <= progressIndex;
                    return (
                      <View
                        key={idx}
                        style={{
                          width: 3,
                          height: h,
                          backgroundColor: filled ? "#0a0a0a" : "#cfcfcf",
                          borderRadius: 2,
                        }}
                      />
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Time row under bubble: before play show total, during play show elapsed */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <Text style={{ color: "#0a0a0a", opacity: 0.8 }}>
                {selected && isPlaying
                  ? formatTime(showPos)
                  : formatTime(item.durationMillis)}
              </Text>
              <Text style={{ color: "#0a0a0a", opacity: 0.8 }}>
                {new Date(item.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={{
          paddingTop: 60,
          paddingHorizontal: 16,
          paddingBottom: 12,
          backgroundColor: "#f9f9f9",
          borderBottomWidth: 1,
          borderColor: "#eee",
        }}
      >
        <Text
          style={{
            color: "#000",
            fontSize: 24,
            fontWeight: "700",
            marginBottom: 4,
          }}
        >
          Voice Recorder
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name"
          placeholderTextColor="#666"
          style={{
            marginTop: 12,
            borderWidth: 1,
            borderColor: "#000",
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
            color: "#000",
            backgroundColor: "#fff",
          }}
        />
        <RecorderControls
          isRecording={isRecording}
          isPaused={isPaused}
          duration={recordingDuration}
          onStart={startRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onSave={stopRecording}
          onCancel={cancelRecording}
        />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 80, paddingTop: 8 }}
        ListEmptyComponent={() => (
          <View style={{ padding: 32, alignItems: "center" }}>
            {/* <Text style={{ fontSize: 22, marginBottom: 6 }}>🎙️</Text> */}
            <Text style={{ color: "#000", fontSize: 16, fontWeight: "600" }}>
              No recordings yet
            </Text>
            <Text style={{ color: "#000", opacity: 0.7, marginTop: 4 }}>
              start your recording now!
            </Text>
          </View>
        )}
      />

      <Modal visible={!!renameTarget} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <View
            style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16 }}
          >
            <Text style={{ color: "#000", fontSize: 18, fontWeight: "700" }}>
              Rename
            </Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Enter name"
              placeholderTextColor="#666"
              style={{
                marginTop: 12,
                borderWidth: 1,
                borderColor: "#000",
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: "#000",
              }}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
                marginTop: 16,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  setRenameTarget(null);
                  setRenameText("");
                }}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#000",
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: "#000" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmRename}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  backgroundColor: "#fff",
                  borderWidth: 1,
                  borderColor: "#000",
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: "#000", fontWeight: "700" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Overflow menu for rename/delete */}
      <Modal visible={!!menuTarget} animationType="fade" transparent>
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: "rgba(0,0,0,0.3)",
          }}
        >
          <View style={{ backgroundColor: "#fff", padding: 12 }}>
            <TouchableOpacity
              onPress={() => {
                if (menuTarget) openRename(menuTarget);
                setMenuTarget(null);
              }}
              style={{ paddingVertical: 14 }}
            >
              <Text style={{ color: "#000", fontSize: 16 }}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (menuTarget) {
                  const target = menuTarget;
                  Alert.alert(
                    "Delete recording",
                    `Are you sure you want to delete \"${target.name}\"?`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => deleteNote(target),
                      },
                    ]
                  );
                }
                setMenuTarget(null);
              }}
              style={{ paddingVertical: 14 }}
            >
              <Text style={{ color: "#c00", fontSize: 16 }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuTarget(null)}
              style={{ paddingVertical: 14 }}
            >
              <Text
                style={{ color: "#000", fontSize: 16, textAlign: "center" }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
