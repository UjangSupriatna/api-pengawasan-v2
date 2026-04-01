"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Shield,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  Camera,
  Send,
  Copy,
  Check,
  Eye,
  Globe,
  Terminal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface LogRecord {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  prediction: string;
  reason: string | null;
}

interface PagInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface StatsInfo {
  normal: number;
  mencurigakan: number;
  total: number;
}

export default function Home() {
  const [testUserId, setTestUserId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ prediction: string; reason: string } | null>(null);
  const [responseRaw, setResponseRaw] = useState("");
  const [copiedField, setCopiedField] = useState("");
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [pag, setPag] = useState<PagInfo | null>(null);
  const [stats, setStats] = useState<StatsInfo | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterUserId, setFilterUserId] = useState("");
  const [detailRecord, setDetailRecord] = useState<LogRecord | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const copy = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(""), 1500);
  }, []);

  // --- TEST ---
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(f.type)) {
      toast.error("Format tidak didukung");
      return;
    }
    setFile(f);
    const r = new FileReader();
    r.onloadend = () => setPreview(r.result as string);
    r.readAsDataURL(f);
  }, []);

  const testPredict = useCallback(async () => {
    if (!file || !testUserId.trim()) { toast.error("File dan User ID wajib diisi"); return; }
    setLoading(true);
    setResult(null);
    setResponseRaw("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("user_id", testUserId.trim());
      const res = await fetch("/api/predict", { method: "POST", body: fd });
      const data = await res.json();
      setResponseRaw(JSON.stringify(data, null, 2));
      if (!res.ok) { toast.error(data.error || "Error"); return; }
      setResult(data);
      toast.success(data.prediction === "Normal" ? "Normal" : "Mencurigakan", { description: data.reason });
      setFile(null); setPreview(null);
    } catch { toast.error("Gagal"); } finally { setLoading(false); }
  }, [file, testUserId]);

  // --- LOGS ---
  const fetchLogs = useCallback(async (page = 1) => {
    setLogsLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: "15" });
      if (filterUserId.trim()) p.set("user_id", filterUserId.trim());
      const res = await fetch(`/api/pengawasan?${p}`);
      const data = await res.json();
      if (res.ok) { setLogs(data.records); setPag(data.pagination); setStats(data.stats); }
    } catch { toast.error("Gagal memuat"); } finally { setLogsLoading(false); }
  }, [filterUserId]);

  const fmtDate = (s: string) => new Date(s).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-base font-bold text-slate-900">API Pengawasan</h1>
            <p className="text-xs text-slate-400">Proctoring Endpoint &mdash; Vercel Ready</p>
          </div>
          <Badge variant="outline" className="text-xs font-mono gap-1"><Globe className="w-3 h-3" /> API</Badge>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
        {/* Endpoint Config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600" />
              Endpoint Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-slate-500">Deploy ke Vercel, lalu ganti URL di CodeIgniter kamu:</p>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-600 text-white text-[10px] font-mono px-1.5 py-0">POST</Badge>
                <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded flex-1 truncate text-slate-700">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/predict
                </code>
                <button onClick={() => copy(`${typeof window !== "undefined" ? window.location.origin : ""}/api/predict`, "url1")} className="p-1.5 rounded hover:bg-slate-200 transition-colors">
                  {copiedField === "url1" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-white text-[10px] font-mono px-1.5 py-0">GET</Badge>
                <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded flex-1 truncate text-slate-700">
                  {typeof window !== "undefined" ? window.location.origin : ""}/api/pengawasan
                </code>
                <button onClick={() => copy(`${typeof window !== "undefined" ? window.location.origin : ""}/api/pengawasan`, "url2")} className="p-1.5 rounded hover:bg-slate-200 transition-colors">
                  {copiedField === "url2" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                </button>
              </div>
            </div>

            {/* Migration code */}
            <div className="relative rounded-lg bg-slate-900 p-3">
              <button onClick={() => copy(`// SEBELUM (Flask localhost):
fetch('http://127.0.0.1:5000/predict', { method: 'POST', body: formData })

// SESUDAH (Vercel):
fetch('${typeof window !== "undefined" ? window.location.origin : ""}/api/predict', { method: 'POST', body: formData })`, "migration")} className="absolute top-2 right-2 p-1 rounded bg-slate-700 hover:bg-slate-600">
                {copiedField === "migration" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              </button>
              <p className="text-[10px] text-slate-500 mb-1 font-mono uppercase tracking-wider">Migration &mdash; Ganti di sendFrameToFlask()</p>
              <pre className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{`// SEBELUM (Flask localhost):
fetch('http://127.0.0.1:5000/predict', {
  method: 'POST', body: formData
})

// SESUDAH (Vercel):
fetch('${typeof window !== "undefined" ? window.location.origin : ""}/api/predict', {
  method: 'POST', body: formData
})`}</pre>
            </div>
          </CardContent>
        </Card>

        {/* Quick Test */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-600" />
              Quick Test &mdash; POST /api/predict
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-[10px] text-slate-400 uppercase tracking-wider">User ID</Label>
                <Input placeholder="3" value={testUserId} onChange={(e) => setTestUserId(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-slate-400 uppercase tracking-wider">File (gambar)</Label>
              {preview ? (
                <div className="relative rounded-md overflow-hidden border bg-slate-950 w-fit">
                  <img src={preview} alt="" className="h-28 object-contain" />
                  <button onClick={() => { setFile(null); setPreview(null); }} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs">&times;</button>
                </div>
              ) : (
                <div onClick={() => fileRef.current?.click()} className="border border-dashed border-slate-300 rounded-md px-4 py-3 text-center cursor-pointer hover:border-emerald-400 transition-colors">
                  <Camera className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                  <span className="text-xs text-slate-500">Klik untuk pilih gambar</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFile} className="hidden" />
            </div>
            <Button onClick={testPredict} disabled={loading || !file || !testUserId.trim()} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
              Kirim
            </Button>

            {result && (
              <div className={`rounded-md border p-3 ${result.prediction === "Normal" ? "border-emerald-300 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  {result.prediction === "Normal" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-red-600" />}
                  <span className={`text-sm font-bold ${result.prediction === "Normal" ? "text-emerald-700" : "text-red-700"}`}>{result.prediction}</span>
                </div>
                <p className="text-xs text-slate-600">{result.reason}</p>
              </div>
            )}

            {responseRaw && (
              <div className="relative">
                <button onClick={() => copy(responseRaw, "raw")} className="absolute top-1.5 right-1.5 p-1 rounded bg-slate-700 hover:bg-slate-600">
                  {copiedField === "raw" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
                <pre className="rounded-md bg-slate-900 p-3 text-[11px] text-slate-300 font-mono overflow-x-auto max-h-40">{responseRaw}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logs / Riwayat */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                Log Pengawasan
                {stats && (
                  <span className="font-normal text-slate-400 ml-1">
                    ({stats.normal} normal, {stats.mencurigakan} mencurigakan)
                  </span>
                )}
              </CardTitle>
              <div className="flex gap-2 items-center">
                <Input placeholder="Filter user_id..." value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} className="h-7 w-32 text-xs" />
                <Button variant="outline" size="sm" onClick={() => fetchLogs(1)} disabled={logsLoading}>
                  {logsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length > 0 ? (
              <>
                <div className="overflow-x-auto rounded-md border text-xs">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="h-8 text-[10px]">Waktu</TableHead>
                        <TableHead className="h-8 text-[10px]">User ID</TableHead>
                        <TableHead className="h-8 text-[10px]">Status</TableHead>
                        <TableHead className="h-8 text-[10px] hidden md:table-cell">Alasan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((r) => (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setDetailRecord(r); setShowDetail(true); }}>
                          <TableCell className="font-mono text-slate-400 py-2">{fmtDate(r.timestamp)}</TableCell>
                          <TableCell className="font-mono py-2">{r.userId}</TableCell>
                          <TableCell className="py-2">
                            <Badge className={`text-[10px] px-1.5 py-0 ${r.prediction === "Normal" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                              {r.prediction === "Normal" ? "Normal" : "Mencurigakan"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400 max-w-[200px] truncate hidden md:table-cell py-2">{r.reason || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {pag && pag.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                    <span>Hal {pag.page}/{pag.totalPages}</span>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" disabled={pag.page <= 1} onClick={() => fetchLogs(pag.page - 1)} className="h-7 w-7 p-0"><ChevronLeft className="w-3 h-3" /></Button>
                      <Button variant="outline" size="sm" disabled={pag.page >= pag.totalPages} onClick={() => fetchLogs(pag.page + 1)} className="h-7 w-7 p-0"><ChevronRight className="w-3 h-3" /></Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-center text-xs text-slate-400 py-8">Belum ada log. Test endpoint di atas untuk memulai.</p>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        {showDetail && detailRecord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowDetail(false)}>
            <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">Detail Log</h3>
                <button onClick={() => setShowDetail(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-slate-400">Waktu</span><p className="font-mono">{fmtDate(detailRecord.timestamp)}</p></div>
                  <div><span className="text-slate-400">User ID</span><p className="font-mono">{detailRecord.userId}</p></div>
                </div>
                <div>
                  <span className="text-slate-400">Status</span>
                  <Badge className={`ml-1 text-[10px] ${detailRecord.prediction === "Normal" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{detailRecord.prediction}</Badge>
                </div>
                <div>
                  <span className="text-slate-400">Alasan</span>
                  <p className="text-slate-600 mt-0.5">{detailRecord.reason || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between text-[10px] text-slate-400">
          <span>API Pengawasan &mdash; Proctoring</span>
          <span>Next.js + VLM (z-ai-web-dev-sdk)</span>
        </div>
      </footer>
    </div>
  );
}
