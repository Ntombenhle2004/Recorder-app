import { Text, TouchableOpacity, View } from "react-native";
import type { VoiceNote } from "../types";

function formatTime(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60).toString().padStart(2, "0");
  const s = (totalSec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function VoiceNoteItem({
  item,
  isActive,
  isPlaying,
  positionMillis,
  durationMillis,
  onPlayPause,
  onRename,
  onDelete,
}: {
  item: VoiceNote;
  isActive: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  onPlayPause: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ color: "#000", fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{ color: "#000", opacity: 0.6, marginTop: 2 }}>
            {new Date(item.createdAt).toLocaleString()} • {formatTime(item.durationMillis)}
          </Text>
          {isActive ? (
            <Text style={{ color: "#000", opacity: 0.8, marginTop: 4 }}>
              {formatTime(positionMillis)} / {formatTime(durationMillis)}
            </Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity onPress={onPlayPause} style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#000", borderRadius: 8 }}>
            <Text style={{ color: "#000" }}>{isActive && isPlaying ? "Pause" : "Play"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onRename} style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#000", borderRadius: 8 }}>
            <Text style={{ color: "#000" }}>Rename</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#000", borderRadius: 8 }}>
            <Text style={{ color: "#000" }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
