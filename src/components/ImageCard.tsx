import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertCircle, ZoomIn } from "lucide-react";
import { GeneratedImage } from "@/lib/pollinations";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ImageCardProps {
  image: GeneratedImage;
}

const ImageCard = ({ image }: ImageCardProps) => {
  const [loaded, setLoaded] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${image.prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(image.url, "_blank");
    }
  };

  if (image.status === "pending" || image.status === "generating") {
    return (
      <Card className="aspect-square flex flex-col items-center justify-center gap-3 bg-muted/50 border-dashed">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground text-center px-4 line-clamp-2">
          {image.prompt}
        </p>
      </Card>
    );
  }

  if (image.status === "error") {
    return (
      <Card className="aspect-square flex flex-col items-center justify-center gap-3 bg-destructive/5 border-destructive/20">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-xs text-destructive text-center px-4">
          {image.error || "Failed to generate"}
        </p>
      </Card>
    );
  }

  return (
    <Card className="group relative overflow-hidden aspect-square">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={image.url}
        alt={image.prompt}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        onLoad={() => setLoaded(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
        <p className="text-white text-xs line-clamp-2 mb-2">{image.prompt}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleDownload}>
            <Download className="h-3 w-3 mr-1" /> Save
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary" className="h-7 text-xs">
                <ZoomIn className="h-3 w-3 mr-1" /> View
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl p-2">
              <img src={image.url} alt={image.prompt} className="w-full rounded-lg" />
              <p className="text-sm text-muted-foreground mt-2 px-2">{image.prompt}</p>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Card>
  );
};

export default ImageCard;
