import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { Leaf, Fish, AlertTriangle, History as HistoryIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  component: History,
});

type Row = {
  id: string;
  kind: "plant" | "fish" | "unknown";
  common_name: string | null;
  image_url: string;
  created_at: string;
  disease: { detected?: boolean } | null;
};

function History() {
  const { user } = useAuth();
  const { data = [], isLoading } = useQuery({
    queryKey: ["history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scans")
        .select("id,kind,common_name,image_url,created_at,disease")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Row[];
    },
  });

  return (
    <div>
      <header className="bg-gradient-hero px-5 pb-8 pt-12 text-primary-foreground safe-top">
        <h1 className="text-2xl font-bold">History</h1>
        <p className="mt-1 text-sm opacity-90">All your scans</p>
      </header>
      <div className="px-5 py-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-card-soft p-10 text-center">
            <HistoryIcon className="h-7 w-7 text-muted-foreground" />
            <p className="mt-2 font-medium">No scans yet</p>
            <p className="text-xs text-muted-foreground">Tap the camera button to scan</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.map((s) => {
              const Icon = s.kind === "fish" ? Fish : Leaf;
              return (
                <li key={s.id}>
                  <Link
                    to="/result/$id"
                    params={{ id: s.id }}
                    className="flex items-center gap-3 rounded-2xl bg-card p-2 shadow-card transition active:scale-[0.99]"
                  >
                    <img
                      src={s.image_url}
                      alt={s.common_name ?? s.kind}
                      loading="lazy"
                      className="h-16 w-16 flex-none rounded-xl object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{s.common_name ?? "Unknown"}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Icon className="h-3 w-3" /> {s.kind} ·{" "}
                        {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {s.disease?.detected && (
                      <AlertTriangle className="h-5 w-5 flex-none text-destructive" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
