# Recorder App
Recorder App is a mobile voice recording application built with **Expo and React Native**. It allows users to create, manage, and play back voice notes using their device’s microphone. The app focuses on core CRUD functionality while keeping the interface simple and easy to use.

## Features
- Record audio using the device microphone
- Pause, resume, cancel, and save recordings
- Display a list of saved voice notes
- Play and pause recordings with time progress display
- Rename existing voice notes
- Delete voice notes
- Search voice notes by name
- Persist recordings and metadata locally on the device

## How It Works
- Audio recording and playback are handled using Expo’s audio APIs
- Recordings are saved locally on the device file system
- Metadata (name, duration, creation date) is stored in a JSON file
- The UI is built using reusable React Native components

## Tech Stack
- **Expo SDK 54**
- **React Native**
- **Expo Router** for navigation
- **Expo AV** for audio recording and playback
- **Expo FileSystem** for local storage
- **TypeScript** for type safety

## Project Structure
```
app/
  index.tsx             # Main screen
components/
  RecorderControls.tsx  # Recording controls
  VoiceNoteItem.tsx     # Voice note list item
  RenameModal.tsx       # Rename dialog
  SearchBar.tsx         # Search input
storage.ts              # File system and persistence helpers
types.ts                # VoiceNote type definition
```

## Running the App
```bash
npm install
npm start
```
Run the app using **Expo Go** or an Android/iOS emulator.

## Platform Notes
- Full functionality is available on **Android**
- Web support is limited due to file system and audio restrictions
