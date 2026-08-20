"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageSquare, Plus, Trash2, Menu, X, Send, Paperclip, FileText, Loader2, Bot, User, BookOpen, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import { useTheme } from "next-themes";

const API_URL = "http://localhost:5000";

interface Message {
  role: "user" | "assistant";
  content: string;
  chunksUsed?: number[];
}

interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface KnowledgeDoc {
  id: string;
  filename: string;
  status: string;
  chunk_count: number;
  error_msg?: string;
}

export default function ChatPage() {
  const { theme, setTheme } = useTheme();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [ragEnabled, setRagEnabled] = useState(true);
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchSessions();
    fetchDocuments();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/api/session/sessions`);
      if (res.ok) setSessions(await res.json());
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/documents`);
      if (res.ok) setDocuments(await res.json());
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  const createNewSession = async () => {
    try {
      const res = await fetch(`${API_URL}/api/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (res.ok) {
        const session = await res.json();
        setSessions((prev) => [session, ...prev]);
        setCurrentSessionId(session.id);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  const loadSession = async (sessionId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/session/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentSessionId(sessionId);
        setMessages(
          data.messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const deleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`${API_URL}/api/session/${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    let sessionId = currentSessionId;

    if (!sessionId) {
      try {
        const res = await fetch(`${API_URL}/api/session/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: userMessage.slice(0, 50) }),
        });
        if (res.ok) {
          const session = await res.json();
          sessionId = session.id;
          setCurrentSessionId(sessionId);
          setSessions((prev) => [session, ...prev]);
        }
      } catch {
        setIsLoading(false);
        return;
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/session/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage, ragEnabled }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) return;

      let aiResponse = "";
      let chunksUsed: number[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "ai_response") {
              aiResponse = data.text;
              chunksUsed = data.chunksUsed || [];
              setMessages((prev) => {
                const newMsgs = [...prev];
                const lastIdx = newMsgs.length - 1;
                if (newMsgs[lastIdx]?.role === "assistant") {
                  newMsgs[lastIdx] = { role: "assistant", content: aiResponse, chunksUsed };
                } else {
                  newMsgs.push({ role: "assistant", content: aiResponse, chunksUsed });
                }
                return newMsgs;
              });
            } else if (data.type === "error") {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: "Sorry, something went wrong. Please try again." },
              ]);
            }
          } catch {}
        }
      }

      fetchSessions();
    } catch (err) {
      console.error("Failed to send message:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Connection error. Is the backend running?" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_URL}/api/admin/upload`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const doc = await res.json();
        setDocuments((prev) => [...prev, { ...doc, filename: file.name, status: "processing", chunk_count: 0 }]);

        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`${API_URL}/api/admin/documents/${doc.id}/status`);
            if (statusRes.ok) {
              const status = await statusRes.json();
              setDocuments((prev) =>
                prev.map((d) => (d.id === doc.id ? { ...d, status: status.stage, chunk_count: status.totalChunks || 0, error_msg: status.error } : d))
              );
              if (status.stage === "COMPLETED" || status.stage === "FAILED") {
                clearInterval(pollInterval);
                fetchDocuments();
              }
            }
          } catch {}
        }, 1200);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteDocument = async (docId: string) => {
    try {
      await fetch(`${API_URL}/api/admin/documents/${docId}`, { method: "DELETE" });
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const suggestions = [
    "Explain the quadratic formula",
    "What are Newton's laws of motion?",
    "Help me solve this integral",
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-300 overflow-hidden border-r border-border flex flex-col`}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              History
            </h2>
            <div className="flex gap-1">
              <Tooltip>
                <TooltipTrigger
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground"
                  onClick={createNewSession}
                >
                  <Plus className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>New Chat</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No conversations yet</p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors group flex items-center justify-between ${
                    currentSessionId === session.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  <span className="truncate flex-1">{session.title}</span>
                  <Tooltip>
                    <TooltipTrigger
                      className="h-6 w-6 inline-flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent hover:text-accent-foreground"
                      onClick={(e) => deleteSession(session.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <h1 className="text-base font-semibold flex-1">AI Assistant</h1>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </TooltipTrigger>
              <TooltipContent>{theme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
            </Tooltip>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted-foreground">RAG</span>
              <button
                type="button"
                role="switch"
                aria-checked={ragEnabled}
                onClick={() => setRagEnabled(!ragEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors ${
                  ragEnabled ? "bg-primary" : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                    ragEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </label>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-medium mb-2">Hello, I&apos;m your AIGO Tutor</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Ask me anything about your courses. I&apos;ll use your uploaded material to help explain.
                </p>
                <div className="flex flex-col gap-2 max-w-xs mx-auto">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors text-left"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-3 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === "user" ? "bg-primary" : "bg-primary/10"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-4 w-4 text-primary-foreground" />
                    ) : (
                      <Bot className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div
                    className={`rounded-lg px-4 py-2 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-end-sm"
                        : "bg-muted text-foreground rounded-end-sm"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeHighlight, rehypeKatex, rehypeRaw]}
                          components={{
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-2">
                                <table className="border-collapse border border-border text-sm">{children}</table>
                              </div>
                            ),
                            th: ({ children }) => (
                              <th className="border border-border px-3 py-1.5 bg-muted font-semibold text-left">{children}</th>
                            ),
                            td: ({ children }) => (
                              <td className="border border-border px-3 py-1.5">{children}</td>
                            ),
                            pre: ({ children }) => (
                              <pre className="overflow-x-auto rounded-md bg-muted p-3 my-2 text-xs">{children}</pre>
                            ),
                            code: ({ className, children, ...props }) => {
                              const isInline = !className;
                              if (isInline) {
                                return <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{children}</code>;
                              }
                              return <code className={className} {...props}>{children}</code>;
                            },
                            ul: ({ children }) => <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>,
                            li: ({ children }) => <li>{children}</li>,
                            h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                            p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-primary pl-3 italic my-2 text-muted-foreground">{children}</blockquote>
                            ),
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>
                            ),
                            hr: () => <hr className="my-3 border-border" />,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    {msg.chunksUsed && msg.chunksUsed.length > 0 && (
                      <p className="text-xs mt-2 opacity-60 flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> Grounded in course material
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2 rounded-end-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Knowledge Base Bar */}
        {ragEnabled && currentSessionId && (
          <div className="border-t border-border px-4 py-3">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="sr-only"
                    accept=".pdf,.txt,.csv,.doc,.docx"
                    multiple
                    onChange={(e) => {
                      Array.from(e.target.files || []).forEach(handleFileUpload);
                      e.target.value = "";
                    }}
                  />
                  <div className="w-8 h-8 border-2 border-dashed border-border rounded-lg flex items-center justify-center hover:border-primary/50 transition-colors">
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </label>
                <span className="text-xs text-muted-foreground">Add documents to knowledge base</span>
              </div>

              {documents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {documents.map((doc) => (
                    <Badge
                      key={doc.id}
                      variant="outline"
                      className={`text-xs ${
                        doc.status === "failed" ? "border-destructive text-destructive" : ""
                      }`}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      {doc.filename}
                      {doc.status === "processing" && (
                        <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                      )}
                      {doc.status === "indexed" && <span className="ml-1">({doc.chunk_count})</span>}
                      {doc.status === "failed" && (
                        <span className="ml-1 text-destructive">{doc.error_msg}</span>
                      )}
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
