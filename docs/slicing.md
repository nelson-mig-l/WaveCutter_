# Auto-Slicing Logic in Wave Cutter

This document explains the transient-based approach used for the "Auto-Slice" feature in the Wave Cutter application. The core logic resides in the `findPeaks` function within the `src/lib/audio-utils.ts` file.

## Core Concept: Transient Detection

The auto-slicing algorithm is not based on finding "peaks" in the traditional sense of the highest amplitude points. Instead, it operates by detecting **transients**. A transient is a sudden, sharp increase in audio amplitude, which usually marks the beginning of a new sound event (like a drum hit).

The algorithm identifies a transient by looking for a point where the audio signal crosses from a state of relative silence into a state of sound.

## The Algorithm Step-by-Step

The `findPeaks` function iterates through the raw audio data (the samples) of a single channel, from beginning to end. Here's what it does at each step:

1.  **Define a Threshold**: The user provides an amplitude `threshold` via the slider (from 0% to 100%, which is translated to a value between 0.0 and 1.0). This threshold determines what the algorithm considers "sound" versus "silence".

2.  **Iterate and Compare**: The algorithm moves one sample at a time, comparing the amplitude of the current sample (`audioData[i]`) with the amplitude of the previous sample (`audioData[i-1]`).

3.  **Identify a Transient**: A transient is detected when the following condition is met:
    *   The absolute amplitude of the **previous sample** is **less than or equal to** the threshold.
    *   AND, the absolute amplitude of the **current sample** is **greater than** the threshold.

    This condition effectively pinpoints the exact moment the waveform "jumps" from below the silence threshold to above it.

4.  **Create a Slice**: When a transient is found at position `i`:
    *   A new slice is created.
    *   The slice's **start point** is the `end point` of the *previous* slice. (For the very first slice, the start point is 0).
    *   The slice's **end point** is the current position `i` where the transient was detected.
    *   This new end point is then stored to be used as the start point for the *next* slice.

5.  **Handle the Remainder**: After the loop finishes, the portion of audio from the last detected transient to the very end of the file is created as the final slice.

6.  **Filter by Duration**: Any potential slices that are shorter than a minimum duration (currently hardcoded to `0.05` seconds) are discarded to avoid creating tiny, unusable micro-slices.

### Visual Example

Imagine the threshold is set to 20% (0.2).

```
          /-----\
         /       \
--------/         \------------/\----------
        ^           ^          ^
        |           |          |
    Slice 1 End /   |      Slice 2 End /
    Slice 2 Start   |      Slice 3 Start
                    |
              (Amplitude drops
              below threshold)
```

-   The algorithm moves along the flat "silent" line.
-   At the first `^`, the amplitude jumps above the 20% threshold. A transient is detected. A slice is created from the beginning of the file (or the last slice's end) to this point.
-   The algorithm continues. The amplitude stays above the threshold.
-   The amplitude then drops below the threshold. The algorithm is now back in a "silent" state.
-   At the second `^`, the amplitude again jumps above the threshold. A new transient is detected, and a new slice is created from the previous transient's location to this new one.

This simple but effective method works well for percussive material like breakbeats, where each drum hit is preceded by a brief moment of relative quiet.
