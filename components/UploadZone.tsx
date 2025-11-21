import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';
import { fileToBase64 } from '../utils/imageUtils';

interface UploadZoneProps {
  onImageSelected: (base64: string) => void;
  selectedImage: string | null;
  onClear: () => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onImageSelected, selectedImage, onClear }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const base64 = await fileToBase64(e.target.files[0]);
      onImageSelected(base64);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const base64 = await fileToBase64(e.dataTransfer.files[0]);
      onImageSelected(base64);
    }
  };

  if (selectedImage) {
    return (
      <div className="relative w-full h-64 bg-gray-50 rounded-xl overflow-hidden border border-gray-200 group shadow-inner">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
        <img src={selectedImage} alt="Original Character" className="w-full h-full object-contain relative z-10" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
          <button 
            onClick={onClear}
            className="bg-white/90 text-red-600 px-4 py-2 rounded-full font-medium flex items-center gap-2 hover:bg-white shadow-lg transform hover:scale-105 transition-all"
          >
            <X size={18} /> 移除图片
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`w-full h-64 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group
        ${isDragging ? 'border-lime-500 bg-lime-50' : 'border-gray-300 hover:border-lime-400 hover:bg-gray-50'}`}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/png, image/jpeg, image/webp" 
        onChange={handleFileChange}
      />
      <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:shadow-md transition-all group-hover:scale-110 duration-300">
        <Upload className={`w-8 h-8 ${isDragging ? 'text-lime-600' : 'text-gray-400 group-hover:text-lime-500'}`} />
      </div>
      <p className="text-gray-700 font-semibold group-hover:text-lime-600 transition-colors">点击或拖拽上传图片</p>
      <p className="text-gray-400 text-xs mt-2">支持 PNG, JPG, WEBP</p>
    </div>
  );
};