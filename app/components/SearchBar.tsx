import { TextInput } from "react-native";

export default function SearchBar({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Search by name"
      placeholderTextColor="#666"
      style={{ marginTop: 12, borderWidth: 1, borderColor: "#000", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: "#000", backgroundColor: "#fff" }}
    />
  );
}
