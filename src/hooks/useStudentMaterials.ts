import { useState, useEffect, useCallback } from "react";
import { StudentMaterial } from "@/types/student";

const MATERIALS_STORAGE_KEY = "student-materials";

interface MaterialsStorage {
  [studentId: string]: StudentMaterial[];
}

export function useStudentMaterials() {
  const [materialsMap, setMaterialsMap] = useState<MaterialsStorage>(() => {
    try {
      const stored = localStorage.getItem(MATERIALS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  // Save to localStorage whenever materialsMap changes
  useEffect(() => {
    try {
      localStorage.setItem(MATERIALS_STORAGE_KEY, JSON.stringify(materialsMap));
    } catch (error) {
      console.error("Error saving materials to localStorage:", error);
    }
  }, [materialsMap]);

  // Get materials for a specific student
  const getMaterials = useCallback(
    (studentId: string): StudentMaterial[] => {
      return materialsMap[studentId] || [];
    },
    [materialsMap]
  );

  // Add materials for a student
  const addMaterials = useCallback(
    (studentId: string, materials: StudentMaterial[]) => {
      setMaterialsMap((prev) => ({
        ...prev,
        [studentId]: [...(prev[studentId] || []), ...materials],
      }));
    },
    []
  );

  // Set all materials for a student (replaces existing)
  const setMaterials = useCallback(
    (studentId: string, materials: StudentMaterial[]) => {
      setMaterialsMap((prev) => ({
        ...prev,
        [studentId]: materials,
      }));
    },
    []
  );

  // Add a single material
  const addMaterial = useCallback(
    (studentId: string, material: StudentMaterial) => {
      setMaterialsMap((prev) => ({
        ...prev,
        [studentId]: [...(prev[studentId] || []), material],
      }));
    },
    []
  );

  // Remove a material
  const removeMaterial = useCallback(
    (studentId: string, materialId: string) => {
      setMaterialsMap((prev) => ({
        ...prev,
        [studentId]: (prev[studentId] || []).filter((m) => m.id !== materialId),
      }));
    },
    []
  );

  // Remove all materials for a student
  const clearStudentMaterials = useCallback(
    (studentId: string) => {
      setMaterialsMap((prev) => {
        const newMap = { ...prev };
        delete newMap[studentId];
        return newMap;
      });
    },
    []
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
  };
}

