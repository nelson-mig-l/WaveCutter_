"use client";

import React, { useCallback } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSampleAudio } from "@/hooks/use-sample-audio";
import { Button } from "../ui/button";
import nextConfig from "../../../next.config";

interface AudioUploaderProps {
  onFileLoaded: (buffer: AudioBuffer, fileName: string) => void;
  onError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const sampleFiles = [
    {
      name: "Amen Break",
      path: nextConfig.assetPrefix + "/audio/amen-break.wav"
    },
    {
      name: "Think Break",
      path: nextConfig.assetPrefix + "/audio/think-break.wav"
    },
    {
      name: "Funky Drummer",
      path: nextConfig.assetPrefix + "/audio/funky-drummer.wav"
    },
];

const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFileLoaded,
  onError,
  isLoading,
  setIsLoading,
}) => {
  const { loadSample } = useSampleAudio({ onFileLoaded, onError, setIsLoading });

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".wav")) {
        onError("Invalid file type. Please upload a .WAV file.");
        return;
      }

      setIsLoading(true);
      const reader = new FileReader();

      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          onError("Could not read file buffer.");
          return;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContext.decodeAudioData(
          arrayBuffer,
          (buffer) => {
            onFileLoaded(buffer, file.name);
            audioContext.close();
          },
          (err) => {
            onError(`Error decoding audio data: ${(err as DOMException).message}`);
            audioContext.close();
          }
        );
      };

      reader.onerror = () => {
        onError("Error reading the file.");
      };

      reader.readAsArrayBuffer(file);
    },
    [onFileLoaded, onError, setIsLoading]
  );

  return (
    <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
      {isLoading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-dashed border-primary rounded-full animate-spin"></div>
          <p className="text-2xl">LOADING AUDIO DATA...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col items-center gap-4">
                <Upload className="w-24 h-24 text-primary/50" />
                <h2 className="text-3xl">Awaiting Audio Input</h2>
                <p className="text-foreground/70 max-w-md">
                    Choose a classic breakbeat or upload your own .WAV file to begin.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                {sampleFiles.map((sample) => (
                    <Button key={sample.name} variant="outline" size="lg" onClick={() => loadSample(sample.path, sample.name)}>
                        {sample.name}
                    </Button>
                ))}
            </div>
            
            <div className="text-foreground/50">-- OR --</div>
            <div>
              <label
                  htmlFor="audio-upload"
                  className={cn(
                  "cursor-pointer border-2 border-dashed border-primary/50 p-8 transition-colors duration-300 w-full max-w-lg text-center hover:border-primary hover:bg-accent block"
                  )}
              >
                  [ CLICK HERE TO UPLOAD A .WAV FILE ]
              </label>
              <input
                  type="file"
                  id="audio-upload"
                  accept=".wav"
                  onChange={handleFileChange}
                  className="hidden"
              />
            </div>

        </div>
      )}
    </div>
  );
};

export default AudioUploader;
