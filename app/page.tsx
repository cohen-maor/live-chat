"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase, type Message } from "@/lib/supabase";
import Image from "next/image";

const ADJECTIVES = [
  "Swift", "Brave", "Calm", "Dark", "Epic", "Fast", "Glad", "Hazy",
  "Icy", "Jade", "Kind", "Lazy", "Mint", "Nice", "Odd", "Pure",
  "Quiet", "Rosy", "Sly", "Tiny", "Vast", "Wild", "Zany",
];
const NOUNS = [
  "Otter", "Panda", "Raven", "Shark", "Tiger", "Viper", "Wolf",
  "Fox", "Bear", "Hawk", "Lion", "Lynx", "Mole", "Newt", "Owl",
  "Pike", "Rat", "Seal", "Toad", "Wasp", "Yak", "Zebu",
];

function getOrCreateUsername(): string {
  const stored = localStorage.getItem("chat_username");
  if (stored) return stored;
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  const name = `${adj}${noun}${num}`;
  localStorage.setItem("chat_username", name);
  return name;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getColor(username: string): string {
  const colors = [
    "text-purple-400", "text-blue-400", "text-green-400",
    "text-yellow-400", "text-pink-400", "text-orange-400", "text-cyan-400",
  ];
  let hash = 0;
  for (const ch of username) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUsername(getOrCreateUsername());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    supabase
      .from("logs")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (data) setMessages(data as Message[]);
      });

    const channel = supabase
      .channel("logs-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "logs" },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || !username) return;
    setText("");
    await supabase.from("logs").insert({
      username,
      message: trimmed,
      type: "text",
    });
  }, [text, username]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!username) return;
      setUploading(true);
      try {
        const ext = file.name.split(".").pop();
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("chat-images")
          .upload(path, file, { contentType: file.type });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("chat-images")
          .getPublicUrl(path);

        await supabase.from("logs").insert({
          username,
          image_url: urlData.publicUrl,
          type: "image",
        });
      } finally {
        setUploading(false);
      }
    },
    [username]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleImageUpload(file);
  };

  return (
    <div
      className="flex flex-col h-full max-w-3xl mx-auto"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight">💬 Live Chat</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              connected
                ? "bg-green-900 text-green-300"
                : "bg-gray-700 text-gray-400"
            }`}
          >
            {connected ? "live" : "connecting…"}
          </span>
        </div>
        {username && (
          <span className="text-sm text-gray-400">
            You are <span className={`font-semibold ${getColor(username)}`}>{username}</span>
          </span>
        )}
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-600 text-sm mt-12">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.username === username;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}
            >
              <span className={`text-xs mb-1 font-medium ${getColor(msg.username)}`}>
                {msg.username}
              </span>
              {msg.type === "text" ? (
                <div
                  className={`max-w-xs sm:max-w-md px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isOwn
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-gray-800 text-gray-100 rounded-bl-sm"
                  }`}
                >
                  {msg.message}
                </div>
              ) : (
                <div className="max-w-xs sm:max-w-sm rounded-2xl overflow-hidden border border-gray-700">
                  <Image
                    src={msg.image_url!}
                    alt="shared image"
                    width={400}
                    height={300}
                    className="object-cover w-full"
                    unoptimized
                  />
                </div>
              )}
              <span className="text-xs text-gray-600 mt-1">
                {formatTime(msg.created_at)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <footer className="px-4 py-3 border-t border-gray-800 bg-gray-900 shrink-0">
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Send image"
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            rows={1}
            className="flex-1 resize-none bg-gray-800 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-32 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={sendText}
            disabled={!text.trim() || uploading}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2 text-center">
          Drag & drop an image anywhere to share it
        </p>
      </footer>
    </div>
  );
}
