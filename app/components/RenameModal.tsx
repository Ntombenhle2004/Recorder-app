import { Modal, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function RenameModal({
  visible,
  value,
  onChange,
  onCancel,
  onSave,
}: {
  visible: boolean;
  value: string;
  onChange: (t: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16 }}>
          <Text style={{ color: "#000", fontSize: 18, fontWeight: "700" }}>Rename</Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Enter name"
            placeholderTextColor="#666"
            style={{ marginTop: 12, borderWidth: 1, borderColor: "#000", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: "#000" }}
          />
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
            <TouchableOpacity onPress={onCancel} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#000", borderRadius: 10 }}>
              <Text style={{ color: "#000" }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSave} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#000", borderRadius: 10 }}>
              <Text style={{ color: "#000", fontWeight: "700" }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
