export type DiagnosisMode = "text" | "none";

export type RecommendationReport = {
  summary: string;
  keyItems: string[];
  nextSteps: string[];
  questions: string[];
  disclaimer: string;
};

type InferenceInput = {
  labsFile: File;
  diagnosisMode: DiagnosisMode;
  diagnosisText?: string;
};

const describeFileType = (file: File) => {
  if (file.type === "application/pdf") return "PDF document";
  return "file";
};

export const generateLocalRecommendation = (
  input: InferenceInput,
): RecommendationReport => {
  const labsDescriptor = describeFileType(input.labsFile);
  const diagnosisProvided =
    input.diagnosisMode === "text" && Boolean(input.diagnosisText?.trim());
  const diagnosisDescriptor =
    input.diagnosisMode === "text" ? "written diagnosis notes" : "no diagnosis";

  const summary = `Your lab upload is a ${labsDescriptor} named "${input.labsFile.name}". We detected ${diagnosisDescriptor}. This mock report highlights items to review and discussion points for a clinician visit, generated entirely on-device.`;

  const keyItems = [
    `Confirm the lab panel type and reference ranges shown in the ${labsDescriptor}.`,
    diagnosisProvided
      ? "Cross-check diagnosis notes with any flagged biomarkers."
      : "Note any flagged markers or out-of-range values for follow-up.",
    "Compare results against prior labs to spot trends.",
  ];

  const nextSteps = [
    "Save this summary in a secure, private location.",
    "Prepare a short list of questions before your appointment.",
    "Schedule follow-up testing if recommended by your clinician.",
  ];

  const questions = [
    "Which results are most clinically significant for me?",
    "Should any markers be re-tested sooner than routine schedules?",
    "Are there lifestyle or medication adjustments to discuss?",
    diagnosisProvided
      ? "Does the diagnosis align with these lab patterns?"
      : "Do these labs suggest any additional screening?",
  ];

  return {
    summary,
    keyItems,
    nextSteps,
    questions,
    disclaimer:
      "Not medical advice. This summary is informational and should be reviewed with a licensed clinician.",
  };
};
