
import React, { useRef, useState, ReactElement, ReactNode } from 'react';
import { Upload, CheckCircle } from 'lucide-react';

interface FileUploaderProps {
  id: string;
  label: ReactNode;
  accept: string;
  file: File | null;
  onFileSelect: (file: File) => void;
  description: string;
  icon?: React.ReactNode;
  compact?: boolean;
  className?: string;
  variant?: 'default' | 'construction';
}

const FileUploader: React.FC<FileUploaderProps> = ({ 
  id, 
  label, 
  accept, 
  file, 
  onFileSelect, 
  description,
  icon,
  compact = false,
  className = "",
  variant = 'default'
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  // Determine styles based on variant
  const isConstruction = variant === 'construction';
  
  const getBorderColor = () => {
    if (isDragging) {
        return isConstruction 
            ? 'border-dragonfly-orange bg-dragonfly-orange/10 scale-[1.01] shadow-[0_0_15px_rgba(248,130,35,0.3)]' 
            : 'border-dragonfly-turquoise bg-dragonfly-turquoise/10 scale-[1.01] shadow-[0_0_15px_rgba(0,166,143,0.3)]';
    }
    if (file) {
        return isConstruction 
            ? 'border-dragonfly-orange bg-slate-900 shadow-sm' 
            : 'border-dragonfly-turquoise bg-slate-900 shadow-sm';
    }
    return isConstruction
        ? 'border-slate-700 bg-slate-900 hover:border-dragonfly-orange hover:bg-slate-800'
        : 'border-slate-700 bg-slate-900 hover:border-dragonfly-turquoise hover:bg-slate-800';
  };

  const getIconColor = () => {
    if (file) return 'text-dragonfly-turquoise';
    if (isDragging) return isConstruction ? 'text-dragonfly-orange' : 'text-dragonfly-turquoise';
    return 'text-slate-500 group-hover:text-dragonfly-turquoise'; // Default hover
  };
  
  // Custom group hover text color class
  const groupHoverTextColor = isConstruction 
    ? 'group-hover:text-dragonfly-orange' 
    : 'group-hover:text-dragonfly-turquoise';

  return (
    <div className={`w-full group ${className}`}>
      <div className="block text-xs md:text-sm font-bold text-gray-300 mb-1 md:mb-2 uppercase tracking-wide">
        {label}
      </div>
      
      <div 
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center w-full 
          ${compact ? 'h-24 md:h-32' : 'h-32 md:h-40'}
          rounded-lg border-2 border-dashed transition-all duration-300 cursor-pointer
          ${getBorderColor()}
        `}
      >
        <div className="flex flex-col items-center justify-center text-center px-4 pointer-events-none w-full overflow-hidden">
          {file ? (
            <div className="flex flex-col items-center">
              <div className={`${isConstruction ? 'text-dragonfly-orange' : 'text-dragonfly-turquoise'} mb-2`}>
                <CheckCircle size={compact ? 20 : 28} strokeWidth={2.5} className="drop-shadow-lg" />
              </div>
              <p className="mb-0.5 text-xs md:text-sm font-bold text-gray-100 truncate max-w-[180px] md:max-w-[200px]">
                {file.name}
              </p>
              {!compact && (
                <p className="text-[10px] font-mono text-gray-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className={`mb-1 md:mb-2 transition-colors duration-300 ${isDragging ? (isConstruction ? 'text-dragonfly-orange' : 'text-dragonfly-turquoise') : `text-slate-500 ${groupHoverTextColor}`}`}>
                {icon ? React.cloneElement(icon as ReactElement<any>, { size: compact ? 20 : 28 }) : <Upload size={compact ? 20 : 28} />}
              </div>
              <p className={`text-xs md:text-sm font-medium ${isDragging ? (isConstruction ? 'text-dragonfly-orange' : 'text-dragonfly-turquoise') : 'text-gray-400'}`}>
                <span className={`font-bold underline decoration-2 ${isConstruction ? 'decoration-dragonfly-orange' : 'decoration-dragonfly-turquoise'} underline-offset-4`}>Upload</span>
                {!compact && " or drag & drop"}
              </p>
              {!compact && (
                <p className={`text-[10px] mt-1 ${isDragging ? (isConstruction ? 'text-dragonfly-orange/70' : 'text-dragonfly-turquoise/70') : 'text-gray-500'}`}>
                  {description}
                </p>
              )}
            </div>
          )}
        </div>
        <input 
          id={id} 
          ref={inputRef}
          type="file" 
          accept={accept} 
          className="hidden" 
          onChange={handleChange}
        />
      </div>
    </div>
  );
};

export default FileUploader;