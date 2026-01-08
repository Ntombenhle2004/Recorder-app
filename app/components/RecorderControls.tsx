import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // millis
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onSave: () => void;
  onCancel: () => void;
};

export default function RecorderControls({
  isRecording,
  isPaused,
  duration,
  onStart,
  onPause,
  onResume,
  onSave,
  onCancel,
}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.timer}>{formatTime(duration)}</Text>
      <View style={styles.controls}>
        {!isRecording && (
          <TouchableOpacity onPress={onStart} accessibilityLabel="Start recording">
            <Ionicons name="mic" size={32} color="#000" />
          </TouchableOpacity>
        )}

        {isRecording && !isPaused && (
          <>
            <TouchableOpacity onPress={onCancel} accessibilityLabel="Cancel recording">
              <Ionicons name="trash" size={28} color="#c00" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onPause} accessibilityLabel="Pause recording">
              <Ionicons name="pause" size={32} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} accessibilityLabel="Save recording">
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Save</Text>
            </TouchableOpacity>
          </>
        )}

        {isPaused && (
          <>
            <TouchableOpacity onPress={onCancel} accessibilityLabel="Cancel recording">
              <Ionicons name="trash" size={28} color="#c00" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onResume} accessibilityLabel="Resume recording">
              <Ionicons name="play" size={32} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} accessibilityLabel="Save recording">
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Save</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 12,
  },
  timer: {
    fontSize: 20,
    fontWeight: "700",
    color: "#000",
    marginBottom: 10,
  },
  controls: {
    flexDirection: "row",
    gap: 24,
    alignItems: "center",
  },
});
