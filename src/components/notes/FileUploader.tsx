import { useState, useRef } from 'react';
import { Upload, FileText, Image, File, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onUpload: (file: File, description?: string) => Promise<boolean>;
  onCancel: () => void;
  maxSize?: number; // in bytes, default 10MB
  accept?: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUploader({ onUpload, onCancel, maxSize = MAX_FILE_SIZE, accept }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    setError(null);

    if (file.size > maxSize) {
      setError(`الملف كبير جداً. الحد الأقصى: ${(maxSize / 1024 / 1024).toFixed(0)} MB`);
      return;
    }

    setSelectedFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => Math.min(prev + 10, 90));
    }, 100);

    const success = await onUpload(selectedFile, description || undefined);

    clearInterval(progressInterval);
    setUploadProgress(100);
    setIsUploading(false);

    if (success) {
      setSelectedFile(null);
      setDescription('');
      onCancel();
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setDescription('');
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-8 w-8 text-primary" />;
    if (type === 'application/pdf') return <FileText className="h-8 w-8 text-destructive" />;
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (selectedFile) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          {getFileIcon(selectedFile.type)}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(selectedFile.size)} • {selectedFile.type || 'ملف'}
            </p>
          </div>
          {!isUploading && (
            <Button variant="ghost" size="icon" onClick={handleClear}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {isUploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              جاري الرفع... {uploadProgress}%
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="file-description">الوصف (اختياري)</Label>
          <Input
            id="file-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="وصف الملف..."
            className="text-right"
            disabled={isUploading}
          />
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isUploading}>
            إلغاء
          </Button>
          <Button size="sm" onClick={handleUpload} disabled={isUploading} className="gap-1">
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الرفع...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                رفع
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {error && (
        <div className="text-destructive text-sm text-center bg-destructive/10 p-2 rounded-lg">
          ❌ {error}
        </div>
      )}

      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">اسحب الملف هنا</p>
        <p className="text-xs text-muted-foreground mt-1">
          أو اضغط للاختيار
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          الحد الأقصى: {(maxSize / 1024 / 1024).toFixed(0)} MB
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
        accept={accept || ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="flex-1 gap-1">
          <FileText className="h-4 w-4" />
          مستند PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="flex-1 gap-1">
          <Image className="h-4 w-4" />
          صورة
        </Button>
      </div>

      <Button variant="ghost" size="sm" onClick={onCancel} className="w-full">
        إلغاء
      </Button>
    </div>
  );
}
