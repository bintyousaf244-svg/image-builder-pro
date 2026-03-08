import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wand2, Loader2, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GeneratedImage, buildPollinationsUrl } from "@/lib/pollinations";
import ImageCard from "./ImageCard";

const SIZES = [
  { label: "Square (1024×1024)", w: 1024, h: 1024 },
  { label: "Landscape (1280×720)", w: 1280, h: 720 },
  { label: "Portrait (720×1280)", w: 720, h: 1280 },
  { label: "Wide (1920×1080)", w: 1920, h: 1080 },
  { label: "Instagram (1080×1080)", w: 1080, h: 1080 },
  { label: "Story (1080×1920)", w: 1080, h: 1920 },
];

const MODELS = [
  { value: "flux", label: "Flux (Default)" },
  { value: "flux-realism", label: "Flux Realism" },
  { value: "flux-anime", label: "Flux Anime" },
  { value: "flux-3d", label: "Flux 3D" },
  { value: "turbo", label: "Turbo (Fast)" },
];

const BulkImageGenerator = () => {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState("");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedSize, setSelectedSize] = useState("0");
  const [selectedModel, setSelectedModel] = useState("flux");
  const [variationsPerPrompt, setVariationsPerPrompt] = useState(1);

  const parsePrompts = (text: string): string[] => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  };

  const handleGenerate = useCallback(async () => {
    const promptList = parsePrompts(prompts);
    if (promptList.length === 0) {
      toast({ title: "No prompts", description: "Enter at least one prompt (one per line).", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    const size = SIZES[parseInt(selectedSize)];

    // Create placeholder images
    const newImages: GeneratedImage[] = [];
    for (const prompt of promptList) {
      for (let v = 0; v < variationsPerPrompt; v++) {
        newImages.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          prompt,
          url: "",
          status: "pending",
        });
      }
    }

    setImages((prev) => [...newImages, ...prev]);

    // Generate concurrently with a concurrency limit of 3
    const concurrency = 3;
    let index = 0;

    const processNext = async () => {
      while (index < newImages.length) {
        const currentIndex = index++;
        const img = newImages[currentIndex];

        setImages((prev) =>
          prev.map((i) => (i.id === img.id ? { ...i, status: "generating" } : i))
        );

        try {
          const seed = Math.floor(Math.random() * 999999);
          const url = buildPollinationsUrl({
            prompt: img.prompt,
            width: size.w,
            height: size.h,
            seed,
            model: selectedModel,
          });

          // Pre-fetch to trigger generation
          await fetch(url);

          setImages((prev) =>
            prev.map((i) => (i.id === img.id ? { ...i, url, status: "done" } : i))
          );
        } catch (error) {
          setImages((prev) =>
            prev.map((i) =>
              i.id === img.id
                ? { ...i, status: "error", error: error instanceof Error ? error.message : "Failed" }
                : i
            )
          );
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, newImages.length) }, () => processNext());
    await Promise.all(workers);

    setIsGenerating(false);
    toast({ title: "Done!", description: `Generated ${newImages.length} image(s).` });
  }, [prompts, selectedSize, selectedModel, variationsPerPrompt, toast]);

  const handleClearAll = () => {
    setImages([]);
  };

  const handleDownloadAll = async () => {
    const doneImages = images.filter((i) => i.status === "done");
    for (const img of doneImages) {
      try {
        const response = await fetch(img.url);
        const blob = await response.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${img.prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
        await new Promise((r) => setTimeout(r, 300));
      } catch {
        // skip failed downloads
      }
    }
  };

  const promptCount = parsePrompts(prompts).length;
  const totalImages = promptCount * variationsPerPrompt;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Wand2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Image Builder Pro</h1>
              <p className="text-xs text-muted-foreground">Bulk AI Image Generator</p>
            </div>
          </div>
          {images.length > 0 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                <Download className="h-4 w-4 mr-1" /> Download All
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                <Trash2 className="h-4 w-4 mr-1" /> Clear
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Sidebar Controls */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Prompts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder={"A sunset over mountains\nA cyberpunk city at night\nA cute cat in space\n\n(One prompt per line)"}
                  className="min-h-[160px] text-sm"
                  value={prompts}
                  onChange={(e) => setPrompts(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {promptCount} prompt{promptCount !== 1 ? "s" : ""} → {totalImages} image{totalImages !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">Image Size</Label>
                  <Select value={selectedSize} onValueChange={setSelectedSize}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZES.map((s, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">
                    Variations per prompt: {variationsPerPrompt}
                  </Label>
                  <Slider
                    value={[variationsPerPrompt]}
                    onValueChange={([v]) => setVariationsPerPrompt(v)}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={handleGenerate}
              disabled={isGenerating || promptCount === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5 mr-2" /> Generate {totalImages} Image{totalImages !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>

          {/* Gallery */}
          <div>
            {images.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Wand2 className="h-10 w-10 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-1">No images yet</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Enter your prompts on the left (one per line) and click Generate to create images in bulk.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {images.map((image) => (
                  <ImageCard key={image.id} image={image} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkImageGenerator;
