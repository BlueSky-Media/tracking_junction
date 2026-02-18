import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  SendHorizontal,
  Brain,
  Database,
  MessageSquare,
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

interface Conversation {
  id: number;
  title: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  role: string;
  content: string;
  createdAt: string;
}

interface AdAccount {
  id: string;
  name: string;
  account_id: string;
}

interface NormalizedInsight {
  campaignId?: string;
  campaignName?: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  frequency: number;
  leads: number;
  costPerLead: number;
  linkClicks: number;
  outboundClicks: number;
  thruPlays: number;
  searches: number;
  contacts: number;
  dateStart: string;
  dateStop: string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-muted/50 rounded-md p-2 my-2 overflow-x-auto text-xs"><code>$1</code></pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\s*#{3}\s+(.+)$/gm, '<h3 class="font-semibold text-sm mt-2 mb-1">$1</h3>')
    .replace(/^\s*#{2}\s+(.+)$/gm, '<h2 class="font-semibold text-base mt-3 mb-1">$1</h2>')
    .replace(/^\s*#{1}\s+(.+)$/gm, '<h1 class="font-bold text-lg mt-3 mb-1">$1</h1>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc my-1">$&</ul>')
    .replace(/\n/g, '<br/>');
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function formatDataContext(data: NormalizedInsight[]): string {
  if (!data || data.length === 0) return "";
  const header = "Campaign | Spend | Impressions | Clicks | CTR | CPC | Leads | CPL | Link Clicks | Outbound Clicks | ThruPlays | Frequency";
  const divider = "---|---|---|---|---|---|---|---|---|---|---|---";
  const rows = data.map((r) => {
    const name = r.campaignName || r.campaignId || "Unknown";
    const cpl = r.leads > 0 ? `$${(r.spend / r.leads).toFixed(2)}` : "-";
    return `${name} | $${r.spend.toFixed(2)} | ${r.impressions.toLocaleString()} | ${r.clicks.toLocaleString()} | ${r.ctr.toFixed(2)}% | $${r.cpc.toFixed(2)} | ${r.leads} | ${cpl} | ${r.linkClicks} | ${r.outboundClicks} | ${r.thruPlays} | ${r.frequency.toFixed(2)}`;
  });
  const dateRange = data.length > 0 ? `Date Range: ${data[0].dateStart} to ${data[0].dateStop}` : "";
  return `${dateRange}\n\n${header}\n${divider}\n${rows.join("\n")}`;
}

export default function AiAdvisorPage() {
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [dataContext, setDataContext] = useState("");
  const [dataDialogOpen, setDataDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [dateRange, setDateRange] = useState("7");
  const [insightsOpen, setInsightsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversationsList, isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/chat/conversations"],
  });

  const activeConversation = conversationsList?.find((c) => c.id === activeConversationId);

  const { data: messagesList, isLoading: msgsLoading } = useQuery<Message[]>({
    queryKey: ["/api/chat/conversations", activeConversationId, "messages"],
    enabled: !!activeConversationId,
    queryFn: async () => {
      const res = await fetch(`/api/chat/conversations/${activeConversationId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const { data: adAccounts } = useQuery<AdAccount[]>({
    queryKey: ["/api/facebook/ad-accounts"],
  });

  const { data: insightsData, isLoading: insightsLoading, refetch: refetchInsights } = useQuery<{ insights: string }>({
    queryKey: ["/api/chat/insights", dataContext],
    enabled: false,
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/chat/insights", { dataContext });
      return res.json();
    },
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/chat/conversations", { title: "New Conversation" });
      return res.json() as Promise<Conversation>;
    },
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      setActiveConversationId(conv.id);
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/chat/conversations/${id}`);
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
      if (activeConversationId === id) {
        setActiveConversationId(null);
      }
    },
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messagesList, streamingContent, scrollToBottom]);

  const sendMessage = useCallback(async () => {
    if (!inputValue.trim() || !activeConversationId || isStreaming) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsStreaming(true);
    setStreamingContent("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    queryClient.setQueryData<Message[]>(
      ["/api/chat/conversations", activeConversationId, "messages"],
      (old) => [
        ...(old || []),
        {
          id: Date.now(),
          conversationId: activeConversationId,
          role: "user",
          content: userMessage,
          createdAt: new Date().toISOString(),
        },
      ]
    );

    try {
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: userMessage,
          dataContext,
        }),
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "chunk") {
                fullText += data.text;
                setStreamingContent(fullText);
              }
              if (data.type === "title") {
                queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
              }
              if (data.type === "done") {
                setIsStreaming(false);
                setStreamingContent("");
                queryClient.invalidateQueries({
                  queryKey: ["/api/chat/conversations", activeConversationId, "messages"],
                });
                queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
              }
              if (data.type === "error") {
                setIsStreaming(false);
                setStreamingContent("");
              }
            } catch {}
          }
        }
      }
    } catch {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [inputValue, activeConversationId, isStreaming, dataContext, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    const lineHeight = 20;
    const maxHeight = lineHeight * 4;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  const loadAdData = async () => {
    if (!selectedAccount || !dateRange) return;
    const now = new Date();
    const days = parseInt(dateRange);
    const start = new Date(now.getTime() - days * 86400000);
    const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    try {
      const res = await fetch(
        `/api/facebook/campaigns?adAccountId=${selectedAccount}&startDate=${startDate}&endDate=${endDate}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error(await res.text());
      const data: NormalizedInsight[] = await res.json();
      const ctx = formatDataContext(data);
      setDataContext(ctx);
      setDataDialogOpen(false);
    } catch {}
  };

  useEffect(() => {
    if (dataContext) {
      refetchInsights();
    }
  }, [dataContext, refetchInsights]);

  return (
    <div className="flex h-full" data-testid="page-ai-advisor">
      <div className="w-[280px] shrink-0 border-r flex flex-col">
        <div className="p-3">
          <Button
            className="w-full gap-2"
            onClick={() => createConversation.mutate()}
            disabled={createConversation.isPending}
            data-testid="button-new-chat"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {convsLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-2 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))
            ) : conversationsList && conversationsList.length > 0 ? (
              conversationsList.map((conv) => (
                <div
                  key={conv.id}
                  className={`group relative flex items-center gap-2 rounded-md p-2 cursor-pointer hover-elevate ${
                    activeConversationId === conv.id ? "bg-accent" : ""
                  }`}
                  onClick={() => setActiveConversationId(conv.id)}
                  data-testid={`conversation-item-${conv.id}`}
                >
                  <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" data-testid={`text-conversation-title-${conv.id}`}>
                      {conv.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {relativeTime(conv.updatedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 invisible group-hover:visible"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation.mutate(conv.id);
                    }}
                    data-testid={`button-delete-conversation-${conv.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground text-center p-4">
                No conversations yet
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {activeConversationId ? (
          <>
            <div className="sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-2 border-b bg-background/80 backdrop-blur-md flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                <Bot className="w-4 h-4 shrink-0 text-muted-foreground" />
                <h2 className="text-sm font-medium truncate" data-testid="text-active-conversation-title">
                  {activeConversation?.title || "Chat"}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {dataContext && (
                  <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600 dark:text-green-400 no-default-hover-elevate no-default-active-elevate" data-testid="badge-data-loaded">
                    Data Loaded
                  </Badge>
                )}
                <Dialog open={dataDialogOpen} onOpenChange={setDataDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1" data-testid="button-load-ad-data">
                      <Database className="w-3.5 h-3.5" />
                      Load Ad Data
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Load Campaign Data</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Ad Account</label>
                        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                          <SelectTrigger data-testid="select-data-ad-account">
                            <SelectValue placeholder="Select ad account" />
                          </SelectTrigger>
                          <SelectContent>
                            {adAccounts?.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id} data-testid={`option-data-account-${acc.account_id}`}>
                                {acc.name} ({acc.account_id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Date Range</label>
                        <Select value={dateRange} onValueChange={setDateRange}>
                          <SelectTrigger data-testid="select-data-date-range">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">Last 7 Days</SelectItem>
                            <SelectItem value="14">Last 14 Days</SelectItem>
                            <SelectItem value="30">Last 30 Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        className="w-full"
                        onClick={loadAdData}
                        disabled={!selectedAccount}
                        data-testid="button-confirm-load-data"
                      >
                        Load Data
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {dataContext && (
              <div className="border-b">
                <button
                  className="flex items-center gap-2 w-full px-4 py-2 text-xs font-medium text-muted-foreground"
                  onClick={() => setInsightsOpen(!insightsOpen)}
                  data-testid="button-toggle-insights"
                >
                  <Brain className="w-4 h-4" />
                  AI Insights
                  {insightsOpen ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
                </button>
                {insightsOpen && (
                  <div className="px-4 pb-3">
                    {insightsLoading ? (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-5/6" />
                        <Skeleton className="h-4 w-4/6" />
                      </div>
                    ) : insightsData?.insights ? (
                      <div
                        className="text-sm prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(insightsData.insights) }}
                        data-testid="text-ai-insights"
                      />
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-auto px-4 py-3">
              <div className="max-w-3xl mx-auto space-y-3">
                {msgsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                      <Skeleton className="h-12 w-2/3 rounded-lg" />
                    </div>
                  ))
                ) : (
                  messagesList?.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      data-testid={`message-${msg.id}`}
                    >
                      <div className="flex items-start gap-2 max-w-[85%]">
                        {msg.role === "assistant" && (
                          <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                            <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        )}
                        <div
                          className={`rounded-lg px-3 py-2 ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {msg.role === "assistant" ? (
                            <div
                              className="text-sm prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                            />
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                        {msg.role === "user" && (
                          <div className="shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center mt-0.5">
                            <User className="w-3.5 h-3.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {isStreaming && streamingContent && (
                  <div className="flex justify-start" data-testid="message-streaming">
                    <div className="flex items-start gap-2 max-w-[85%]">
                      <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <div
                          className="text-sm prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {isStreaming && !streamingContent && (
                  <div className="flex justify-start" data-testid="streaming-indicator">
                    <div className="flex items-start gap-2">
                      <div className="shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-foreground/40 animate-pulse" />
                        <span className="w-2 h-2 rounded-full bg-foreground/40 animate-pulse [animation-delay:0.2s]" />
                        <span className="w-2 h-2 rounded-full bg-foreground/40 animate-pulse [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="border-t px-4 py-3">
              <div className="max-w-3xl mx-auto flex items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your ad performance..."
                  disabled={isStreaming}
                  rows={1}
                  className="resize-none min-h-[36px] text-sm"
                  data-testid="input-chat-message"
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isStreaming}
                  data-testid="button-send-message"
                >
                  {isStreaming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <SendHorizontal className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground" data-testid="text-empty-state">
                Select or start a conversation
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
