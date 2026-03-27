'use client';

import { useState, useCallback, useRef } from 'react';
import { X, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadVideo } from '@/lib/api';

interface VideoUploaderProps {
  onUploaded: (data: { url: string; key: string }) => void;
  onRemove: () => void;
  uploaded?: { url: string; key: string } | null;
}

export function VideoUploader({ onUploaded, onRemove, uploaded }: VideoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('Only video files are allowed');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      setError('File must be under 500MB');
      return;
    }

    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    setProgress(0);

    try {
      const result = await uploadVideo(file, (pct) => setProgress(pct));
      onUploaded(result);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }, [onUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRemove = () => {
    setPreviewUrl(null);
    setProgress(0);
    setError(null);
    onRemove();
  };

  if (previewUrl || uploaded) {
    return (
      <div className="relative rounded-xl border-2 border-gray-200 bg-gray-50 p-4">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-10"
          onClick={handleRemove}
        >
          <X className="h-4 w-4" />
        </Button>
        {previewUrl && (
          <video
            src={previewUrl}
            className="mx-auto max-h-[400px] rounded-lg"
            controls
          />
        )}
        {uploading && (
          <div className="mt-3">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>Uploading...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {uploaded && !uploading && (
          <p className="mt-2 text-sm text-green-600 text-center">Video uploaded successfully</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer ${
          isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Film className="h-12 w-12 text-gray-400 mb-4" />
        <p className="text-sm font-medium text-gray-700">
          Drag & drop your video here, or click to browse
        </p>
        <p className="text-xs text-gray-400 mt-1">MP4, max 500MB, 9:16 ratio recommended</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
}
