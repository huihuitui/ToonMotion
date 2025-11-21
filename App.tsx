import React, { useState } from 'react';
import { UploadZone } from './components/UploadZone';
import { AnimationPreview } from './components/AnimationPreview';
import { generateSpriteSheet } from './services/geminiService';
import { sliceSpriteSheet } from './utils/imageUtils';
import { AppState } from './types';
import { Wand2, Zap, LayoutGrid, Loader2, RotateCcw } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [actionPrompt, setActionPrompt] = useState<string>("");
  const [generatedFrames, setGeneratedFrames] = useState<string[]>([]);
  const [fps, setFps] = useState<number>(6); 
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Configuration state - Default to 4 for stability
  const [frameCount, setFrameCount] = useState<number>(4); 

  // Step 1: Handle Image Upload
  const handleImageSelected = (base64: string) => {
    setOriginalImage(base64);
    setAppState(AppState.READY_TO_GENERATE);
    setErrorMsg(null);
    // Pre-fill a default action if empty to encourage user
    if (!actionPrompt) setActionPrompt("闲置动作");
  };

  // Step 2: Generate Animation
  const handleGenerate = async () => {
    if (!originalImage) {
        setErrorMsg("请先上传图片");
        return;
    }
    if (!actionPrompt) {
        setErrorMsg("请输入动作描述");
        return;
    }

    setAppState(AppState.GENERATING);
    setErrorMsg(null);
    setGeneratedFrames([]);

    // Calculate rows and cols based on frame count
    // NOTE: This must match the logic in geminiService implicitly via params
    let rows = 2;
    let cols = 2; // Default 4 frames (2x2)
    
    if (frameCount === 4) { rows = 2; cols = 2; }
    if (frameCount === 6) { rows = 2; cols = 3; }
    if (frameCount === 8) { rows = 2; cols = 4; }
    if (frameCount === 9) { rows = 3; cols = 3; }

    try {
      const spriteSheetBase64 = await generateSpriteSheet(
        originalImage,
        actionPrompt,
        rows,
        cols
      );

      // Slice the grid using Fixed Grid slicing
      const frames = await sliceSpriteSheet(spriteSheetBase64, rows, cols, true);
      
      if (!frames || frames.length === 0) {
        throw new Error("图像处理失败，请重试。");
      }

      setGeneratedFrames(frames);
      setAppState(AppState.COMPLETE);
    } catch (err: any) {
      console.error("Generation Error:", err);
      setErrorMsg(err.message || "生成失败，请尝试不同的提示词。");
      setAppState(AppState.ERROR);
    }
  };

  const handleReset = () => {
      setAppState(AppState.IDLE);
      setGeneratedFrames([]);
      setErrorMsg(null);
      // Keep the image and prompt for easier retry
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
                  上传角色图片
                </h2>
              </div>
              
              <UploadZone 
                selectedImage={originalImage}
                onImageSelected={handleImageSelected}
                onClear={() => {
                  setOriginalImage(null);
                  setAppState(AppState.IDLE);
                  setGeneratedFrames([]);
                  setErrorMsg(null);
                }}
              />
            </div>

            {/* Step 2: Settings Card */}
            <div className={`bg-white rounded-2xl p-6 shadow-sm border border-gray-100 transition-all duration-300 ${!originalImage ? 'opacity-50 pointer-events-none grayscale-[0.5]' : 'opacity-100'}`}>
               <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold flex items-center gap-2 text-gray-800 text-lg">
                  动画设置
                </h2>
                {appState === AppState.ERROR && (
                    <button onClick={handleReset} className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-800">
                        <RotateCcw size={12} /> 重置状态
                    </button>
                )}
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
                      className={`w-full border rounded-xl px-4 py-3 outline-none transition-all shadow-sm resize-none h-24
                        ${!actionPrompt && errorMsg ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-2 focus:ring-lime-400 focus:border-lime-400'}
                      `}
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
                                <option value={4}>4 帧 (最稳定)</option>
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

                <button
                  onClick={handleGenerate}
                  disabled={appState === AppState.GENERATING}
                  className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 mt-2 shadow-md transition-all transform active:scale-[0.99]
                    ${(appState === AppState.GENERATING)
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' 
                      : 'bg-lime-400 hover:bg-lime-500 text-black hover:shadow-lg hover:shadow-lime-200 border border-lime-400'}`}
                >
                  {appState === AppState.GENERATING ? (
                    <>
                      <Loader2 size={20} className="animate-spin" /> 正在生成...
                    </>
                  ) : (
                    <>
                      <Wand2 size={20} /> 开始生成动画
                    </>
                  )}
                </button>

                {errorMsg && (
                  <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 mt-2 animate-pulse">
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
                    生成结果
                    </h2>
                </div>
                
                <AnimationPreview 
                  frames={generatedFrames} 
                  fps={fps}
                  isLoading={appState === AppState.GENERATING}
                />
             </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;