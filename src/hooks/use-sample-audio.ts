"use client";

import { useCallback } from "react";
import { toast } from "./use-toast";

interface UseSampleAudioProps {
    onFileLoaded: (buffer: AudioBuffer, fileName: string) => void;
    onError: (error: string) => void;
    setIsLoading: (loading: boolean) => void;
}

export const useSampleAudio = ({ onFileLoaded, onError, setIsLoading }: UseSampleAudioProps) => {

    const loadSample = useCallback(async (path: string, fileName: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            audioContext.decodeAudioData(
                arrayBuffer,
                (buffer) => {
                    onFileLoaded(buffer, fileName);
                    audioContext.close();
                },
                (error) => {
                    onError(`Error decoding audio data for ${fileName}: ${error.message}`);
                    toast({
                        variant: "destructive",
                        title: `Could not load ${fileName}`,
                        description: `The file might be missing from the /public/audio directory or is corrupted.`,
                    })
                    audioContext.close();
                }
            );

        } catch (e) {
            const error = e as Error;
            onError(`Failed to fetch and process sample ${fileName}: ${error.message}`);
            toast({
                variant: "destructive",
                title: `Could not load ${fileName}`,
                description: `Check if the file exists at ${path} and that the server is running.`,
            })
        }
    }, [onFileLoaded, onError, setIsLoading, toast]);

    return { loadSample };
};
