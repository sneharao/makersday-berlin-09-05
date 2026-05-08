import { useCallback, useState } from "react";
import { useRevalidator } from "react-router";
import {
  callUploadArtifactApi,
  type UploadArtifactResult,
} from "~/routes/api/api.library.artifacts._sdk";

export interface UseUploadArtifactApi {
  isUploading: boolean;
  uploadFile: (file: File) => Promise<UploadArtifactResult>;
}

export function useUploadArtifact(): UseUploadArtifactApi {
  const revalidator = useRevalidator();
  const [isUploading, setIsUploading] = useState<boolean>(false);

  const uploadFile = useCallback(
    async (file: File): Promise<UploadArtifactResult> => {
      setIsUploading(true);
      try {
        const result = await callUploadArtifactApi(file);
        if (result.ok) {
          revalidator.revalidate();
        }
        return result;
      } finally {
        setIsUploading(false);
      }
    },
    [revalidator],
  );

  return { isUploading, uploadFile };
}
