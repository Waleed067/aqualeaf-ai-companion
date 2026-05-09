import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const { user, signOut } = useAuth();
  const { data: profile, refetch } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data as { display_name: string | null; region: string | null };
    },
  });

  const [name, setName] = useState("");
  const [region, setRegion] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setRegion(profile.region ?? "");
    }
  }, [profile]);

  const detectRegion = async () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
          );
          const j = await r.json();
          const place =
            j.address?.city || j.address?.town || j.address?.state || j.address?.country || "Unknown";
          setRegion(`${place}${j.address?.country ? ", " + j.address.country : ""}`);
          toast.success("Location detected");
        } catch {
          toast.error("Could not resolve location");
        }
      },
      () => toast.error("Permission denied"),
    );
  };

  const save = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name, region, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    refetch();
  };

  return (
    <div>
      <header className="bg-gradient-hero px-5 pb-10 pt-12 text-primary-foreground safe-top">
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="mt-1 text-sm opacity-90">{user?.email}</p>
      </header>

      <div className="space-y-4 px-5 py-6">
        <div>
          <label className="mb-1 block text-sm font-medium">Display name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Region</label>
          <div className="flex gap-2">
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="City, country (for plant/fish suggestions)"
            />
            <Button type="button" variant="outline" size="icon" onClick={detectRegion} aria-label="Detect">
              <MapPin className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Used by the AI to tailor regional plant & fish suggestions.
          </p>
        </div>
        <Button onClick={save} className="w-full bg-gradient-primary">
          Save changes
        </Button>

        <div className="pt-6">
          <Button variant="outline" className="w-full text-destructive" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>

        <p className="pt-6 text-center text-xs text-muted-foreground">AquaLeaf AI · v1.0</p>
      </div>
    </div>
  );
}
