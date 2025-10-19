import type { Slice } from "./types";

/**
 * Finds regions of sound in an AudioBuffer based on an amplitude threshold.
 * @param audioBuffer The AudioBuffer to analyze.
 * @param threshold The amplitude threshold to distinguish sound from silence (0-1).
 * @param _minSilenceDuration Minimum duration of silence in seconds to treat as a separator.
 * @param minSliceDuration Minimum duration of a slice in seconds to be included.
 * @returns An array of Slice objects.
 */
export function findPeaks(
  audioBuffer: AudioBuffer,
  threshold: number,
  _minSilenceDuration: number, // No longer used, but kept for signature compatibility
  minSliceDuration: number
): Slice[] {
  const audioData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const minSliceSamples = minSliceDuration * sampleRate;

  let slices: { start: number; end: number }[] = [];
  let lastSliceEnd = 0;

  for (let i = 1; i < audioData.length; i++) {
    // Detect a transient: silence followed by sound
    if (Math.abs(audioData[i]) > threshold && Math.abs(audioData[i-1]) <= threshold) {
      const sliceStart = lastSliceEnd;
      const sliceEnd = i;

      if (sliceEnd - sliceStart >= minSliceSamples) {
        slices.push({ start: sliceStart, end: sliceEnd });
        lastSliceEnd = sliceEnd;
      }
    }
  }

  // Add the final remaining part of the audio as the last slice
  if (lastSliceEnd < audioData.length && audioData.length - lastSliceEnd >= minSliceSamples) {
    slices.push({ start: lastSliceEnd, end: audioData.length });
  } else if (slices.length > 0) {
    // If the remainder is too small, append it to the last slice
    slices[slices.length - 1].end = audioData.length;
  }

  // If no slices were created (e.g. continuous sound), create one slice for the whole buffer
  if (slices.length === 0 && audioData.length >= minSliceSamples) {
      slices.push({ start: 0, end: audioData.length });
  }


  return slices.map((s, i) => ({
    ...s,
    id: `slice_auto_${Date.now()}_${i}`,
    name: `Slice ${i + 1}`,
  }));
}


/**
 * Encodes an AudioBuffer into a WAV file Blob.
 * @param buffer The AudioBuffer to encode.
 * @returns A Blob representing the WAV file.
 */
export function bufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArray = new ArrayBuffer(length);
  const view = new DataView(bufferArray);
  const channels = [];
  let i, sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true); // write 16-bit sample
      pos += 2;
    }
    offset++;
  }

  return new Blob([view], { type: "audio/wav" });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

/**
 * Concatenates multiple audio slices into a single AudioBuffer.
 * @param originalBuffer The original full AudioBuffer.
 * @param slices An array of Slice objects representing the parts to concatenate.
 * @returns A new AudioBuffer containing the concatenated audio.
 */
export function concatenateAudioBuffers(originalBuffer: AudioBuffer, slices: Slice[]): AudioBuffer {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const totalLength = slices.reduce((sum, slice) => sum + (slice.end - slice.start), 0);
    
    if (totalLength <= 0) {
        throw new Error("No audio data to concatenate.");
    }

    const newBuffer = audioContext.createBuffer(
        originalBuffer.numberOfChannels,
        totalLength,
        originalBuffer.sampleRate
    );

    let offset = 0;
    for (const channel of Array.from({ length: originalBuffer.numberOfChannels }).keys()) {
        const newChannelData = newBuffer.getChannelData(channel);
        offset = 0;
        for (const slice of slices) {
            const segment = originalBuffer.getChannelData(channel).slice(slice.start, slice.end);
            newChannelData.set(segment, offset);
            offset += segment.length;
        }
    }
    audioContext.close();
    return newBuffer;
}

// --- Audio Player ---
let audioContext: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let animationFrameId: number | null = null;
let playbackStartTime = 0;
let playbackStartOffset = 0; // The progress into the full buffer where playback starts
let onProgressGlobal: ((progressInSegment: number) => void) | null = null;
let loopDuration = 0;

function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

function progressLoop() {
  if (source && audioContext && onProgressGlobal) {
    const elapsedTime = audioContext.currentTime - playbackStartTime;

    let progressInSegment = elapsedTime;
    if (source.loop && loopDuration > 0) {
        progressInSegment = elapsedTime % loopDuration;
    }

    onProgressGlobal(progressInSegment);
    animationFrameId = requestAnimationFrame(progressLoop);
  }
}

export function playAudio(
  buffer: AudioBuffer,
  start: number = 0, // in seconds
  duration?: number, // in seconds
  loop: boolean = false,
  onEnded?: () => void,
  onProgress?: (progressInSegment: number) => void
) {
  stopAudio();
  const context = getAudioContext();
  source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.loop = loop;
  
  playbackStartOffset = start;
  const playDuration = duration ?? (buffer.duration - start);
  loopDuration = loop ? playDuration : 0;

  if(loop) {
    source.loopStart = start;
    source.loopEnd = start + playDuration;
  }

  source.onended = () => {
    if (!source?.loop) {
      stopAudio(); // clean up animation frame
      onEnded?.();
    }
  };
  
  source.start(0, start, loop ? undefined : playDuration);
  playbackStartTime = context.currentTime;
  onProgressGlobal = onProgress || null;
  
  if (onProgressGlobal) {
    animationFrameId = requestAnimationFrame(progressLoop);
  }
}

export function stopAudio() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (source) {
    source.onended = null;
    try {
        source.stop();
    } catch(e) {
        // already stopped
    }
    source.disconnect();
    source = null;
  }
  onProgressGlobal = null;
}

    