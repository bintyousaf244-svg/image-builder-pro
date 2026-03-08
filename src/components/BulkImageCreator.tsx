import React, { useState, useRef } from 'react';
import { GeneratedImage, AppSettings, RefImage } from '@/types/image';
import { STYLE_OPTIONS, COLOR_THEMES, ASPECT_RATIOS, DELAY_OPTIONS } from '@/constants/image';
import { generateImageApi, editImageApi } from '@/lib/imageApi';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile, useIsTablet } from '@/hooks/use-mobile';

const BulkImageCreator: React.FC = () => {
  const { toast } = useToast();
  const isMobileDevice = useIsMobile();
  const isTabletDevice = useIsTablet();
  const isCompact = isMobileDevice || isTabletDevice;
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
    if (isCompact) {
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
    <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: '#fffcfd', fontFamily: "'Inter', sans-serif" }}>
      
      {/* LEFT SIDEBAR - Hidden on mobile when showing creation feed */}
      <aside className={`${isCompact ? (showCreationFeed ? 'hidden' : 'w-full') : 'w-[440px]'} h-full bg-white/90 backdrop-blur-xl border-r border-gray-100 flex flex-col p-8 overflow-y-auto shadow-2xl z-30`} style={{ scrollbarWidth: 'thin' }}>
        
        {/* Logo */}
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 rounded-[20px] flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(135deg, #dcfce7, #f3e8ff)' }}>
            <svg className="w-7 h-7" style={{ color: '#1a1c23' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-tight" style={{ color: '#1a1c23' }}>Bulk Image Creator</h1>
            <p className="text-[10px] font-black uppercase mt-1" style={{ color: '#9333ea', letterSpacing: '0.25em' }}>Studio Edition</p>
          </div>
        </div>

        <div className="space-y-8 flex-1">
          {/* Reference Assets */}
          <section>
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="text-[11px] font-black uppercase flex items-center gap-2" style={{ color: '#1a1c23', letterSpacing: '0.15em' }}>Reference Assets</h2>
              <span className="text-[11px] font-black" style={{ color: '#2563eb' }}>{refImages.length}/4</span>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {refImages.map(img => (
                <div key={img.id} className="relative group aspect-square">
                  <img src={`data:${img.mimeType};base64,${img.data}`} className="w-full h-full object-cover rounded-[16px] shadow-sm border border-white" alt="Asset" />
                  <button onClick={() => removeRefImage(img.id)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-lg ring-1 ring-white">✕</button>
                </div>
              ))}
              {refImages.length < 4 && (
                <label className="aspect-square border-2 border-dashed rounded-[16px] flex items-center justify-center cursor-pointer hover:border-blue-400 transition-all group" style={{ borderColor: '#bfdbfe', backgroundColor: '#f0f9ff' }}>
                  <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileChange} />
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform">
                    <span className="text-lg font-bold">+</span>
                  </div>
                </label>
              )}
            </div>
          </section>

          {/* Character Profile */}
          <section>
            <h2 className="text-[11px] font-black uppercase mb-3 px-1" style={{ color: '#1a1c23', letterSpacing: '0.15em' }}>Character Profile</h2>
            <textarea
              className="w-full h-24 p-4 border outline-none text-sm font-semibold resize-none shadow-sm focus:ring-2 focus:ring-blue-100 transition-all"
              style={{ backgroundColor: '#f0f9ff', borderColor: '#dbeafe', borderRadius: '20px', color: '#1a1c23' }}
              placeholder="Describe persistent character details..."
              value={settings.characterPrompt}
              onChange={(e) => setSettings({ ...settings, characterPrompt: e.target.value })}
            />
          </section>

          {/* Batch Script */}
          <section>
            <h2 className="text-[11px] font-black uppercase mb-3 px-1" style={{ color: '#1a1c23', letterSpacing: '0.15em' }}>Batch Script</h2>
            <textarea
              className="w-full h-36 p-4 border outline-none text-sm font-semibold resize-none shadow-sm focus:ring-2 focus:ring-blue-100 transition-all"
              style={{ backgroundColor: '#f0f9ff', borderColor: '#dbeafe', borderRadius: '20px', color: '#1a1c23', scrollbarWidth: 'thin' }}
              placeholder="One prompt per line for the bulk sequence..."
              value={settings.bulkPrompts}
              onChange={(e) => setSettings({ ...settings, bulkPrompts: e.target.value })}
            />
          </section>

          {/* Settings Controls */}
          <section className="grid grid-cols-2 gap-4">
            {/* Aspect Ratio */}
            <div>
              <label className="text-[10px] font-black uppercase ml-1 mb-1.5 block" style={{ color: '#1a1c23', letterSpacing: '0.1em' }}>Aspect Ratio</label>
              <div className="relative">
                <select
                  className="w-full p-3 border text-xs font-black outline-none appearance-none cursor-pointer"
                  style={{ backgroundColor: '#f0f9ff', borderColor: '#dbeafe', borderRadius: '14px', color: '#1f2937' }}
                  value={settings.aspectRatio}
                  onChange={(e) => setSettings({ ...settings, aspectRatio: e.target.value })}
                >
                  {ASPECT_RATIOS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <input type="text" placeholder="Custom" className="mt-1.5 w-full p-2 border text-[10px] font-bold outline-none" style={{ backgroundColor: '#fff', borderColor: '#eff6ff', borderRadius: '8px', color: '#1f2937' }}
                  onBlur={(e) => e.target.value && setSettings({ ...settings, aspectRatio: e.target.value })}
                />
              </div>
            </div>

            {/* Download Delay */}
            <div>
              <label className="text-[10px] font-black uppercase ml-1 mb-1.5 block" style={{ color: '#1a1c23', letterSpacing: '0.1em' }}>Download Delay</label>
              <div className="relative">
                <select
                  className="w-full p-3 border text-xs font-black outline-none appearance-none cursor-pointer"
                  style={{ backgroundColor: '#f0f9ff', borderColor: '#dbeafe', borderRadius: '14px', color: '#1f2937' }}
                  value={settings.delayTime}
                  onChange={(e) => setSettings({ ...settings, delayTime: parseInt(e.target.value) })}
                >
                  {DELAY_OPTIONS.map(d => <option key={d} value={d}>{d} Seconds</option>)}
                </select>
                <input type="number" placeholder="Custom Sec" className="mt-1.5 w-full p-2 border text-[10px] font-bold outline-none" style={{ backgroundColor: '#fff', borderColor: '#eff6ff', borderRadius: '8px', color: '#1f2937' }}
                  onBlur={(e) => e.target.value && setSettings({ ...settings, delayTime: parseInt(e.target.value) })}
                />
              </div>
            </div>

            {/* Visual Style */}
            <div>
              <label className="text-[10px] font-black uppercase ml-1 mb-1.5 block" style={{ color: '#1a1c23', letterSpacing: '0.1em' }}>Visual Style</label>
              <div className="relative">
                <select
                  className="w-full p-3 border text-xs font-black outline-none appearance-none cursor-pointer"
                  style={{ backgroundColor: '#f0f9ff', borderColor: '#dbeafe', borderRadius: '14px', color: '#1f2937' }}
                  value={settings.style}
                  onChange={(e) => setSettings({ ...settings, style: e.target.value })}
                >
                  {STYLE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <input type="text" placeholder="Custom Style" className="mt-1.5 w-full p-2 border text-[10px] font-bold outline-none" style={{ backgroundColor: '#fff', borderColor: '#eff6ff', borderRadius: '8px', color: '#1f2937' }}
                  onBlur={(e) => e.target.value && setSettings({ ...settings, style: e.target.value })}
                />
              </div>
            </div>

            {/* Color Tone */}
            <div>
              <label className="text-[10px] font-black uppercase ml-1 mb-1.5 block" style={{ color: '#1a1c23', letterSpacing: '0.1em' }}>Color Tone</label>
              <div className="relative">
                <select
                  className="w-full p-3 border text-xs font-black outline-none appearance-none cursor-pointer"
                  style={{ backgroundColor: '#f0f9ff', borderColor: '#dbeafe', borderRadius: '14px', color: '#1f2937' }}
                  value={settings.colorTheme}
                  onChange={(e) => setSettings({ ...settings, colorTheme: e.target.value })}
                >
                  {COLOR_THEMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="text" placeholder="Custom Tone" className="mt-1.5 w-full p-2 border text-[10px] font-bold outline-none" style={{ backgroundColor: '#fff', borderColor: '#eff6ff', borderRadius: '8px', color: '#1f2937' }}
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
              className="w-full py-5 px-6 text-white font-black text-lg shadow-md transition-all transform active:scale-95 flex items-center justify-center gap-3 hover:shadow-xl"
              style={{ background: 'linear-gradient(to right, #4ade80, #a855f7)', borderRadius: '22px' }}
            >
              START BATCH
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => { pauseRequested.current = !pauseRequested.current; setIsPaused(pauseRequested.current); }}
                className="flex-1 py-5 text-white font-black shadow-lg active:scale-95 transition-all"
                style={{ backgroundColor: '#facc15', borderRadius: '22px' }}
              >
                {isPaused ? 'RESUME' : 'PAUSE'}
              </button>
              <button
                onClick={() => { stopRequested.current = true; setIsGenerating(false); }}
                className="flex-1 py-5 text-white font-black shadow-lg active:scale-95 transition-all"
                style={{ backgroundColor: '#ef4444', borderRadius: '22px' }}
              >
                STOP
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* RIGHT SIDE - CREATION FEED - Hidden on mobile when not showing it */}
      <main className={`${isCompact ? (showCreationFeed ? 'flex-1' : 'hidden') : 'flex-1'} relative overflow-y-auto p-6 md:p-12`} style={{ background: 'linear-gradient(135deg, #fdf4ff, #ffffff, rgba(240,255,244,0.1))', scrollbarWidth: 'thin' }}>
        
        {/* Back button for mobile/tablet */}
        {isCompact && showCreationFeed && (
          <button
            onClick={() => setShowCreationFeed(false)}
            className="mb-6 flex items-center gap-2 text-sm font-bold hover:opacity-70 transition-opacity"
            style={{ color: '#1a1c23' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Settings
          </button>
        )}

        <header className="mb-8 md:mb-14">
          <h2 className="font-black tracking-[-0.04em] leading-none mb-3" style={{ fontSize: '56px', color: '#1a1c23' }}>Creation Feed</h2>
          <div className="flex items-center gap-2.5">
            <span className={`w-3 h-3 rounded-full shadow-md ${isGenerating ? 'animate-pulse' : ''}`} style={{ backgroundColor: isGenerating ? '#3b82f6' : '#4ade80' }}></span>
            <span className="text-[11px] font-black uppercase" style={{ color: '#6b7280', letterSpacing: '0.2em' }}>
              {isGenerating ? 'Rendering frames' : 'AI Engine Online'}
            </span>
          </div>
        </header>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-12">
            <div className="w-[440px] h-[440px] bg-white shadow-2xl flex flex-col items-center justify-center border border-gray-50 relative overflow-hidden" style={{ borderRadius: '80px', animation: 'subtle-float 4s ease-in-out infinite' }}>
              <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.04), transparent, rgba(74,222,128,0.04))' }}></div>
              <div className="w-20 h-20 rounded-[28px] flex items-center justify-center text-white text-4xl font-black shadow-xl z-10" style={{ background: 'linear-gradient(135deg, #4ade80, #a855f7)' }}>
                +
              </div>
              <div className="mt-12 text-center z-10">
                <h3 className="text-3xl font-black mb-2 tracking-tight" style={{ color: '#1a1c23' }}>Vision Workspace Ready</h3>
                <p className="text-base font-bold" style={{ color: '#9ca3af', opacity: 0.6 }}>Your frames will appear here.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-10 pb-24">
            {images.map((img, idx) => (
              <div
                key={img.id}
                className="group bg-white p-7 shadow-xl border border-gray-50 transition-all duration-300 hover:-translate-y-2 cursor-pointer hover:shadow-purple-100/30"
                style={{ borderRadius: '40px' }}
                onClick={() => img.url && setSelectedImage(img)}
              >
                <div className="flex justify-between items-center mb-5">
                  <span className="text-[10px] font-black uppercase px-3.5 py-1 rounded-full" style={{ backgroundColor: '#eff6ff', color: '#2563eb', letterSpacing: '0.05em' }}>Frame #{idx + 1}</span>
                  <span className={`text-[9px] font-black uppercase ${
                    img.status === 'completed' ? 'text-green-500' :
                    img.status === 'generating' ? 'text-blue-500' :
                    img.status === 'failed' ? 'text-red-500' : 'text-gray-300'
                  }`} style={{ letterSpacing: '0.1em' }}>
                    {img.status}
                  </span>
                </div>

                <div className="relative overflow-hidden shadow-inner" style={{ borderRadius: '32px', backgroundColor: '#f9fafb', aspectRatio: settings.aspectRatio.replace(':', '/') }}>
                  {img.url ? (
                    <img src={img.url} className="w-full h-full object-cover" alt={`Frame ${idx + 1}`} />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: 'rgba(249,250,251,0.5)' }}>
                      <div className="w-10 h-10 rounded-full animate-spin mb-4" style={{ border: '4px solid #eff6ff', borderTopColor: '#3b82f6' }}></div>
                      <span className="text-[9px] font-black uppercase" style={{ color: '#9ca3af', letterSpacing: '0.3em' }}>Rendering</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 px-1">
                  <p className="text-[9px] font-black uppercase mb-1.5" style={{ color: '#9ca3af', letterSpacing: '0.1em' }}>Batch Instruction</p>
                  <p className="text-xs font-bold line-clamp-2 leading-relaxed italic" style={{ color: '#1f2937' }}>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}>
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 md:top-8 md:right-8 text-white hover:text-gray-300 transition-colors z-[110]"
          >
            <svg className="w-7 h-7 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>

          <div className="bg-white w-full max-w-6xl max-h-[95vh] md:max-h-[90vh] overflow-y-auto md:overflow-hidden flex flex-col md:flex-row shadow-2xl" style={{ borderRadius: isCompact ? '24px' : '40px' }}>
            {/* Image Preview - smaller on mobile/tablet */}
            <div className={`flex items-center justify-center p-3 md:p-4 ${isCompact ? 'h-[180px]' : 'flex-1 min-h-[400px]'}`} style={{ backgroundColor: '#111827' }}>
              {isEditing ? (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 md:w-16 md:h-16 rounded-full animate-spin mb-2 md:mb-4" style={{ border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#3b82f6' }}></div>
                  <span className="text-white font-bold uppercase text-[10px] md:text-sm" style={{ letterSpacing: '0.1em' }}>Processing...</span>
                </div>
              ) : (
                <img src={selectedImage.url} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" alt="Expanded view" />
              )}
            </div>

            {/* Sidebar Controls */}
            <div className="w-full md:w-[380px] bg-white p-5 md:p-10 flex flex-col justify-between overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="space-y-4 md:space-y-8">
                <div>
                  <h3 className="text-base md:text-2xl font-black mb-1" style={{ color: '#1a1c23' }}>Editor Options</h3>
                  <p className="text-[9px] md:text-xs font-bold uppercase" style={{ color: '#9ca3af', letterSpacing: '0.1em' }}>Fine-tune your creation</p>
                </div>

                {/* Remove Background */}
                <button
                  onClick={() => processImageEdit("Remove the background from this image. Keep only the main subject on a clean white background.")}
                  disabled={isEditing}
                  className="w-full py-3 md:py-4 border font-black text-xs md:text-sm rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all disabled:opacity-50 hover:bg-blue-50"
                  style={{ backgroundColor: '#f0f9ff', borderColor: '#dbeafe', color: '#2563eb' }}
                >
                  <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Remove Background
                </button>

                {/* Edit with Prompt */}
                <div className="space-y-2 md:space-y-3">
                  <label className="text-[9px] md:text-[10px] font-black uppercase ml-1 block" style={{ color: '#1a1c23', letterSpacing: '0.1em' }}>Edit with Prompt</label>
                  <textarea
                    className="w-full h-16 md:h-24 p-3 md:p-4 border text-xs md:text-sm font-semibold outline-none resize-none"
                    style={{ backgroundColor: '#f0f9ff', borderColor: '#dbeafe', borderRadius: isMobile ? '12px' : '16px', color: '#1a1c23' }}
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
                    className="w-full py-3 md:py-4 font-black text-xs md:text-sm rounded-xl md:rounded-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(to right, #4ade80, #a855f7)', color: '#000000' }}
                  >
                    Apply Edit
                  </button>
                </div>
              </div>

              {/* Download */}
              <button
                onClick={() => downloadImage(selectedImage.url, `edit_${selectedImage.id}`)}
                className="w-full py-3 md:py-5 border-2 font-black text-xs md:text-sm rounded-xl md:rounded-2xl flex items-center justify-center gap-2 md:gap-3 transition-all mt-5 md:mt-10 hover:bg-muted"
                style={{ borderColor: '#1a1c23', color: '#1a1c23' }}
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
