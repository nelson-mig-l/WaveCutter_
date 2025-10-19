# Wave Cutter - Developer's Guide

This document provides a technical overview of the Wave Cutter project, its architecture, and how its various parts work together. It's intended to help developers get up to speed quickly so they can fix, adjust, and extend the application's functionality.

## Table of Contents

1.  [Project Structure](#project-structure)
2.  [Core Concepts & State Management](#core-concepts--state-management)
3.  [Component Breakdown](#component-breakdown)
    -   `page.tsx` (Main App)
    -   `AudioUploader.tsx`
    -   `WaveformDisplay.tsx`
    -   `SliceControls.tsx`
    -   `SliceList.tsx`
4.  [Audio Processing (`/lib/audio-utils.ts`)](#audio-processing-libaudio-utilsts)
5.  [Styling](#styling)
6.  [How to Extend the App](#how-to-extend-the-app)

---

## Project Structure

The project follows a standard Next.js App Router structure.

```
/
├── public/
│   └── audio/              # Sample .wav files are stored here.
├── src/
│   ├── app/
│   │   ├── globals.css     # Global styles, Tailwind directives, and CSS variables for theming.
│   │   ├── layout.tsx      # Root layout.
│   │   └── page.tsx        # The main component and entry point for the application.
│   ├── components/
│   │   ├── ui/             # Reusable, generic UI components from ShadCN.
│   │   └── wave-cutter/    # Components specific to the Wave Cutter application.
│   ├── hooks/
│   │   ├── use-sample-audio.ts # Logic for loading the pre-defined audio samples.
│   │   └── use-toast.ts    # Toast notification system.
│   └── lib/
│       ├── audio-utils.ts  # Core audio processing functions (slicing, playback, export).
│       ├── types.ts        # TypeScript type definitions (e.g., `Slice`).
│       └── utils.ts        # Utility functions (e.g., `cn` for Tailwind classes).
├── DEV.md                  # This file.
└── README.md               # General user-facing information.
```

---

## Core Concepts & State Management

The application is built around a central state managed in the main `page.tsx` component using React's `useState` hook. This approach keeps the state management simple and centralized for this application's scope.

The key state variables are:

-   `audioBuffer`: An `AudioBuffer` object containing the raw, decoded audio data of the loaded file. It's `null` until a file is loaded.
-   `audioFileName`: The name of the loaded file.
-   `slices`: An array of `Slice` objects. This is the primary data structure representing the user's work. Each slice has a start/end sample, an ID, and a name.
-   `playingSliceId`: A string that tracks which slice (or selection) is currently playing. This is used to highlight the active slice and manage playback controls.
-   `playbackProgress`: A number from 0 to 1 representing the current position of the playback cursor on the main waveform.

These state variables and their corresponding setter functions are passed down as props to the child components.

---

## Component Breakdown

### `page.tsx` (Main App)

This is the orchestrator. It holds all the primary state and the core handler functions.

-   **State:** Manages `audioBuffer`, `slices`, `playingSliceId`, etc.
-   **Handlers:** Contains functions like `handleFileLoaded`, `handleAutoSlice`, `handleManualSlice`, `handlePlayAll`, and `handleDownloadAll`. These functions are passed as props to child components which trigger them based on user interaction.
-   **Layout:** Renders either the `AudioUploader` or the main editor view (Waveform, Slice List) based on whether an `audioBuffer` exists.

### `AudioUploader.tsx`

The initial screen the user sees.
-   Provides two ways to load audio: selecting a pre-loaded sample or using the file input.
-   Uses the `use-sample-audio.ts` hook to fetch and decode the sample breakbeats.
-   Once a file is decoded into an `AudioBuffer`, it calls the `onFileLoaded` prop function from `page.tsx` to lift the state up.

### `WaveformDisplay.tsx`

This is the most complex component. It's responsible for visualizing the audio and handling user interaction on the waveform.

-   **Rendering:** Draws the waveform, slices, and selection onto an HTML5 `<canvas>`.
-   **Zoom & Pan:**
    -   It listens for mouse wheel events to adjust a `zoom` state variable. `e.preventDefault()` is used within a manual event listener (`{passive: false}`) to stop the page from scrolling.
    -   The canvas is placed inside a scrollable `div`. The canvas's width is set dynamically based on the zoom level, which enables native horizontal scrolling.
    -   The `draw` function is memoized with `useCallback` and is re-run whenever `zoom`, `pan`, or other critical data changes.
-   **Selection:** Handles `onMouseDown`, `onMouseMove`, and `onMouseUp` to create a selection region. The coordinates are calculated relative to the canvas, taking the current scroll position and zoom level into account.
-   **Slicing:** When the "Create Slice" button is clicked, it calls the `onSlice` prop with the start and end of the current selection (as percentages of the total duration).

### `SliceControls.tsx`

A simple component that contains the "Auto-Slice" functionality.
-   It has a `Slider` to control the amplitude `threshold` for transient detection.
-   When the "Auto-Slice" button is clicked, it calls the `onAutoSlice` prop with the current threshold value.

### `SliceList.tsx`

Displays the list of created slices and provides controls for each one.

-   **Rendering:** Maps over the `slices` array to render each slice item.
-   **Drag-and-Drop:** Implements drag-and-drop functionality using the native HTML Drag and Drop API to allow reordering of slices.
-   **Slice Controls:** Each slice has buttons for play, loop, duplicate, download, and delete. It also has `Input` fields for renaming the slice and fine-tuning its start/end times.
-   **Playback:** Uses the `playAudio` utility from `audio-utils.ts` to play individual slices.

---

## Audio Processing (`/lib/audio-utils.ts`)

This file contains all the pure, low-level logic for audio manipulation. It has no React dependencies.

-   **`findPeaks`**: The logic for the "Auto-Slice" feature. It iterates through the audio data, detects transients (sudden increases in amplitude above a threshold), and creates slices accordingly.
-   **`bufferToWav`**: A utility function that takes an `AudioBuffer` and encodes it into a `Blob` with a valid WAV file header. This is used for all downloads.
-   **`concatenateAudioBuffers`**: Creates a new `AudioBuffer` by taking the `slices` array and appending the corresponding audio data from the original buffer in the specified order.
-   **`playAudio` / `stopAudio`**: A global player using the Web Audio API. It manages a single `AudioContext` and `AudioBufferSourceNode` to handle all playback requests (full sample, single slice, looped, etc.). It uses `requestAnimationFrame` to provide progress updates for the playback cursor.

---

## Styling

-   **Tailwind CSS:** Used for all layout and utility styling.
-   **ShadCN UI:** Provides the base for most UI components (`Button`, `Slider`, `Input`, etc.). These are located in `/components/ui`.
-   **Retro Theme:** The CRT monitor aesthetic is achieved in `globals.css`.
    -   The color scheme is defined using HSL CSS variables (`--primary`, `--background`, etc.).
    -   The font `VT323` is imported in `layout.tsx`.
    -   A `::after` pseudo-element on the `<body>` creates the scanline overlay.
    -   A `blinking-cursor` animation is defined for the main header.

---

## How to Extend the App

-   **Adding an Audio Effect (e.g., Reverb):**
    1.  In `audio-utils.ts`, you could create a `ConvolverNode` within the `playAudio` function.
    2.  Route the `AudioBufferSourceNode` through the `ConvolverNode` before connecting to the `destination`.
    3.  Add a UI element (e.g., a `Switch` or `Slider`) in a component like `SliceControls.tsx` to control the effect.

-   **Adding a New Export Format (e.g., MP3):**
    1.  This would require a third-party library for MP3 encoding (e.g., `lamejs`).
    2.  You would create a new utility function, like `bufferToMp3`, in `audio-utils.ts`.
    3.  Add a new button or a `Select` dropdown in `page.tsx` to trigger the new export function.

-   **Saving/Loading Projects:**
    1.  The `slices` array is the core of a user's project. You could create functions to serialize this array (along with the original audio file name) to JSON.
    2.  Implement "Save" and "Load" buttons that would download the JSON or read a user-provided JSON file to restore the `slices` state.
