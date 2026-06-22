'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Sparkles, Trash2, Bot, User, Loader2 } from 'lucide-react';
import ChatInput from '@/components/ChatInput';

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
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);


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
            <ChatInput
              userId={profile.id}
              history={messages.map(m => ({ role: m.role, content: m.content }))}
              isLoading={isLoading}
              onStartLoading={() => {
                setIsLoading(true);
                setErrorMsg(null);
              }}
              onResponseReceived={(userMsgText, assistantResponse) => {
                const userMessage: Message = {
                  id: crypto.randomUUID(),
                  role: 'user',
                  content: userMsgText,
                };
                const assistantMessage: Message = {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  content: assistantResponse,
                };
                setMessages((prev) => [...prev, userMessage, assistantMessage]);
                setIsLoading(false);
                speakText(assistantResponse);
              }}
              onError={(error) => {
                setErrorMsg(error);
                setIsLoading(false);
              }}
              preferredLanguage={profile.preferred_language}
            />
          </footer>
        </div>
      )}
    </div>
  );
}
