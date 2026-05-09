import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-provider";
import { Leaf, Fish } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  const { loading, session } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (loading) return;
    nav({ to: session ? "/home" : "/login", replace: true });
  }, [loading, session, nav]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-hero text-primary-foreground">
      <div className="flex items-center gap-3">
        <Leaf className="h-10 w-10" />
        <Fish className="h-10 w-10" />
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">AquaLeaf AI</h1>
      <p className="mt-1 text-sm opacity-90">Identify. Diagnose. Care.</p>
    </div>
  );
}
