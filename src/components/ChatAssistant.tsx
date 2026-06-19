'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Send, Sparkles, Trash2, Bot, User, Loader2, Mic, MicOff } from 'lucide-react';

interface ChatAssistantProps {
  profile: {
    id: string;
    full_name: string;
    role: 'retailer' | 'customer';
    preferred_language: 'hi' | 'en';
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export default function ChatAssistant({ profile }: ChatAssistantProps) {
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lang = profile.preferred_language;

  // Language definitions
  const text = {
    title: lang === 'hi' ? 'खातामित्र एआई' : 'KhataMitra AI',
    subtitle: lang === 'hi' ? 'द्विभाषी वित्तीय सहायक' : 'Bilingual Financial Assistant',
    placeholder: lang === 'hi' ? 'संदेश टाइप करें या बोलें...' : 'Type a message or speak...',
    clearTooltip: lang === 'hi' ? 'चैट साफ़ करें' : 'Clear Chat history',
    demoTip: lang === 'hi' ? 'पूछें: "रामू का बैलेंस क्या है?" या "250+400 जोड़ो"' : 'Ask: "What is Ramu\'s balance?" or "calculate 250+400"',
    emptyState: lang === 'hi' ? 'नमस्ते! मैं आपका खातामित्र एआई हूँ। उधार/जमा दर्ज करने या बैलेंस पूछने के लिए यहाँ लिखें या माइक दबाकर बोलें।' : 'Hello! I am your KhataMitra AI. Speak or type here to record credits/debits or check balances.',
  };

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Load chat history from supabase
  useEffect(() => {
    async function loadHistory() {
      if (!isOpen || messages.length > 0) return;
      setIsHistoryLoading(true);
      try {
        const { data: logs, error } = await supabase
          .from('chat_logs')
          .select('id, role, message, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: true });

        if (error) throw error;

        if (logs) {
          const formattedLogs: Message[] = logs.map((log) => ({
            id: log.id,
            role: log.role as 'user' | 'assistant',
            content: log.message,
            created_at: log.created_at || undefined,
          }));
          setMessages(formattedLogs);
        }
      } catch (err) {
        console.error('Error fetching chat history:', err);
      } finally {
        setIsHistoryLoading(false);
      }
    }

    loadHistory();
  }, [isOpen, profile.id, supabase, messages.length]);

  // Clean up recording states on unmount
  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    };
  }, []);

  // Text-To-Speech voice feedback
  const speakText = (textToSpeak: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';

      // Attempt to load Indian localized speech engine voices
      const voices = window.speechSynthesis.getVoices();
      const targetVoice = voices.find(v => v.lang.startsWith(lang === 'hi' ? 'hi' : 'en'));
      if (targetVoice) {
        utterance.voice = targetVoice;
      }
      window.speechSynthesis.speak(utterance);
    }
  };

  // Start voice input capture
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          await sendVoiceMessage(base64Audio);
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setErrorMsg(null);

      // Enforce 10 seconds limit automatically
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, 10000);
    } catch (err) {
      console.error('Error starting recording:', err);
      setErrorMsg(lang === 'hi' ? 'माइक्रोफ़ोन अनुमति अस्वीकृत या उपलब्ध नहीं है।' : 'Microphone permission denied or unavailable.');
    }
  };

  // Stop voice input capture
  const stopRecording = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // POST captured base64 audio data
  const sendVoiceMessage = async (base64Audio: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: lang === 'hi' ? '[आवाज संदेश भेजा गया]' : '[Voice Message Sent]',
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/voice-assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: 'audio/wav',
          userId: profile.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server responded with an error');
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      speakText(data.response);
    } catch (err) {
      console.error('Error in voice chat:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong with voice processing.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle message send
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessageText = input.trim();
    setInput('');
    setErrorMsg(null);

    // Add user message locally
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessageText,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessageText,
          userId: profile.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server responded with an error');
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      speakText(data.response);
    } catch (err) {
      console.error('Error in chat:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsLoading(false);
    }
  };

  // Clear chat logs
  const handleClearChat = async () => {
    if (!confirm(lang === 'hi' ? 'क्या आप निश्चित रूप से संपूर्ण इतिहास मिटाना चाहते हैं?' : 'Are you sure you want to clear your chat history?')) return;
    try {
      const { error } = await supabase
        .from('chat_logs')
        .delete()
        .eq('user_id', profile.id);

      if (error) throw error;
      setMessages([]);
    } catch (err) {
      console.error('Error deleting chat logs:', err);
      alert('Failed to clear chat.');
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3.5 rounded-full bg-gradient-to-r from-brand-600 to-violet-600 hover:from-brand-500 hover:to-violet-500 text-white font-bold shadow-lg shadow-brand-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        >
          <Sparkles className="h-5 w-5 animate-pulse group-hover:rotate-12 transition-transform" />
          <span className="text-sm tracking-tight hidden sm:inline">{text.title}</span>
        </button>
      )}

      {/* Chat Window Panel */}
      {isOpen && (
        <div className="w-[360px] sm:w-[400px] h-[500px] bg-white dark:bg-[#121218] rounded-2xl border border-zinc-200 dark:border-zinc-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] flex flex-col overflow-hidden animate-slide-up">
          
          {/* Header */}
          <header className="px-4 py-3 bg-gradient-to-r from-brand-600 to-violet-600 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Bot className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold tracking-tight leading-none">{text.title}</h3>
                <span className="text-[10px] text-zinc-100/80 font-medium">{text.subtitle}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  title={text.clearTooltip}
                  className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 text-zinc-100 hover:text-white" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </header>

          {/* Messages Scroll Area */}
          <main className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/20">
            {isHistoryLoading ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin text-brand-500 mb-2" />
                <span className="text-xs font-semibold">Loading chat history...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="h-12 w-12 rounded-full bg-brand-50 dark:bg-brand-950/20 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-brand-500" />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                  {text.emptyState}
                </p>
                <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 text-[10px] text-zinc-400 font-semibold tracking-wide">
                  {text.demoTip}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 max-w-[85%] ${
                      msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    }`}
                  >
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-brand-600 text-white'
                          : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Bot className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed font-medium shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-gradient-to-tr from-brand-600 to-violet-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-[#1b1b24] text-zinc-800 dark:text-zinc-100 border border-zinc-150 dark:border-zinc-800/80 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {isLoading && (
                  <div className="flex items-start gap-2 max-w-[85%] mr-auto">
                    <div className="h-7 w-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5 text-zinc-500" />
                    </div>
                    <div className="p-3 bg-white dark:bg-[#1b1b24] text-zinc-500 rounded-2xl rounded-tl-none border border-zinc-150 dark:border-zinc-800/85 shadow-sm flex items-center gap-1.5">
                      <span className="flex h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.3s]" />
                      <span className="flex h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.15s]" />
                      <span className="flex h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </main>

          {/* Form Input Area */}
          <footer className="p-3 border-t border-zinc-150 dark:border-zinc-800/80 bg-white dark:bg-[#121218] space-y-2">
            {errorMsg && (
              <div className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/10 p-2 rounded-lg border border-red-200/50">
                {errorMsg}
              </div>
            )}
            <div className="flex gap-2 items-center">
              
              {/* Mic Icon Button */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                title={isRecording ? 'Recording... click to stop' : 'Record voice message (max 10s)'}
                className={`h-8.5 w-8.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                  isRecording 
                    ? 'bg-red-500 border-red-600 text-white animate-pulse'
                    : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <form onSubmit={handleSend} className="flex-1 flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading || isRecording}
                  placeholder={isRecording ? 'Listening/सुन रहा हूँ (max 10s)...' : text.placeholder}
                  className="flex-1 px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1.5 focus:ring-brand-500 transition-all disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim() || isRecording}
                  className="h-8.5 w-8.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white flex items-center justify-center shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
