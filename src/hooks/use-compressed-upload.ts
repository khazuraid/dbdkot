'use client';

import { useCallback, useState } from 'react';
import imageCompression from 'browser-image-compression';

export type CompressedUploadState = {
    compressing: boolean;
    lastStats: {
        originalKb: number;
        compressedKb: number;
    } | null;
};

export function useCompressedUpload() {
    const [state, setState] = useState<CompressedUploadState>({
        compressing: false,
        lastStats: null,
    });

    const compressIfImage = useCallback(async (file: File): Promise<File> => {
        if (!file.type.startsWith('image/')) {
            setState({ compressing: false, lastStats: null });
            return file;
        }
        setState((prev) => ({ ...prev, compressing: true }));
        try {
            const compressed = await imageCompression(file, {
                maxSizeMB: 0.4,
                maxWidthOrHeight: 1600,
                useWebWorker: true,
            });
            const finalFile = new File([compressed], file.name, {
                type: compressed.type || file.type,
            });
            setState({
                compressing: false,
                lastStats: {
                    originalKb: Math.round(file.size / 1024),
                    compressedKb: Math.round(finalFile.size / 1024),
                },
            });
            return finalFile;
        } catch {
            setState({ compressing: false, lastStats: null });
            return file;
        }
    }, []);

    return { ...state, compressIfImage };
}
