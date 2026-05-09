import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { Camera, Leaf, Fish, Sparkles, History as HistoryIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: Home,
});

type ScanRow = {
  id: string;
  kind: string;
  common_name: string | null;
  image_url: string;
  created_at: string;
};

function Home() {
  const { user } = useAuth();
  const { data: recent = [] } = useQuery({
    queryKey: ["recent-scans", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scans")
        .select("id,kind,common_name,image_url,created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data as ScanRow[];
    },
  });

  return (
    <div>
      <header className="bg-gradient-hero px-5 pb-10 pt-12 text-primary-foreground safe-top">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Welcome back</p>
            <h1 className="text-2xl font-bold leading-tight">
              {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Explorer"}
            </h1>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white/15">
            <Sparkles className="h-5 w-5" />
          </div>
        </div>

        <Link
          to="/scan"
          className="mt-6 flex items-center justify-between rounded-2xl bg-white/15 px-4 py-3 backdrop-blur transition active:scale-[0.99]"
        >
          <div>
            <p className="text-sm opacity-90">New scan</p>
            <p className="font-semibold">Identify a plant or fish</p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-primary">
            <Camera className="h-5 w-5" />
          </div>
        </Link>
      </header>

      <section className="px-5 py-6">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Quick scan</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/scan"
            search={{ kind: "plant" }}
            className="flex flex-col gap-2 rounded-2xl bg-card-soft p-4 shadow-card transition active:scale-[0.98]"
          >
            <Leaf className="h-7 w-7 text-success" />
            <p className="font-semibold">Plant</p>
            <p className="text-xs text-muted-foreground">Species, disease, care</p>
          </Link>
          <Link
            to="/scan"
            search={{ kind: "fish" }}
            className="flex flex-col gap-2 rounded-2xl bg-card-soft p-4 shadow-card transition active:scale-[0.98]"
          >
            <Fish className="h-7 w-7 text-accent" />
            <p className="font-semibold">Fish</p>
            <p className="text-xs text-muted-foreground">Species, parasites, tank</p>
          </Link>
        </div>
      </section>

      <section className="px-5 pb-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent scans</h2>
          <Link to="/history" className="text-xs font-medium text-primary">
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-card-soft p-8 text-center">
            <HistoryIcon className="h-7 w-7 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">No scans yet</p>
            <p className="text-xs text-muted-foreground">Tap the camera to start</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {recent.map((s) => (
              <Link
                key={s.id}
                to="/result/$id"
                params={{ id: s.id }}
                className="aspect-square overflow-hidden rounded-xl bg-muted"
              >
                <img
                  src={s.image_url}
                  alt={s.common_name ?? s.kind}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
