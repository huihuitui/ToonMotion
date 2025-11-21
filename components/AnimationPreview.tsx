import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Download, RefreshCw, Film, FileImage, FileArchive } from 'lucide-react';
import { downloadApng, downloadGif, downloadZip } from '../utils/imageUtils';

interface AnimationPreviewProps {
  frames: string[];
  fps: number;
  isLoading: boolean;
}

export const AnimationPreview: React.FC<AnimationPreviewProps> = ({ frames, fps, isLoading }) => {
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (frames.length === 0 || !isPlaying) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }

    const interval = 1000 / fps;
    timerRef.current = window.setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
    }, interval);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [frames, fps, isPlaying]);

  const handleDownload = async (type: 'APNG' | 'GIF' | 'ZIP') => {
    if (frames.length === 0) return;
    setIsDownloading(true);
    try {
      const timestamp = new Date().getTime();
      const filename = `toonmotion_${timestamp}`;
      
      if (type === 'APNG') {
        await downloadApng(frames, fps, filename);
      } else if (type === 'GIF') {
        await downloadGif(frames, fps, filename);
      } else if (type === 'ZIP') {
        await downloadZip(frames, filename);
      }
    } catch (e) {
      console.error(e);
      alert("下载失败，请重试");
    } finally {
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-[500px] bg-gray-50 rounded-2xl flex flex-col items-center justify-center border border-gray-200 shadow-inner">
        <div className="relative">
           <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-lime-500"></div>
           <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 bg-white rounded-full"></div>
           </div>
        </div>
        <p className="text-gray-600 font-medium mt-6 animate-pulse">AI 正在绘制每一帧...</p>
        <p className="text-xs text-gray-400 mt-2">Gemini 2.5 正在进行像素级生成</p>
      </div>
    );
  }

  if (frames.length === 0) {
    return (
      <div className="w-full h-[500px] bg-gray-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-gray-200 text-gray-400">
        <div className="bg-gray-100 p-5 rounded-full mb-4">
           <Film className="w-10 h-10 text-gray-300" />
        </div>
        <p className="font-medium">动画预览区域</p>
        <p className="text-xs mt-1">生成的动画将显示在这里</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Film size={18} className="text-lime-500"/> 动画预览
        </h3>
        <span className="text-xs font-mono bg-gray-200 px-2 py-1 rounded text-gray-600 font-bold">
          {frames.length} 帧
        </span>
      </div>

      {/* Canvas Area */}
      <div className="h-[360px] flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-gray-100 relative overflow-hidden group border-b border-gray-100">
        <img 
          src={frames[currentFrameIndex]} 
          alt={`Frame ${currentFrameIndex}`} 
          className="h-full w-full object-contain rendering-pixelated transition-transform duration-300 group-hover:scale-105" 
          style={{ imageRendering: 'pixelated' }}
        />
      </div>

      {/* Control Bar */}
      <div className="px-6 py-3 flex items-center justify-between bg-white border-b border-gray-100">
         <div className="flex items-center gap-4">
           <button 
             onClick={() => setIsPlaying(!isPlaying)}
             className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-lime-400 text-black hover:bg-lime-500 shadow-md shadow-lime-200'}`}
             title={isPlaying ? "暂停" : "播放"}
           >
             {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1"/>}
           </button>
           
           <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">播放进度</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-lime-500 transition-all duration-200"
                    style={{ width: `${((currentFrameIndex + 1) / frames.length) * 100}%` }}
                  ></div>
                </div>
                <span className="text-[10px] font-mono text-gray-400">
                  {currentFrameIndex + 1}/{frames.length}
                </span>
              </div>
           </div>
         </div>

         <button 
            onClick={() => setCurrentFrameIndex(0)}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
            title="重置预览"
          >
            <RefreshCw size={16} />
         </button>
      </div>

      {/* Footer Actions - Download Buttons */}
      <div className="p-5 bg-gray-50/50">
        <div className="grid grid-cols-3 gap-3">
          <button 
            onClick={() => handleDownload('APNG')}
            disabled={isDownloading}
            className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 hover:border-lime-400 hover:bg-lime-50 transition-all group bg-white"
          >
            <Download size={20} className="text-gray-600 group-hover:text-lime-600 mb-1"/>
            <span className="font-bold text-gray-700 text-sm">下载 APNG</span>
            <span className="text-[10px] text-gray-400">最佳质量</span>
          </button>

          <button 
             onClick={() => handleDownload('GIF')}
             disabled={isDownloading}
             className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 hover:border-purple-400 hover:bg-purple-50 transition-all group bg-white"
          >
            <FileImage size={20} className="text-gray-600 group-hover:text-purple-600 mb-1"/>
            <span className="font-bold text-gray-700 text-sm">下载 GIF</span>
            <span className="text-[10px] text-gray-400">兼容性好</span>
          </button>

          <button 
             onClick={() => handleDownload('ZIP')}
             disabled={isDownloading}
             className="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group bg-white"
          >
            <FileArchive size={20} className="text-gray-600 group-hover:text-blue-600 mb-1"/>
            <span className="font-bold text-gray-700 text-sm">下载序列帧</span>
            <span className="text-[10px] text-gray-400">PNG ZIP包</span>
          </button>
        </div>
      </div>
    </div>
  );
};