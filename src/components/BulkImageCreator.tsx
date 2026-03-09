import React, { useState, useRef } from 'react';
import { GeneratedImage, AppSettings, RefImage } from '@/types/image';
import { STYLE_OPTIONS, COLOR_THEMES, ASPECT_RATIOS, DELAY_OPTIONS } from '@/constants/image';
import { generateImageApi, editImageApi } from '@/lib/imageApi';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

const BulkImageCreator: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [showCreationFeed, setShowCreationFeed] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    characterPrompt: '',
    bulkPrompts: '',
    aspectRatio: '1:1',
    delayTime: 10,
    style: 'Realistic',
    colorTheme: 'Bright',
  });
  const [refImages, setRefImages] = useState<RefImage[]>([]);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const stopRequested = useRef(false);
  const pauseRequested = useRef(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length + refImages.length > 4) {
      toast({ title: "Limit reached", description: "Maximum 4 reference assets allowed.", variant: "destructive" });
      return;
    }
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setRefImages(prev => [...prev, { id: Math.random().toString(36), data: base64, mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeRefImage = (id: string) => setRefImages(prev => prev.filter(img => img.id !== id));

  const getAspectDimensions = (ratio: string, baseSize = 1024) => {
    const [w, h] = ratio.split(':').map(Number);
    if (w >= h) return { width: baseSize, height: Math.round(baseSize * (h / w)) };
    return { width: Math.round(baseSize * (w / h)), height: baseSize };
  };

  const downloadImage = (base64: string, name: string) => {
    const { width, height } = getAspectDimensions(settings.aspectRatio);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${name}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = base64;
  };

  const startGeneration = async () => {
    const promptList = settings.bulkPrompts.split('\n').filter(p => p.trim() !== '');
    if (promptList.length === 0) {
      toast({ title: "No prompts", description: "Please enter prompts in the Batch Script section.", variant: "destructive" });
      return;
    }

    // On mobile, switch to creation feed view
    if (isMobile) {
      setShowCreationFeed(true);
    }

    setIsGenerating(true);
    setIsPaused(false);
    stopRequested.current = false;
    pauseRequested.current = false;

    setImages(promptList.map((p, i) => ({ id: i, prompt: p, url: '', status: 'pending' })));

    for (let i = 0; i < promptList.length; i++) {
      if (stopRequested.current) break;
      while (pauseRequested.current && !stopRequested.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      if (stopRequested.current) break;

      setCurrentIndex(i);
      setImages(prev => prev.map((img, idx) => idx === i ? { ...img, status: 'generating' } : img));

      try {
        const finalPrompt = `
          CORE CHARACTER: ${settings.characterPrompt}
          SCENE ACTION: ${promptList[i]}
          VISUAL STYLE: ${settings.style}
          COLOR ATMOSPHERE: ${settings.colorTheme}
          ASPECT RATIO: ${settings.aspectRatio}
          Maintain consistent character details.
        `;

        const imageUrl = await generateImageApi(finalPrompt, refImages);

        setImages(prev => prev.map((img, idx) => idx === i ? { ...img, url: imageUrl, status: 'completed' } : img));
        await new Promise(r => setTimeout(r, settings.delayTime * 1000));
        downloadImage(imageUrl, `${i + 1}`);
      } catch (error) {
        console.error(error);
        setImages(prev => prev.map((img, idx) => idx === i ? { ...img, status: 'failed' } : img));
        toast({ title: "Generation failed", description: error instanceof Error ? error.message : "Unknown error", variant: "destructive" });
      }
    }
    setIsGenerating(false);
  };

  const processImageEdit = async (instruction: string) => {
    if (!selectedImage || !selectedImage.url) return;
    setIsEditing(true);
    try {
      const newUrl = await editImageApi(selectedImage.url, instruction);
      const updatedImage = { ...selectedImage, url: newUrl };
      setSelectedImage(updatedImage);
      setImages(prev => prev.map(img => img.id === selectedImage.id ? updatedImage : img));
    } catch (error) {
      console.error("Edit failed:", error);
      toast({ title: "Edit failed", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      
      {/* LEFT SIDEBAR - Hidden on mobile when showing creation feed */}
      <aside className={`${isMobile ? (showCreationFeed ? 'hidden' : 'w-full') : 'w-[420px]'} h-full bg-card/50 backdrop-blur-xl border-r border-border flex flex-col p-8 overflow-y-auto shadow-2xl z-30`} style={{ scrollbarWidth: 'thin' }}>
        
        {/* Logo */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <svg className="w-7 h-7 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Bulk Image Creator</h1>
            <p className="text-[10px] font-bold uppercase text-primary tracking-wider mt-0.5">Studio Edition</p>
          </div>
        </div>

        <div className="space-y-8 flex-1">
          {/* Reference Assets */}
          <section>
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="text-xs font-bold uppercase text-foreground tracking-wider">Reference Assets</h2>
              <span className="text-xs font-bold text-primary">{refImages.length}/4</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {refImages.map(img => (
                <div key={img.id} className="relative group aspect-square">
                  <img src={`data:${img.mimeType};base64,${img.data}`} className="w-full h-full object-cover rounded-2xl border border-border" alt="Asset" />
                  <button onClick={() => removeRefImage(img.id)} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg ring-2 ring-background">✕</button>
                </div>
              ))}
              {refImages.length < 4 && (
                <label className="aspect-square border-2 border-dashed border-border rounded-2xl flex items-center justify-center cursor-pointer hover:border-primary hover:bg-accent/50 transition-all group">
                  <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileChange} />
                  <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-md group-hover:scale-110 transition-transform">
                    <span className="text-xl font-bold">+</span>
                  </div>
                </label>
              )}
            </div>
          </section>

          {/* Character Profile */}
          <section>
            <h2 className="text-xs font-bold uppercase mb-3 px-1 text-foreground tracking-wider">Character Profile</h2>
            <textarea
              className="w-full h-24 p-4 border border-input bg-muted/30 rounded-2xl outline-none text-sm font-medium resize-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
              placeholder="Describe persistent character details..."
              value={settings.characterPrompt}
              onChange={(e) => setSettings({ ...settings, characterPrompt: e.target.value })}
            />
          </section>

          {/* Batch Script */}
          <section>
            <h2 className="text-xs font-bold uppercase mb-3 px-1 text-foreground tracking-wider">Batch Script</h2>
            <textarea
              className="w-full h-36 p-4 border border-input bg-muted/30 rounded-2xl outline-none text-sm font-medium resize-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
              style={{ scrollbarWidth: 'thin' }}
              placeholder="One prompt per line for the bulk sequence..."
              value={settings.bulkPrompts}
              onChange={(e) => setSettings({ ...settings, bulkPrompts: e.target.value })}
            />
          </section>

          {/* Settings Controls */}
          <section className="grid grid-cols-2 gap-4">
            {/* Aspect Ratio */}
            <div>
              <label className="text-[10px] font-bold uppercase ml-1 mb-2 block text-foreground tracking-wider">Aspect Ratio</label>
              <div className="relative">
                <select
                  className="w-full p-3 border border-input bg-muted/30 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-ring transition-all text-foreground"
                  value={settings.aspectRatio}
                  onChange={(e) => setSettings({ ...settings, aspectRatio: e.target.value })}
                >
                  {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input type="text" placeholder="Custom" className="mt-2 w-full p-2.5 border border-input bg-background rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
                  onBlur={(e) => e.target.value && setSettings({ ...settings, aspectRatio: e.target.value })}
                />
              </div>
            </div>

            {/* Download Delay */}
            <div>
              <label className="text-[10px] font-bold uppercase ml-1 mb-2 block text-foreground tracking-wider">Download Delay</label>
              <div className="relative">
                <select
                  className="w-full p-3 border border-input bg-muted/30 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-ring transition-all text-foreground"
                  value={settings.delayTime}
                  onChange={(e) => setSettings({ ...settings, delayTime: parseInt(e.target.value) })}
                >
                  {DELAY_OPTIONS.map(d => <option key={d} value={d}>{d} Seconds</option>)}
                </select>
                <input type="number" placeholder="Custom Sec" className="mt-2 w-full p-2.5 border border-input bg-background rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
                  onBlur={(e) => e.target.value && setSettings({ ...settings, delayTime: parseInt(e.target.value) })}
                />
              </div>
            </div>

            {/* Visual Style */}
            <div>
              <label className="text-[10px] font-bold uppercase ml-1 mb-2 block text-foreground tracking-wider">Visual Style</label>
              <div className="relative">
                <select
                  className="w-full p-3 border border-input bg-muted/30 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-ring transition-all text-foreground"
                  value={settings.style}
                  onChange={(e) => setSettings({ ...settings, style: e.target.value })}
                >
                  {STYLE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="text" placeholder="Custom Style" className="mt-2 w-full p-2.5 border border-input bg-background rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
                  onBlur={(e) => e.target.value && setSettings({ ...settings, style: e.target.value })}
                />
              </div>
            </div>

            {/* Color Tone */}
            <div>
              <label className="text-[10px] font-bold uppercase ml-1 mb-2 block text-foreground tracking-wider">Color Tone</label>
              <div className="relative">
                <select
                  className="w-full p-3 border border-input bg-muted/30 rounded-xl text-xs font-bold outline-none appearance-none cursor-pointer focus:ring-2 focus:ring-ring transition-all text-foreground"
                  value={settings.colorTheme}
                  onChange={(e) => setSettings({ ...settings, colorTheme: e.target.value })}
                >
                  {COLOR_THEMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="text" placeholder="Custom Tone" className="mt-2 w-full p-2.5 border border-input bg-background rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
                  onBlur={(e) => e.target.value && setSettings({ ...settings, colorTheme: e.target.value })}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Action Buttons */}
        <div className="mt-10">
          {!isGenerating ? (
            <button
              onClick={startGeneration}
              className="w-full py-5 px-6 rounded-2xl text-primary-foreground font-bold text-base shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ 
                background: 'var(--gradient-plum-purple)', 
                boxShadow: 'var(--shadow-xl), 0 0 20px hsl(300 47% 55% / 0.5)',
                textShadow: '0 0 20px rgba(255, 255, 255, 0.8), 0 2px 4px rgba(0, 0, 0, 0.5)'
              }}
            >
              START BATCH
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => { pauseRequested.current = !pauseRequested.current; setIsPaused(pauseRequested.current); }}
                className="flex-1 py-5 rounded-2xl bg-yellow-500 text-white font-bold shadow-lg hover:bg-yellow-600 active:scale-95 transition-all"
              >
                {isPaused ? 'RESUME' : 'PAUSE'}
              </button>
              <button
                onClick={() => { stopRequested.current = true; setIsGenerating(false); }}
                className="flex-1 py-5 rounded-2xl bg-destructive text-destructive-foreground font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all"
              >
                STOP
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT SIDE - CREATION FEED - Hidden on mobile when not showing it */}
      <main className={`${isMobile ? (showCreationFeed ? 'flex-1' : 'hidden') : 'flex-1'} relative overflow-y-auto p-6 md:p-12 bg-gradient-to-br from-background via-muted/20 to-background`} style={{ scrollbarWidth: 'thin' }}>
        
        {/* Back button for mobile */}
        {isMobile && showCreationFeed && (
          <button
            onClick={() => setShowCreationFeed(false)}
            className="mb-6 flex items-center gap-2 text-sm font-bold hover:opacity-70 transition-opacity text-foreground"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Settings
          </button>
        )}

        <header className="mb-8 md:mb-14">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight leading-none mb-4 text-foreground">Creation Feed</h2>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full shadow-md ${isGenerating ? 'animate-pulse bg-primary' : 'bg-green-500'}`}></span>
            <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
              {isGenerating ? 'Rendering frames' : 'AI Engine Online'}
            </span>
          </div>
        </header>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-12">
            <div className="w-full max-w-md aspect-square bg-card shadow-2xl flex flex-col items-center justify-center border border-border relative overflow-hidden rounded-[3rem]" style={{ animation: 'subtle-float 4s ease-in-out infinite' }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5"></div>
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-primary-foreground text-4xl font-bold shadow-xl z-10" style={{ background: 'var(--gradient-primary)' }}>
                +
              </div>
              <div className="mt-12 text-center z-10">
                <h3 className="text-3xl font-bold mb-2 tracking-tight text-foreground">Vision Workspace Ready</h3>
                <p className="text-base font-medium text-muted-foreground">Your frames will appear here.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-10 pb-24">
            {images.map((img, idx) => (
              <div
                key={img.id}
                className="group bg-card p-7 shadow-xl border border-border rounded-[2rem] transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl cursor-pointer"
                onClick={() => img.url && setSelectedImage(img)}
              >
                <div className="flex justify-between items-center mb-5">
                  <span className="text-xs font-bold uppercase px-4 py-1.5 rounded-full bg-primary/10 text-primary tracking-wide">Frame #{idx + 1}</span>
                  <span className={`text-xs font-bold uppercase tracking-wide ${
                    img.status === 'completed' ? 'text-green-500' :
                    img.status === 'generating' ? 'text-primary' :
                    img.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {img.status}
                  </span>
                </div>

                <div className="relative overflow-hidden rounded-3xl bg-muted shadow-inner" style={{ aspectRatio: settings.aspectRatio.replace(':', '/') }}>
                  {img.url ? (
                    <img src={img.url} className="w-full h-full object-cover" alt={`Frame ${idx + 1}`} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50">
                      <div className="w-10 h-10 rounded-full animate-spin mb-4 border-4 border-muted-foreground/20 border-t-primary"></div>
                      <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Rendering</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 px-1">
                  <p className="text-xs font-bold uppercase mb-2 text-muted-foreground tracking-wide">Batch Instruction</p>
                  <p className="text-sm font-medium line-clamp-2 leading-relaxed italic text-foreground">
                    "{img.prompt}"
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* EXPANDED IMAGE MODAL */}
      {selectedImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 bg-black/90 backdrop-blur-sm">
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 md:top-8 md:right-8 text-white hover:text-gray-300 transition-colors z-[110]"
          >
            <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="bg-card w-full max-w-6xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto md:overflow-hidden flex flex-col md:flex-row shadow-2xl rounded-3xl">
            {/* Image Preview - smaller on mobile */}
            <div className={`flex items-center justify-center p-3 md:p-4 bg-black ${isMobile ? 'h-[180px]' : 'flex-1 min-h-[400px]'}`}>
              {isEditing ? (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 md:w-16 md:h-16 rounded-full animate-spin mb-2 md:mb-4 border-4 border-white/20 border-t-primary"></div>
                  <span className="text-white font-bold uppercase text-xs md:text-sm tracking-wider">Processing...</span>
                </div>
              ) : (
                <img src={selectedImage.url} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt="Expanded view" />
              )}
            </div>

            {/* Sidebar Controls */}
            <div className="w-full md:w-[380px] bg-card p-5 md:p-10 flex flex-col justify-between overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="space-y-4 md:space-y-8">
                <div>
                  <h3 className="text-lg md:text-2xl font-bold mb-1 text-foreground">Editor Options</h3>
                  <p className="text-xs md:text-sm font-medium uppercase text-muted-foreground tracking-wide">Fine-tune your creation</p>
                </div>

                {/* Remove Background */}
                <button
                  onClick={() => processImageEdit("Remove the background from this image. Keep only the main subject on a clean white background.")}
                  disabled={isEditing}
                  className="w-full py-3 md:py-4 border border-border rounded-xl md:rounded-2xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 md:gap-3 transition-all disabled:opacity-50 hover:bg-accent hover:text-accent-foreground bg-muted/30 text-foreground"
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Remove Background
                </button>

                {/* Edit with Prompt */}
                <div className="space-y-2 md:space-y-3">
                  <label className="text-[10px] md:text-xs font-bold uppercase ml-1 block text-foreground tracking-wide">Edit with Prompt</label>
                  <textarea
                    className="w-full h-16 md:h-24 p-3 md:p-4 border border-input bg-muted/30 rounded-xl md:rounded-2xl text-xs md:text-sm font-medium outline-none resize-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
                    placeholder="e.g. 'Add a red hat'..."
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                  />
                  <button
                    onClick={() => {
                      if (editPrompt.trim()) {
                        processImageEdit(editPrompt);
                        setEditPrompt('');
                      }
                    }}
                    disabled={isEditing || !editPrompt.trim()}
                    className="w-full py-3 md:py-4 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 text-primary-foreground"
                    style={{ background: 'var(--gradient-primary)' }}
                  >
                    Apply Edit
                  </button>
                </div>
              </div>

              {/* Download */}
              <button
                onClick={() => downloadImage(selectedImage.url, `edit_${selectedImage.id}`)}
                className="w-full py-3 md:py-5 border-2 border-foreground font-bold text-xs md:text-sm rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all mt-5 md:mt-10 hover:bg-foreground hover:text-background text-foreground"
              >
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download Version
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes subtle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default BulkImageCreator;
