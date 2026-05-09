import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-provider";
import { chatAboutScan } from "@/lib/ai.functions";
import {
  ArrowLeft,
  Leaf,
  Fish,
  AlertTriangle,
  Send,
  Loader2,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/result/$id")({
  component: Result,
});

type Scan = {
  id: string;
  kind: "plant" | "fish" | "unknown";
  image_url: string;
  common_name: string | null;
  scientific_name: string | null;
  confidence: number | null;
  similar_species: { common_name: string; scientific_name?: string }[] | null;
  description: string | null;
  habitat: string | null;
  toxicity: string | null;
  care_guide: Record<string, string> | null;
  disease: {
    detected: boolean;
    name?: string;
    cause?: string;
    severity?: string;
    affected_area?: string;
    treatment?: string[];
  } | null;
  notes: string | null;
  created_at: string;
};

function Result() {
  const { id } = useParams({ from: "/_authenticated/result/$id" });
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: scan, isLoading } = useQuery({
    queryKey: ["scan", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("scans").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Scan;
    },
  });

  if (isLoading || !scan) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const KindIcon = scan.kind === "fish" ? Fish : Leaf;
  const severityColor =
    scan.disease?.severity === "severe"
      ? "bg-destructive text-destructive-foreground"
      : scan.disease?.severity === "moderate"
        ? "bg-warning text-warning-foreground"
        : "bg-success text-success-foreground";

  return (
    <div className="pb-10">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
        <img src={scan.image_url} alt={scan.common_name ?? scan.kind} className="h-full w-full object-cover" />
        <Link
          to="/home"
          className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur safe-top"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <button
          onClick={async () => {
            if (!confirm("Delete this scan?")) return;
            await supabase.from("scans").delete().eq("id", id);
            window.history.back();
          }}
          className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur safe-top"
          aria-label="Delete"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="-mt-6 rounded-t-3xl bg-card px-5 pb-6 pt-6 shadow-card">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <KindIcon className="h-3.5 w-3.5" /> {scan.kind}
          </span>
          {typeof scan.confidence === "number" && (
            <span className="text-xs text-muted-foreground">
              {(scan.confidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight">{scan.common_name ?? "Unknown"}</h1>
        {scan.scientific_name && (
          <p className="text-sm italic text-muted-foreground">{scan.scientific_name}</p>
        )}

        {scan.disease?.detected && (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <h2 className="font-semibold">Disease detected: {scan.disease.name ?? "Unknown"}</h2>
            </div>
            {scan.disease.severity && (
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${severityColor}`}>
                {scan.disease.severity}
              </span>
            )}
            {scan.disease.cause && <p className="mt-2 text-sm text-muted-foreground">Cause: {scan.disease.cause}</p>}
            {scan.disease.affected_area && (
              <p className="text-sm text-muted-foreground">Area: {scan.disease.affected_area}</p>
            )}
            {scan.disease.treatment && scan.disease.treatment.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {scan.disease.treatment.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <Tabs defaultValue="info" className="mt-5">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">Info</TabsTrigger>
            <TabsTrigger value="care">Care</TabsTrigger>
            <TabsTrigger value="chat">Ask AI</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4 space-y-4">
            {scan.description && <Section title="Description">{scan.description}</Section>}
            {scan.habitat && <Section title="Habitat">{scan.habitat}</Section>}
            {scan.toxicity && <Section title="Toxicity">{scan.toxicity}</Section>}
            {scan.similar_species && scan.similar_species.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Similar species</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {scan.similar_species.map((s, i) => (
                    <li key={i} className="rounded-lg bg-card-soft px-3 py-2">
                      <span className="font-medium">{s.common_name}</span>
                      {s.scientific_name && <span className="ml-2 italic text-muted-foreground">{s.scientific_name}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="care" className="mt-4 space-y-3">
            {scan.care_guide && Object.entries(scan.care_guide).filter(([, v]) => v).length === 0 ? (
              <p className="text-sm text-muted-foreground">No care details available.</p>
            ) : (
              Object.entries(scan.care_guide ?? {})
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="rounded-xl bg-card-soft p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                      {k.replace("_", " ")}
                    </p>
                    <p className="mt-1 text-sm">{v}</p>
                  </div>
                ))
            )}
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <Chat scanId={id} imageUrl={scan.image_url} userId={user?.id ?? ""} contextSummary={buildContext(scan)} />
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <NotesEditor scanId={id} initial={scan.notes ?? ""} onSaved={() => qc.invalidateQueries({ queryKey: ["scan", id] })} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function buildContext(s: Scan) {
  return `Identified as ${s.common_name} (${s.scientific_name ?? "n/a"}), kind=${s.kind}. ${
    s.disease?.detected ? `Disease: ${s.disease.name}, severity ${s.disease.severity}.` : "No disease detected."
  }`;
}

type Msg = { id?: string; role: "user" | "assistant"; content: string };

function Chat({
  scanId,
  imageUrl,
  userId,
  contextSummary,
}: {
  scanId: string;
  imageUrl: string;
  userId: string;
  contextSummary: string;
}) {
  const qc = useQueryClient();
  const chat = useServerFn(chatAboutScan);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["chat", scanId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id,role,content")
        .eq("scan_id", scanId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Msg[];
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const send = useMutation({
    mutationFn: async (prompt: string) => {
      await supabase.from("chat_messages").insert({ user_id: userId, scan_id: scanId, role: "user", content: prompt });
      qc.invalidateQueries({ queryKey: ["chat", scanId] });
      const { reply } = await chat({
        data: {
          imageUrl,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          prompt,
          context: contextSummary,
        },
      });
      await supabase
        .from("chat_messages")
        .insert({ user_id: userId, scan_id: scanId, role: "assistant", content: reply });
      qc.invalidateQueries({ queryKey: ["chat", scanId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Chat failed"),
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!v || send.isPending) return;
    setInput("");
    send.mutate(v);
  };

  return (
    <div className="flex h-[60vh] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.length === 0 && (
          <div className="rounded-xl bg-card-soft p-3 text-sm text-muted-foreground">
            Ask anything about this image — “Why are leaves yellow?”, “Is this safe with goldfish?”
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
              m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-card-soft"
            }`}
          >
            {m.content}
          </div>
        ))}
        {send.isPending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> AquaLeaf is thinking…
          </div>
        )}
      </div>
      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-border pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this image…"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e as unknown as React.FormEvent);
            }
          }}
          className="min-h-10 resize-none"
        />
        <Button type="submit" disabled={send.isPending || !input.trim()} size="icon" className="h-10 w-10">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function NotesEditor({ scanId, initial, onSaved }: { scanId: string; initial: string; onSaved: () => void }) {
  const [val, setVal] = useState(initial);
  const [saving, setSaving] = useState(false);
  return (
    <div className="space-y-3">
      <Textarea
        rows={6}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="Personal notes about this scan…"
      />
      <Button
        onClick={async () => {
          setSaving(true);
          const { error } = await supabase.from("scans").update({ notes: val }).eq("id", scanId);
          setSaving(false);
          if (error) {
            toast.error(error.message);
            return;
          }
          toast.success("Notes saved");
          onSaved();
        }}
        disabled={saving}
        className="w-full"
      >
        <StickyNote className="mr-2 h-4 w-4" />
        Save notes
      </Button>
    </div>
  );
}
