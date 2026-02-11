import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Ban, Download, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface BlockedNumber {
  id: number;
  phone: string;
  reason: string | null;
  blockedAt: string;
}

export default function BlockListPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isUnblocking, setIsUnblocking] = useState(false);

  const blockedQuery = useQuery<BlockedNumber[]>({
    queryKey: ["/api/retell/blocked"],
  });

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

  return (
    <div className="p-4 space-y-3 max-w-4xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Ban className="w-5 h-5" />
          <h1 className="text-lg font-bold" data-testid="text-blocklist-title">Block List</h1>
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
  );
}
