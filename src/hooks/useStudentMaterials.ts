// Student Materials Hook - Database Synced Version
// Stores materials in Supabase with user isolation

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StudentMaterial } from "@/types/student";
import { toast } from "sonner";

interface MaterialsStorage {
  [studentId: string]: StudentMaterial[];
}

export function useStudentMaterials() {
  const [materialsMap, setMaterialsMap] = useState<MaterialsStorage>({});
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user ID
  const getUserId = useCallback(async (): Promise<string | null> => {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Auth error:", error);
      return null;
    }
    return data.user?.id ?? null;
  }, []);

  // Load all materials from database
  const loadMaterials = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("student_materials")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading materials:", error);
        setIsLoading(false);
        return;
      }

      // Group by student_id
      const grouped: MaterialsStorage = {};
      (data || []).forEach((item) => {
        const material: StudentMaterial = {
          id: item.id,
          type: item.type as "text" | "file",
          title: item.title,
          content: item.content || undefined,
          fileUrl: item.file_url || undefined,
          fileName: item.file_name || undefined,
          fileSize: item.file_size || undefined,
          fileType: item.file_type || undefined,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        };
        if (!grouped[item.student_id]) {
          grouped[item.student_id] = [];
        }
        grouped[item.student_id].push(material);
      });

      setMaterialsMap(grouped);
    } catch (error) {
      console.error("Error loading materials:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize
  useEffect(() => {
    const init = async () => {
      const uid = await getUserId();
      if (uid) {
        setUserId(uid);
        await loadMaterials(uid);
      } else {
        setIsLoading(false);
      }
    };
    init();
  }, [getUserId, loadMaterials]);

  // Get materials for a specific student
  const getMaterials = useCallback(
    (studentId: string): StudentMaterial[] => {
      return materialsMap[studentId] || [];
    },
    [materialsMap]
  );

  // Add a single material
  const addMaterial = useCallback(
    async (studentId: string, material: Omit<StudentMaterial, "id" | "createdAt" | "updatedAt"> | StudentMaterial) => {
      const currentUserId = userId || await getUserId();
      if (!currentUserId) {
        toast.error("يجب تسجيل الدخول أولاً");
        return false;
      }

      try {
        const { data, error } = await supabase
          .from("student_materials")
          .insert({
            user_id: currentUserId,
            student_id: studentId,
            type: material.type,
            title: material.title,
            content: material.content || null,
            file_url: material.fileUrl || null,
            file_name: material.fileName || null,
            file_size: material.fileSize || null,
            file_type: material.fileType || null,
          })
          .select()
          .single();

        if (error) {
          console.error("Error adding material:", error);
          toast.error("فشل إضافة المادة");
          return false;
        }

        if (data) {
          const newMaterial: StudentMaterial = {
            id: data.id,
            type: data.type as "text" | "file",
            title: data.title,
            content: data.content || undefined,
            fileUrl: data.file_url || undefined,
            fileName: data.file_name || undefined,
            fileSize: data.file_size || undefined,
            fileType: data.file_type || undefined,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };

          setMaterialsMap((prev) => ({
            ...prev,
            [studentId]: [newMaterial, ...(prev[studentId] || [])],
          }));
        }

        toast.success("تم إضافة المادة بنجاح");
        return true;
      } catch (error) {
        console.error("Error adding material:", error);
        toast.error("فشل إضافة المادة");
        return false;
      }
    },
    [userId, getUserId]
  );

  // Add multiple materials
  const addMaterials = useCallback(
    async (studentId: string, materials: (Omit<StudentMaterial, "id" | "createdAt" | "updatedAt"> | StudentMaterial)[]) => {
      for (const material of materials) {
        await addMaterial(studentId, material);
      }
    },
    [addMaterial]
  );

  // Remove a material
  const removeMaterial = useCallback(
    async (studentId: string, materialId: string) => {
      try {
        const { error } = await supabase
          .from("student_materials")
          .delete()
          .eq("id", materialId);

        if (error) {
          console.error("Error removing material:", error);
          toast.error("فشل حذف المادة");
          return false;
        }

        setMaterialsMap((prev) => ({
          ...prev,
          [studentId]: (prev[studentId] || []).filter((m) => m.id !== materialId),
        }));

        toast.success("تم حذف المادة");
        return true;
      } catch (error) {
        console.error("Error removing material:", error);
        toast.error("فشل حذف المادة");
        return false;
      }
    },
    []
  );

  // Clear all materials for a student
  const clearStudentMaterials = useCallback(
    async (studentId: string) => {
      try {
        const { error } = await supabase
          .from("student_materials")
          .delete()
          .eq("student_id", studentId);

        if (error) {
          console.error("Error clearing materials:", error);
          return false;
        }

        setMaterialsMap((prev) => {
          const newMap = { ...prev };
          delete newMap[studentId];
          return newMap;
        });

        return true;
      } catch (error) {
        console.error("Error clearing materials:", error);
        return false;
      }
    },
    []
  );

  // Set all materials for a student (replaces existing) - for backward compatibility
  const setMaterials = useCallback(
    async (studentId: string, materials: StudentMaterial[]) => {
      await clearStudentMaterials(studentId);
      for (const material of materials) {
        await addMaterial(studentId, material);
      }
    },
    [clearStudentMaterials, addMaterial]
  );

  // Get total count of materials for a student
  const getMaterialsCount = useCallback(
    (studentId: string): number => {
      return (materialsMap[studentId] || []).length;
    },
    [materialsMap]
  );

  return {
    getMaterials,
    addMaterials,
    setMaterials,
    addMaterial,
    removeMaterial,
    clearStudentMaterials,
    getMaterialsCount,
    isLoading,
  };
}

