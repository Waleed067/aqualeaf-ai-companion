import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth-provider";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/image";
import { analyzeImage } from "@/lib/ai.functions";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

const search = z.object({ kind: z.enum(["plant", "fish", "auto"]).optional() });

export const Route = createFileRoute("/_authenticated/scan")({
  validateSearch: (s) => search.parse(s),
  component: Scan,
});

function Scan() {
  const { user } = useAuth();
  const nav = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const analyze = useServerFn(analyzeImage);

  const handleFile = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    try {
      setBusy("Optimizing image…");
      const compressed = await compressImage(file);
      const localUrl = URL.createObjectURL(compressed);
      setPreviewUrl(localUrl);

      setBusy("Uploading…");
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("scans")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("scans").getPublicUrl(path);
      const imageUrl = pub.publicUrl;

      setBusy("Analyzing with AI…");
      const { result } = await analyze({ data: { imageUrl } });

      setBusy("Saving…");
      const { data: scan, error: insErr } = await supabase
        .from("scans")
        .insert({
          user_id: user.id,
          kind: result.kind,
          image_url: imageUrl,
          common_name: result.common_name,
          scientific_name: result.scientific_name ?? null,
          confidence: result.confidence,
          similar_species: result.similar_species ?? [],
          description: result.description,
          habitat: result.habitat ?? null,
          toxicity: result.toxicity ?? null,
          care_guide: result.care_guide ?? {},
          disease: result.disease ?? { detected: false },
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      toast.success(`Identified: ${result.common_name}`);
      nav({ to: "/result/$id", params: { id: scan.id }, replace: true });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Scan failed");
      setPreviewUrl(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-card">
      <header className="flex items-center gap-3 px-4 pb-4 pt-6 safe-top">
        <Link to="/home" className="grid h-9 w-9 place-items-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">New scan</h1>
      </header>

      <div className="px-5 pb-10">
        <div className="aspect-[4/5] w-full overflow-hidden rounded-3xl bg-muted shadow-card">
          {previewUrl ? (
            <img src={previewUrl} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Camera className="h-10 w-10" />
              <p className="text-sm">Capture or choose a clear photo</p>
            </div>
          )}
        </div>

        {busy ? (
          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-primary/10 p-4 text-primary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">{busy}</span>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-14 bg-gradient-primary text-base"
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="mr-2 h-5 w-5" />
              Camera
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-14 text-base"
              onClick={() => galleryRef.current?.click()}
            >
              <ImagePlus className="mr-2 h-5 w-5" />
              Gallery
            </Button>
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Tip: fill the frame with the subject for best accuracy.
        </p>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}
