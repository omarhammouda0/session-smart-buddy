import { useState, useRef } from "react";
import { FileText, ExternalLink, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StudentMaterial } from "@/types/student";
import { cn } from "@/lib/utils";

interface StudentMaterialsDialogProps {
  studentName: string;
  studentId: string;
  materials?: StudentMaterial[];
  onAddMaterial?: (material: StudentMaterial) => void;
  onRemoveMaterial?: (materialId: string) => void;
  trigger?: React.ReactNode;
}

export function StudentMaterialsDialog({
  studentName,
  studentId,
  materials = [],
  onAddMaterial,
  onRemoveMaterial,
  trigger,
}: StudentMaterialsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isAddingText, setIsAddingText] = useState(false);
  const [newTextTitle, setNewTextTitle] = useState("");
  const [newTextContent, setNewTextContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateId = () => `mat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

  const handleOpenFile = (material: StudentMaterial) => {
    if (material.fileUrl) {
      window.open(material.fileUrl, "_blank");
    }
  };

  const handleAddTextMaterial = () => {
    if (!newTextTitle.trim() || !onAddMaterial) return;

    const newMaterial: StudentMaterial = {
      id: generateId(),
      type: "text",
      title: newTextTitle.trim(),
      content: newTextContent.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onAddMaterial(newMaterial);
    setNewTextTitle("");
    setNewTextContent("");
    setIsAddingText(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAddMaterial) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const newMaterial: StudentMaterial = {
        id: generateId(),
        type: "file",
        title: file.name,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileUrl: event.target?.result as string,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onAddMaterial(newMaterial);
    };
    reader.onerror = () => {
      alert("حدث خطأ أثناء قراءة الملف. حاول مرة أخرى.");
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const hasMaterials = materials && materials.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "h-8 w-8 shrink-0",
              hasMaterials
                ? "text-primary hover:text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title={hasMaterials ? `عرض المواد (${materials.length})` : "إضافة مواد"}
          >
            <FileText className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileText className="h-5 w-5" />
            مواد {studentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
          {/* Add Material Buttons */}
          {!isAddingText && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => setIsAddingText(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة ملاحظة
              </Button>
              <Button
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

          {/* Add Text Form */}
          {isAddingText && (
            <Card className="border-primary/30">
              <CardContent className="p-3 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="title">العنوان</Label>
                  <Input
                    id="title"
                    placeholder="عنوان الملاحظة"
                    value={newTextTitle}
                    onChange={(e) => setNewTextTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="content">المحتوى (اختياري)</Label>
                  <Textarea
                    id="content"
                    placeholder="محتوى الملاحظة..."
                    value={newTextContent}
                    onChange={(e) => setNewTextContent(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
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
                    size="sm"
                    onClick={handleAddTextMaterial}
                    disabled={!newTextTitle.trim()}
                  >
                    إضافة
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Materials List */}
          {!hasMaterials && !isAddingText ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد مواد لهذا الطالب</p>
              <p className="text-xs mt-1">اضغط على الأزرار أعلاه لإضافة مواد</p>
            </div>
          ) : (
            materials.map((material) => (
              <Card key={material.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant={material.type === "text" ? "secondary" : "outline"}
                          className="text-xs"
                        >
                          {material.type === "text" ? "📝 ملاحظة" : getFileIcon(material.fileType)}
                        </Badge>
                        <span className="font-medium text-sm truncate">{material.title}</span>
                      </div>

                      {material.type === "text" && material.content && (
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                          {material.content}
                        </p>
                      )}

                      {material.type === "file" && (
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">
                            {material.fileName} • {formatFileSize(material.fileSize)}
                          </span>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(material.createdAt).toLocaleDateString("ar-SA")}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {material.type === "file" && material.fileUrl && (
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleOpenFile(material)}
                          title="فتح الملف"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                      {onRemoveMaterial && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onRemoveMaterial(material.id)}
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

