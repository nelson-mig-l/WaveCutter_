"use client";

import { useState } from "react";
import type { Slice } from "@/lib/types";
import { findPeaks, bufferToWav, concatenateAudioBuffers } from "@/lib/audio-utils";

import Header from "@/components/wave-cutter/header";
import AudioUploader from "@/components/wave-cutter/audio-uploader";
import WaveformDisplay from "@/components/wave-cutter/waveform-display";
import SliceControls from "@/components/wave-cutter/slice-controls";
import SliceList from "@/components/wave-cutter/slice-list";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ArrowUp, Music } from "lucide-react";

export default function Home() {
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>("");
  const [slices, setSlices] = useState<Slice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFileLoaded = (buffer: AudioBuffer, fileName: string) => {
    setAudioBuffer(buffer);
    setAudioFileName(fileName);
    setSlices([]);
    setIsLoading(false);
  };

  const handleFileError = (error: string) => {
    toast({
      variant: "destructive",
      title: "Error loading file",
      description: error,
    });
    setIsLoading(false);
  };

  const handleAutoSlice = (threshold: number) => {
    if (!audioBuffer) return;
    try {
      const newSlices = findPeaks(audioBuffer, threshold / 100, 0.1, 0.05);
      setSlices(newSlices);
      toast({
        title: "Auto-slicing complete",
        description: `Found ${newSlices.length} slices.`,
      });
    } catch (e) {
      const error = e as Error;
      toast({
        variant: "destructive",
        title: "Auto-slicing failed",
        description: error.message,
      });
    }
  };

  const handleManualSlice = (start: number, end: number) => {
    if (!audioBuffer) return;
    const newSlice: Slice = {
      id: `slice_${Date.now()}`,
      start: Math.floor(start * audioBuffer.sampleRate),
      end: Math.floor(end * audioBuffer.sampleRate),
      name: `Slice ${slices.length + 1}`,
    };
    setSlices([...slices, newSlice].sort((a, b) => a.start - b.start));
  };

  const handleDownloadAll = () => {
    if (!audioBuffer || slices.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing to download",
        description: "Please create some slices first.",
      });
      return;
    }
    try {
      const finalBuffer = concatenateAudioBuffers(audioBuffer, slices);
      const wavBlob = bufferToWav(finalBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${audioFileName.replace(".wav", "")}_rearranged.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const error = e as Error;
      toast({
        variant: "destructive",
        title: "Download failed",
        description: error.message,
      });
    }
  };
  
  const resetApp = () => {
    setAudioBuffer(null);
    setAudioFileName("");
    setSlices([]);
  }

  return (
    <div className="min-h-screen container mx-auto p-4 md:p-8 flex flex-col gap-6">
      <Header />
      <main className="flex-grow flex flex-col gap-6">
        {!audioBuffer ? (
          <AudioUploader
            onFileLoaded={handleFileLoaded}
            onError={handleFileError}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
            <div className="lg:col-span-2 flex flex-col gap-4 border border-primary/50 p-4">
               <div className="flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <Music />
                    <p className="text-xl">{audioFileName}</p>
                 </div>
                 <Button variant="destructive" size="sm" onClick={resetApp}>Change File</Button>
               </div>
              <WaveformDisplay
                audioBuffer={audioBuffer}
                slices={slices}
                onSlice={handleManualSlice}
              />
              <SliceControls
                onAutoSlice={handleAutoSlice}
                onClearSlices={() => setSlices([])}
                onDownloadAll={handleDownloadAll}
                hasSlices={slices.length > 0}
              />
            </div>
            <div className="border border-primary/50 p-4 flex flex-col gap-4">
              <h2 className="text-2xl flex items-center gap-2">
                <ArrowUp className="transform rotate-45" /> Slices
              </h2>
              <SliceList
                slices={slices}
                setSlices={setSlices}
                audioBuffer={audioBuffer}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
