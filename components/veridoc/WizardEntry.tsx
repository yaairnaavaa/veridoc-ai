"use client";

import { useEffect, useState } from "react";
import { Wizard } from "@/components/veridoc/Wizard";
import {
  clearPendingLabsFile,
  getPendingLabsFile,
} from "@/lib/veridoc/sessionStore";

export const WizardEntry = () => {
  const [initialLabsFile, setInitialLabsFile] = useState<File | null>(null);

  useEffect(() => {
    const pending = getPendingLabsFile();
    if (pending) {
      setInitialLabsFile(pending);
      clearPendingLabsFile();
    }
  }, []);

  return <Wizard initialLabsFile={initialLabsFile} />;
};
