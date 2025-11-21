import React, { useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { AnimationPreview } from './components/AnimationPreview';
import { analyzeCharacterImage, generateSpriteSheet } from './services/geminiService';
import { sliceSpriteSheet } from './utils/imageUtils';
import { AppState } from './types';
import { Wand2, Zap, LayoutGrid, Layers, Settings2, ZoomIn, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [characterDescription, setCharacterDescription] = useState<string>("");
  const [actionPrompt, setActionPrompt] = useState<string>("");
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [fps, setFps] = useState<number>(6); 
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // New configuration states
  const [frameCount, setFrameCount] = useState<number>(6); 
  const [zoomLevel, setZoomLevel] = useState<number>(80); // Default 80%

  // Step 1: Handle Image Upload
  const handleImageSelected = async (base64: string) => {
    setOriginalImage(base64);
    setAppState(AppState.ANALYZING);
    setErrorMsg(null);
    setCharacterDescription(""); // Clear previous description

    try {
      const description = await analyzeCharacterImage(base64);
      setCharacterDescription(description);
      setAppState(AppState.READY_TO_GENERATE);
    } catch (err) {
      console.error(err);
      setErrorMsg("无法分析图片，请检查 API Key。您可以尝试直接生成。");
      // Even if analysis fails, we let them proceed, just without the description enhancement
      setAppState(AppState.READY_TO_GENERATE);
    }
  };

  // Step 2: Generate Animation
  const handleGenerate = async () => {
    if (!originalImage || !actionPrompt) return;

    setAppState(AppState.GENERATING);
    setErrorMsg(null);
    setGeneratedFrames([]);

    // Calculate rows and cols based on frame count
    let rows = 2;
    let cols = 2;
    if (frameCount === 6) { rows = 2; cols = 3; }
    if (frameCount === 8) { rows = 2; cols = 4; }
    if (frameCount === 9) { rows = 3; cols = 3; }
    // Custom handling for 4 frames could be 2x2
    if (frameCount === 4) { rows = 2; cols = 2; }

    try {
      const spriteSheetBase64 = await generateSpriteSheet(
        originalImage,
        characterDescription,
        actionPrompt,
        rows,
        cols,
        zoomLevel
      );

      // Slice the grid
      const frames = await sliceSpriteSheet(spriteSheetBase64, rows, cols, true);
      
      if (!frames || frames.length === 0) {
        throw new Error("生成的图像无法切分，请重试。");
      }

      setGeneratedFrames(frames);
      setAppState(AppState.COMPLETE);
    } catch (err: any) {
      console.error("Generation Error:", err);
      setErrorMsg(err.message || "生成失败，请尝试不同的提示词。");
      setAppState(AppState.ERROR);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans pb-10">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-lime-400 rounded-lg flex items-center justify-center shadow-sm">
              <Zap className="text-black fill-current" size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-gray-800">ToonMotion</span>
          </div>
          <div className="text-sm text-gray-600 font-medium bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
             Powered by Gemini 2.5
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-8 w-full">
        
        {/* Intro */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">让你的角色动起来</h1>
          <p className="text-gray-600 max-w-2xl">
            上传静态角色图片，输入动作描述，Gemini 将为你生成逐帧动画。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Input */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Step 1: Upload Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2 text-gray-800 text-lg">
                  <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  上传角色图片
                </h2>
                {appState === AppState.ANALYZING && (
                  <span className="text-xs text-lime-600 font-medium animate-pulse bg-lime-50 px-2 py-1 rounded flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin"/> AI 正在分析...
                  </span>
                )}
              </div>
              
              <UploadZone 
                selectedImage={originalImage}
                onImageSelected={handleImageSelected}
                onClear={() => {
                  setOriginalImage(null);
                  setAppState(AppState.IDLE);
                  setGeneratedFrames([]);
                  setCharacterDescription("");
                  setErrorMsg(null);
                }}
              />
            </div>

            {/* Step 2: Settings Card */}
            <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-all duration-300 ${!originalImage ? 'opacity-50 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
               <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2 text-gray-800 text-lg">
                  <span className="bg-black text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  动画设置
                </h2>
              </div>

              <div className="space-y-6">
                {/* Motion Prompt */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    动作提示词
                  </label>
                  <div className="relative">
                    <textarea
                      placeholder="例如：奔跑循环, 开心地跳跃, 施法动作"
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-lime-400 focus:border-lime-400 outline-none transition-all shadow-sm resize-none h-24"
                      value={actionPrompt}
                      onChange={(e) => setActionPrompt(e.target.value)}
                    />
                  </div>
                  
                  {/* Quick Prompts */}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {['奔跑循环', '发送爱心', '攻击动作', '受伤倒地'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setActionPrompt(p)}
                        className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Frame Count & FPS Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                            生成帧数
                        </label>
                        <div className="relative">
                            <select 
                                value={frameCount}
                                onChange={(e) => setFrameCount(Number(e.target.value))}
                                className="w-full bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-xl focus:ring-lime-500 focus:border-lime-500 block p-2.5 outline-none appearance-none"
                            >
                                <option value={4}>4 帧</option>
                                <option value={6}>6 帧</option>
                                <option value={8}>8 帧</option>
                                <option value={9}>9 帧</option>
                            </select>
                            <LayoutGrid size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                        </div>
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2 flex justify-between">
                            <span>播放速度</span>
                            <span className="text-lime-600">{fps} FPS</span>
                        </label>
                        <input 
                            type="range" 
                            min="1" 
                            max="12" 
                            value={fps} 
                            onChange={(e) => setFps(Number(e.target.value))}
                            className="w-full accent-lime-500 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-2"
                        />
                    </div>
                </div>

                {/* Scale Control */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-3 flex justify-between">
                     <span className="flex items-center gap-1"><ZoomIn size={14} /> 画面主体缩放</span>
                     <span className="text-gray-700">{zoomLevel}%</span>
                   </label>
                   <input 
                     type="range" 
                     min="50" 
                     max="100" 
                     step="5"
                     value={zoomLevel} 
                     onChange={(e) => setZoomLevel(Number(e.target.value))}
                     className="w-full accent-gray-800 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer"
                   />
                   <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
                      <span>50%</span>
                      <span>100%</span>
                   </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={appState === AppState.GENERATING || appState === AppState.ANALYZING || !actionPrompt}
                  className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 mt-2 shadow-md transition-all transform active:scale-[0.99]
                    ${(appState === AppState.GENERATING || appState === AppState.ANALYZING)
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                      : 'bg-lime-400 hover:bg-lime-500 text-black hover:shadow-lg hover:shadow-lime-200 border border-lime-400'}`}
                >
                  {appState === AppState.GENERATING ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> 正在生成...
                    </>
                  ) : appState === AppState.ANALYZING ? (
                    <>
                       <Loader2 size={20} className="animate-spin" /> 等待分析完成...
                    </>
                  ) : (
                    <>
                      <Wand2 size={20} /> 开始生成动画
                    </>
                  )}
                </button>

                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 mt-2">
                    {errorMsg}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Result */}
          <div className="lg:col-span-7 space-y-6">
             <div className="sticky top-24">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold flex items-center gap-2 text-gray-800 text-lg">
                    <span className="bg-gray-100 text-gray-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                    生成结果
                    </h2>
                </div>
                
                <AnimationPreview 
                  frames={generatedFrames} 
                  fps={fps}
                  isLoading={appState === AppState.GENERATING}
                />

                {/* Instructions / Tips */}
                <div className="mt-6 bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
                   <h4 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2 border-b border-gray-100 pb-2">
                     <LayoutGrid size={16} className="text-lime-500"/> 提示
                   </h4>
                   <ul className="space-y-2 text-xs text-gray-500 leading-relaxed list-disc list-inside">
                     <li>AI 会生成一张包含所有帧的拼图 (Sprite Sheet)。</li>
                     <li>为了获得最佳效果，请使用简单的动作描述，如“行走”或“跳跃”。</li>
                     <li>如果生成的角色太小，请在左侧调整“画面主体缩放”。</li>
                     <li>生成的图像默认为白底，工具会自动尝试去除背景。</li>
                   </ul>
                </div>
             </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
