import React, { useRef, useState, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useLanguageContext } from '../lib/i18n/language-context';
import { useToast } from './toast';

interface VoiceSearchButtonProps {
  onResult?: (transcript: string) => void;
  onTranscript?: (transcript: string) => void;
  className?: string;
  placeholder?: string;
}

function voiceErrorMessage(code: string): string {
  if (code === 'not-allowed' || code === 'permission-denied') {
    return 'Microphone access was denied. Please allow microphone access in your browser settings and try again.';
  }
  if (code === 'no-speech') return "Didn't catch that — no speech detected. Please try again.";
  if (code === 'audio-capture') return 'No microphone was found. Please connect a microphone and try again.';
  if (code === 'network') return 'Network error during voice recognition. Please check your connection and try again.';
  return 'Voice search failed. Please try again or type your search instead.';
}

export const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({ onResult, onTranscript, className = '' }) => {
  const handleResult = onResult || onTranscript || (() => {});
  const { currentLanguage } = useLanguageContext();
  const toast = useToast();
  const [isListening, setIsListening] = useState<boolean>(false);
  const [supported, setSupported] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setSupported(true);
    }
  }, []);

  const handleToggleListen = () => {
    if (!supported) {
      toast.addToast('error', 'Voice search is not supported in this browser. Please try Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      // Stop the real recognition instance too — otherwise it keeps listening
      // in the background even though the UI now shows the idle mic icon.
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
          .webkitSpeechRecognition;

      if (!SpeechRecognition) return;

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = currentLanguage.bcp47 || 'en-IN';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleResult(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = (event: { error: string }) => {
        setIsListening(false);
        // "aborted" fires when the user deliberately stopped listening (handled above) — not a real error.
        if (event.error !== 'aborted') toast.addToast('error', voiceErrorMessage(event.error));
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start voice recognition:', err);
      setIsListening(false);
      toast.addToast('error', 'Could not start voice search. Please try again.');
    }
  };

  return supported ? (
    <button
      type="button"
      onClick={handleToggleListen}
      className={`p-2 rounded-xl transition-all flex items-center justify-center ${
        isListening
          ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/40 scale-105'
          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60'
      } ${className}`}
      title={isListening ? 'Listening... Speak now' : 'Voice Search'}
      aria-label="Voice Search"
    >
      {isListening ? (
        <MicOff className="w-4 h-4 text-white" />
      ) : (
        <Mic className="w-4 h-4 text-red-400 hover:text-red-300" />
      )}
    </button>
  ) : null;
};

// Global Ambient Declarations for SpeechRecognition
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionEvent {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}
