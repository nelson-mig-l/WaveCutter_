"use client";

import React, { useRef, useState } from "react";
import type { Slice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Download, GripVertical, Pause, Play, Trash2 } from "lucide-react";
import { bufferToWav, playAudio, stopAudio } from "@/lib/audio-utils";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface SliceListProps {
  slices: Slice[];
  setSlices: React.Dispatch<React.SetStateAction<Slice[]>>;
  audioBuffer: AudioBuffer;
  playingSliceId: string | null;
  setPlayingSliceId: (id: string | null) => void;
}

const SliceList: React.FC<SliceListProps> = ({
  slices,
  setSlices,
  audioBuffer,
  playingSliceId,
  setPlayingSliceId
}) => {
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragItem.current = index;
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragOverItem.current = index;
    e.currentTarget.classList.add('bg-accent');
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('bg-accent');
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove('bg-accent');
    e.currentTarget.style.opacity = '1';
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const newSlices = [...slices];
      const draggedItemContent = newSlices.splice(dragItem.current, 1)[0];
      newSlices.splice(dragOverItem.current, 0, draggedItemContent);
      dragItem.current = null;
      dragOverItem.current = null;
      setSlices(newSlices);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.style.opacity = '1';
  }

  const handleDelete = (id: string) => {
    setSlices(slices.filter((slice) => slice.id !== id));
  };

  const handleNameChange = (id: string, newName: string) => {
    setSlices(
      slices.map((slice) =>
        slice.id === id ? { ...slice, name: newName } : slice
      )
    );
  };

  const handleDownload = (slice: Slice) => {
    const sliceBuffer = audioBuffer.getChannelData(0).slice(slice.start, slice.end);
    const newBuffer = new AudioContext().createBuffer(1, sliceBuffer.length, audioBuffer.sampleRate);
    newBuffer.copyToChannel(sliceBuffer, 0);

    const wavBlob = bufferToWav(newBuffer);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slice.name.replace(/ /g, '_')}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handlePlayToggle = (slice: Slice) => {
    if (playingSliceId === slice.id) {
      stopAudio();
      setPlayingSliceId(null);
    } else {
      stopAudio();
      const startInSeconds = slice.start / audioBuffer.sampleRate;
      const durationInSeconds = (slice.end - slice.start) / audioBuffer.sampleRate;
      playAudio(
        audioBuffer, 
        startInSeconds, 
        durationInSeconds, 
        false, 
        () => setPlayingSliceId(null),
        (progress) => setPlaybackProgress(progress)
      );
      setPlayingSliceId(slice.id);
    }
  };

  if (slices.length === 0) {
      return <div className="flex-grow flex items-center justify-center text-center text-foreground/50">
        <p>No slices created yet.<br/>Use Auto-Slice or select a region on the waveform.</p>
        </div>
  }

  return (
    <ScrollArea className="flex-grow">
      <div className="flex flex-col gap-2 pr-4">
        {slices.map((slice, index) => (
          <div
            key={slice.id}
            className="flex items-center gap-2 border border-primary/30 p-2 transition-all relative"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnter={(e) => handleDragEnter(e, index)}
            onDragLeave={handleDragLeave}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          >
            {playingSliceId === slice.id && (
              <div
                className="absolute top-0 left-0 h-full bg-primary/20 pointer-events-none"
                style={{
                  width: `${((playbackProgress * audioBuffer.duration - (slice.start / audioBuffer.sampleRate)) / ((slice.end - slice.start) / audioBuffer.sampleRate)) * 100}%`
                }}
              />
            )}
            <GripVertical className="cursor-grab text-primary/50" />
            <Input
              value={slice.name}
              onChange={(e) => handleNameChange(slice.id, e.target.value)}
              className="bg-transparent border-0 focus-visible:ring-1 focus-visible:ring-ring text-base z-10"
            />
            <Button variant="ghost" size="icon" onClick={() => handlePlayToggle(slice)} className="z-10">
              {playingSliceId === slice.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => handleDownload(slice)} className="z-10">
              <Download className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/20 z-10">
                    <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the slice "{slice.name}". This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(slice.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

export default SliceList;
