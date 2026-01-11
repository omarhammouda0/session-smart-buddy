import { useState, useRef } from "react";
import { FileText, Upload, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentMaterial } from "@/types/student";
import { cn } from "@/lib/utils";

interface StudentMaterialsSectionProps {
  materials: StudentMaterial[];
  onMaterialsChange: (materials: StudentMaterial[]) => void;
  className?: string;
}

export function StudentMaterialsSection({
  materials,
  onMaterialsChange,
  className,
}: StudentMaterialsSectionProps) {
  const [isAddingText, setIsAddingText] = useState(false);
  const [newTextTitle, setNewTextTitle] = useState("");
  const [newTextContent, setNewTextContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateId = () => `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const handleAddTextMaterial = () => {
    if (!newTextTitle.trim()) return;

    const newMaterial: StudentMaterial = {
      id: generateId(),
      type: "text",
      title: newTextTitle.trim(),
      content: newTextContent.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onMaterialsChange([...materials, newMaterial]);
    setNewTextTitle("");
    setNewTextContent("");
    setIsAddingText(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت");
      return;
    }

    // For now, we'll store the file as a data URL for local storage
    // In production, you'd upload to Supabase storage
    const reader = new FileReader();
    reader.onload = (event) => {
      const newMaterial: StudentMaterial = {
        id: generateId(),
        type: "file",
        title: file.name,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileUrl: event.target?.result as string, // Data URL for local storage
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onMaterialsChange([...materials, newMaterial]);
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveMaterial = (materialId: string) => {
    onMaterialsChange(materials.filter((m) => m.id !== materialId));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType?: string) => {
    if (fileType?.includes("pdf")) return "📄";
    if (fileType?.includes("image")) return "🖼️";
    if (fileType?.includes("word") || fileType?.includes("document")) return "📝";
    return "📎";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5" />
          المواد والملفات (اختياري)
        </Label>
      </div>

      {/* Materials List */}
      {materials.length > 0 && (
        <div className="space-y-2">
          {materials.map((material) => (
            <Card key={material.id} className="bg-muted/50">
              <CardContent className="p-3 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={material.type === "text" ? "secondary" : "outline"} className="text-xs">
                      {material.type === "text" ? "ملاحظة" : getFileIcon(material.fileType)}
                    </Badge>
                    <span className="font-medium text-sm truncate">{material.title}</span>
                  </div>
                  {material.type === "text" && material.content && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {material.content}
                    </p>
                  )}
                  {material.type === "file" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatFileSize(material.fileSize)}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => handleRemoveMaterial(material.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Text Material Form */}
      {isAddingText ? (
        <Card className="border-primary/30">
          <CardContent className="p-3 space-y-3">
            <Input
              placeholder="عنوان الملاحظة"
              value={newTextTitle}
              onChange={(e) => setNewTextTitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="المحتوى (اختياري)"
              value={newTextContent}
              onChange={(e) => setNewTextContent(e.target.value)}
              rows={2}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsAddingText(false);
                  setNewTextTitle("");
                  setNewTextContent("");
                }}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddTextMaterial}
                disabled={!newTextTitle.trim()}
              >
                إضافة
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={() => setIsAddingText(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة ملاحظة
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            رفع ملف
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      )}

      {materials.length === 0 && !isAddingText && (
        <p className="text-xs text-muted-foreground text-center py-2">
          يمكنك إضافة ملاحظات نصية أو ملفات PDF للطالب
        </p>
      )}
    </div>
  );
}

