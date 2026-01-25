let pendingLabsFile: File | null = null;

export const setPendingLabsFile = (file: File | null) => {
  pendingLabsFile = file;
};

export const getPendingLabsFile = () => pendingLabsFile;

export const clearPendingLabsFile = () => {
  pendingLabsFile = null;
};
