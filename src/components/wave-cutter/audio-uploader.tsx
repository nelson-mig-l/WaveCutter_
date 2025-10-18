"use client";

import React, { useRef, useCallback } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioUploaderProps {
  onFileLoaded: (buffer: AudioBuffer, fileName: string) => void;
  onError: (error: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFileLoaded,
  onError,
  isLoading,
  setIsLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropzoneRef = useRef<HTMLLabelElement>(null);
  
  const handleFileChange = async (file: File | null) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".wav")) {
      onError("Invalid file type. Please upload a .WAV file.");
      return;
    }
    
    setIsLoading(true);

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      audioContext.decodeAudioData(
        arrayBuffer,
        (buffer) => {
          onFileLoaded(buffer, file.name);
          audioContext.close();
        },
        (error) => {
          onError(`Error decoding audio data: ${error.message}`);
          audioContext.close();
        }
      );
    } catch (e) {
      const error = e as Error;
      onError(`Failed to process file: ${error.message}`);
    }
  };

  const onDragEnter = useCallback(() => dropzoneRef.current?.classList.add('border-primary', 'bg-accent'), []);
  const onDragLeave = useCallback(() => dropzoneRef.current?.classList.remove('border-primary', 'bg-accent'), []);
  
  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dropzoneRef.current?.classList.remove('border-primary', 'bg-accent');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  }, []);

  return (
    <div className="flex-grow flex flex-col items-center justify-center text-center p-8">
      {isLoading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-dashed border-primary rounded-full animate-spin"></div>
          <p className="text-2xl">LOADING AUDIO DATA...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <Upload className="w-24 h-24 text-primary/50" />
          <h2 className="text-3xl">Awaiting Audio Input</h2>
          <p className="text-foreground/70 max-w-md">
            Upload a .WAV file to begin. Drag and drop a file onto this area or
            click the button below.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleFileChange(e.target.files ? e.target.files[0] : null)}
            accept=".wav"
            className="hidden"
            id="audio-upload"
          />
          <label
            ref={dropzoneRef}
            htmlFor="audio-upload"
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={cn(
              "mt-4 cursor-pointer border-2 border-dashed border-primary/50 p-8 transition-colors duration-300 w-full max-w-lg text-center hover:border-primary hover:bg-accent"
            )}
          >
            [ CLICK OR DRAG .WAV FILE HERE ]
          </label>
        </div>
      )}
    </div>
  );
};

export default AudioUploader;
