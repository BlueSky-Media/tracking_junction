import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Ban, Download, Trash2, Search, Bot, Plus, Shield, Globe, MonitorSmartphone, ToggleLeft, ToggleRight, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BlockedNumber {
  id: number;
  phone: string;
  reason: string | null;
  blockedAt: string;
}

interface BotRuleEntry {
  id: number;
  ruleType: string;
  value: string;
  label: string;
  enabled: number;
  createdAt: string;
}

const BUILT_IN_RULES = [
  { category: "User Agent Patterns", description: "55+ known bot user agent strings including Google, Bing, Facebook, Apple, SEMRush, Ahrefs, headless browsers, HTTP clients, and scrapers" },
  { category: "Facebook IP Ranges", description: "IPv6 prefix 2a03:2880:* and 100+ Facebook/Meta IPv4 ranges (69.63.*, 69.171.*, 66.220.*, 31.13.*, 157.240.*, etc.)" },
  { category: "Missing User Agent", description: "Events with empty or missing user agent strings" },
  { category: "Short User Agent", description: "User agents shorter than 30 characters" },
  { category: "No Browser Fingerprint", description: "Events missing 4+ browser fingerprint fields (screen, viewport, language, browser, OS)" },
];

export default function BlockListPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isUnblocking, setIsUnblocking] = useState(false);

  const [newRuleType, setNewRuleType] = useState<string>("ip_prefix");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [newRuleLabel, setNewRuleLabel] = useState("");
  const [isAddingRule, setIsAddingRule] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkIPs, setBulkIPs] = useState("");
  const [bulkLabel, setBulkLabel] = useState("Blocked IP");
  const [isBulkAdding, setIsBulkAdding] = useState(false);

  const blockedQuery = useQuery<BlockedNumber[]>({
    queryKey: ["/api/retell/blocked"],
  });

  const botRulesQuery = useQuery<BotRuleEntry[]>({
    queryKey: ["/api/bot-rules"],
  });

  const customRules = botRulesQuery.data || [];

  const numbers = blockedQuery.data || [];
  const filtered = search
    ? numbers.filter(n => n.phone.includes(search) || (n.reason || "").toLowerCase().includes(search.toLowerCase()))
    : numbers;

  const allSelected = filtered.length > 0 && filtered.every(n => selected.has(n.phone));

  const toggleSelect = (phone: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone); else next.add(phone);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(n => n.phone)));
    }
  };

  const bulkUnblock = async () => {
    const phones = Array.from(selected);
    if (phones.length === 0) return;
    setIsUnblocking(true);
    try {
      const res = await fetch("/api/retell/bulk-unblock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phones }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      toast({ title: `Unblocked ${data.count} number${data.count !== 1 ? "s" : ""}` });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/retell/blocked"] });
    } catch {
      toast({ title: "Failed to unblock numbers", variant: "destructive" });
    } finally {
      setIsUnblocking(false);
    }
  };

  const downloadCsv = () => {
    const rows = [["Phone", "Reason", "Blocked At"]];
    for (const n of filtered) {
      rows.push([n.phone, n.reason || "", n.blockedAt ? format(new Date(n.blockedAt), "yyyy-MM-dd HH:mm:ss") : ""]);
    }
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blocked-numbers-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addCustomRule = async () => {
    if (!newRuleValue.trim() || !newRuleLabel.trim()) {
      toast({ title: "Please fill in both value and label", variant: "destructive" });
      return;
    }
    setIsAddingRule(true);
    try {
      const res = await fetch("/api/bot-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ruleType: newRuleType, value: newRuleValue.trim(), label: newRuleLabel.trim(), enabled: 1 }),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Bot rule added" });
      setNewRuleValue("");
      setNewRuleLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/bot-rules"] });
    } catch {
      toast({ title: "Failed to add rule", variant: "destructive" });
    } finally {
      setIsAddingRule(false);
    }
  };

  const bulkAddRules = async () => {
    const lines = bulkIPs.split(/[\n,]+/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      toast({ title: "No IPs found. Enter one per line or comma-separated.", variant: "destructive" });
      return;
    }
    if (!bulkLabel.trim()) {
      toast({ title: "Please provide a Bot Type Label", variant: "destructive" });
      return;
    }
    setIsBulkAdding(true);
    let added = 0;
    let failed = 0;
    for (const ip of lines) {
      try {
        const res = await fetch("/api/bot-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ ruleType: "ip_prefix", value: ip, label: bulkLabel.trim(), enabled: 1 }),
        });
        if (!res.ok) throw new Error("Failed");
        added++;
      } catch {
        failed++;
      }
    }
    toast({ title: `Added ${added} rule${added !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}` });
    setBulkIPs("");
    queryClient.invalidateQueries({ queryKey: ["/api/bot-rules"] });
    setIsBulkAdding(false);
  };

  const toggleRule = async (rule: BotRuleEntry) => {
    try {
      const res = await fetch(`/api/bot-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ enabled: rule.enabled === 1 ? 0 : 1 }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: ["/api/bot-rules"] });
    } catch {
      toast({ title: "Failed to update rule", variant: "destructive" });
    }
  };

  const deleteRule = async (id: number) => {
    try {
      const res = await fetch(`/api/bot-rules/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Bot rule deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/bot-rules"] });
    } catch {
      toast({ title: "Failed to delete rule", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 space-y-6 max-w-4xl">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <h2 className="text-lg font-bold" data-testid="text-bot-rules-title">Bot Detection Rules</h2>
            <Badge variant="secondary" className="text-[10px]" data-testid="badge-custom-rules-count">
              {customRules.length} custom
            </Badge>
          </div>
        </div>

        <Card className="p-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-[11px] font-semibold">Built-in Rules</span>
            <Badge variant="outline" className="text-[9px]">Always Active</Badge>
          </div>
          <div className="space-y-1.5">
            {BUILT_IN_RULES.map((rule) => (
              <div key={rule.category} className="flex items-start gap-2 text-[10px]">
                <Badge variant="secondary" className="text-[9px] shrink-0 mt-0.5">{rule.category}</Badge>
                <span className="text-muted-foreground">{rule.description}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Plus className="w-4 h-4 text-muted-foreground" />
            <span className="text-[11px] font-semibold">Custom Rules</span>
          </div>

          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1">
              <label className="text-[9px] text-muted-foreground font-medium">Type</label>
              <Select value={newRuleType} onValueChange={setNewRuleType}>
                <SelectTrigger className="h-8 w-[140px] text-[11px]" data-testid="select-rule-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip_prefix">
                    <div className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      <span>IP Prefix</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ua_pattern">
                    <div className="flex items-center gap-1">
                      <MonitorSmartphone className="w-3 h-3" />
                      <span>UA Pattern</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-[9px] text-muted-foreground font-medium">
                {newRuleType === "ip_prefix" ? "IP Prefix (e.g. 2a03:2880: or 69.63.)" : "User Agent Regex (e.g. MyBot|CustomCrawler)"}
              </label>
              <Input
                value={newRuleValue}
                onChange={(e) => setNewRuleValue(e.target.value)}
                placeholder={newRuleType === "ip_prefix" ? "2a03:2880:" : "MyBot|CustomCrawler"}
                className="h-8 text-[11px]"
                data-testid="input-rule-value"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[120px]">
              <label className="text-[9px] text-muted-foreground font-medium">Bot Type Label</label>
              <Input
                value={newRuleLabel}
                onChange={(e) => setNewRuleLabel(e.target.value)}
                placeholder="e.g. Facebook Prefetcher"
                className="h-8 text-[11px]"
                data-testid="input-rule-label"
              />
            </div>
            <Button
              size="sm"
              onClick={addCustomRule}
              disabled={isAddingRule || !newRuleValue.trim() || !newRuleLabel.trim()}
              data-testid="button-add-rule"
            >
              <Plus className="w-3 h-3 mr-1" />
              <span className="text-[10px]">Add Rule</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBulkImport(!showBulkImport)}
              data-testid="button-toggle-bulk-import"
            >
              <Upload className="w-3 h-3 mr-1" />
              <span className="text-[10px]">Bulk Import</span>
            </Button>
          </div>

          {showBulkImport && (
            <div className="border rounded-md p-3 space-y-2 bg-muted/20">
              <div className="flex items-center gap-2">
                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold">Bulk IP Import</span>
              </div>
              <Textarea
                value={bulkIPs}
                onChange={(e) => setBulkIPs(e.target.value)}
                placeholder={"Paste IPs, one per line or comma-separated:\n34.213.179.155\n44.251.140.95\n34.212.215.48"}
                className="text-[11px] font-mono min-h-[80px]"
                data-testid="textarea-bulk-ips"
              />
              <div className="flex items-end gap-2 flex-wrap">
                <div className="space-y-1 flex-1 min-w-[120px]">
                  <label className="text-[9px] text-muted-foreground font-medium">Bot Type Label (applied to all)</label>
                  <Input
                    value={bulkLabel}
                    onChange={(e) => setBulkLabel(e.target.value)}
                    placeholder="e.g. Blocked IP"
                    className="h-8 text-[11px]"
                    data-testid="input-bulk-label"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={bulkAddRules}
                  disabled={isBulkAdding || !bulkIPs.trim() || !bulkLabel.trim()}
                  data-testid="button-bulk-add"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  <span className="text-[10px]">{isBulkAdding ? "Adding..." : `Add ${bulkIPs.split(/[\n,]+/).filter(l => l.trim()).length} IPs`}</span>
                </Button>
              </div>
              <span className="text-[9px] text-muted-foreground">Each IP will be added as a separate IP Prefix rule.</span>
            </div>
          )}

          {botRulesQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : customRules.length === 0 ? (
            <div className="text-center text-[11px] text-muted-foreground py-3" data-testid="text-no-custom-rules">
              No custom bot rules yet. Add one above to extend bot detection.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr className="border-b bg-muted/30 h-7">
                    <th className="px-2 py-0 text-left font-medium" style={{ width: 90 }}>Type</th>
                    <th className="px-2 py-0 text-left font-medium">Value</th>
                    <th className="px-2 py-0 text-left font-medium" style={{ width: 140 }}>Bot Type Label</th>
                    <th className="px-2 py-0 text-center font-medium" style={{ width: 70 }}>Status</th>
                    <th className="px-2 py-0 text-right font-medium" style={{ width: 100 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {customRules.map((rule) => (
                    <tr key={rule.id} className="border-b h-7 hover-elevate" data-testid={`row-bot-rule-${rule.id}`}>
                      <td className="px-2 py-0">
                        <Badge variant="outline" className="text-[9px] py-0">
                          {rule.ruleType === "ip_prefix" ? (
                            <><Globe className="w-2.5 h-2.5 mr-0.5" />IP</>
                          ) : (
                            <><MonitorSmartphone className="w-2.5 h-2.5 mr-0.5" />UA</>
                          )}
                        </Badge>
                      </td>
                      <td className="px-2 py-0 font-mono truncate" title={rule.value} data-testid={`text-rule-value-${rule.id}`}>
                        {rule.value}
                      </td>
                      <td className="px-2 py-0 truncate" title={rule.label}>
                        {rule.label}
                      </td>
                      <td className="px-2 py-0 text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => toggleRule(rule)}
                          data-testid={`button-toggle-rule-${rule.id}`}
                        >
                          {rule.enabled === 1 ? (
                            <ToggleRight className="w-4 h-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                      </td>
                      <td className="px-2 py-0 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteRule(rule.id)}
                          data-testid={`button-delete-rule-${rule.id}`}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-[9px] text-muted-foreground pt-1">
            Custom rules are applied during event ingestion and bot rescans. After adding new rules, use "Rescan Bots" in Session Logs to retroactively apply them.
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5" />
            <h2 className="text-lg font-bold" data-testid="text-blocklist-title">Blocked Phone Numbers</h2>
            <Badge variant="secondary" className="text-[10px]" data-testid="badge-blocked-count">
              {numbers.length} blocked
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={downloadCsv}
              disabled={filtered.length === 0}
              data-testid="button-download-csv"
            >
              <Download className="w-3 h-3 mr-1" />
              <span className="text-[10px]">Export CSV</span>
            </Button>
            {selected.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={bulkUnblock}
                disabled={isUnblocking}
                data-testid="button-bulk-unblock"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                <span className="text-[10px]">Unblock {selected.size} selected</span>
              </Button>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search phone numbers or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-[11px]"
            data-testid="input-blocklist-search"
          />
        </div>

        <Card className="overflow-hidden">
          {blockedQuery.isLoading ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-[11px] text-muted-foreground" data-testid="text-no-blocked">
              {search ? "No blocked numbers match your search" : "No blocked numbers"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]" style={{ tableLayout: "fixed" }}>
                <thead>
                  <tr className="border-b bg-muted/30 h-7">
                    <th className="px-2 py-0 text-left font-medium" style={{ width: 40 }}>
                      <div className="flex items-center gap-1">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          className="h-3 w-3"
                          data-testid="checkbox-select-all-blocked"
                        />
                      </div>
                    </th>
                    <th className="px-2 py-0 text-left font-medium" style={{ width: 180 }}>Phone</th>
                    <th className="px-2 py-0 text-left font-medium">Reason</th>
                    <th className="px-2 py-0 text-left font-medium" style={{ width: 160 }}>Blocked At</th>
                    <th className="px-2 py-0 text-right font-medium" style={{ width: 80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((num) => (
                    <tr
                      key={num.id}
                      className={`border-b h-7 hover-elevate ${selected.has(num.phone) ? "bg-primary/5" : ""}`}
                      data-testid={`row-blocked-${num.id}`}
                    >
                      <td className="px-2 py-0">
                        <Checkbox
                          checked={selected.has(num.phone)}
                          onCheckedChange={() => toggleSelect(num.phone)}
                          className="h-3 w-3"
                          data-testid={`checkbox-blocked-${num.id}`}
                        />
                      </td>
                      <td className="px-2 py-0 font-mono" data-testid={`text-phone-${num.id}`}>{num.phone}</td>
                      <td className="px-2 py-0 text-muted-foreground truncate" title={num.reason || ""}>
                        {num.reason || "\u2014"}
                      </td>
                      <td className="px-2 py-0 text-muted-foreground font-mono">
                        {num.blockedAt ? format(new Date(num.blockedAt), "MMM d, yyyy h:mm a") : "\u2014"}
                      </td>
                      <td className="px-2 py-0 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            try {
                              const res = await fetch(`/api/retell/block/${encodeURIComponent(num.phone)}`, {
                                method: "DELETE",
                                credentials: "include",
                              });
                              if (!res.ok) throw new Error("Failed");
                              toast({ title: `Unblocked ${num.phone}` });
                              queryClient.invalidateQueries({ queryKey: ["/api/retell/blocked"] });
                            } catch {
                              toast({ title: "Failed to unblock", variant: "destructive" });
                            }
                          }}
                          data-testid={`button-unblock-${num.id}`}
                        >
                          <span className="text-[9px] text-destructive">Unblock</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
