"use client";

import { useEffect, useState, useRef, ChangeEvent } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useNEAR } from "@/context/NearContext";
import { uploadSpecialistFilesToCloudinary, saveSpecialistToApi } from "@/app/actions/specialist";
import { User, Clock, Globe, Award, DollarSign, CheckCircle, Camera, Image as ImageIcon, FileCheck, IdCard, XCircle, ChevronDown, Search } from "lucide-react";

const SPECIALTIES = [
  "Anesthesiology",
  "Cardiology",
  "Dermatology",
  "Emergency Medicine",
  "Endocrinology",
  "Family Medicine",
  "Gastroenterology",
  "General Medicine",
  "Geriatrics",
  "Gynecology",
  "Hematology",
  "Infectious Disease",
  "Internal Medicine",
  "Nephrology",
  "Neurology",
  "Nutrition",
  "Obstetrics",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Otolaryngology (ENT)",
  "Pathology",
  "Pediatrics",
  "Physical Medicine & Rehabilitation",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Rheumatology",
  "Surgery",
  "Urology",
] as const;

export function SpecialistOnboardingForm({ 
  userWallet, 
  onSuccess 
}: { 
  userWallet: string;
  onSuccess?: () => void;
}) {
  const { user } = usePrivy();
  const { walletId } = useNEAR();

  // PREVIEW STATE
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [titleDocName, setTitleDocName] = useState<string | null>(null);
  const [cedulaFileName, setCedulaFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [specialtyOpen, setSpecialtyOpen] = useState(false);
  const [specialtyQuery, setSpecialtyQuery] = useState("");
  const specialtyRef = useRef<HTMLDivElement>(null);

  const filteredSpecialties = specialtyQuery.trim()
    ? SPECIALTIES.filter((s) =>
        s.toLowerCase().includes(specialtyQuery.toLowerCase())
      )
    : [...SPECIALTIES];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (specialtyRef.current && !specialtyRef.current.contains(e.target as Node)) {
        setSpecialtyOpen(false);
      }
    }
    if (specialtyOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [specialtyOpen]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (success && onSuccess) {
      const timer = setTimeout(() => {
        onSuccess();
        setPreviewUrl(null);
        setTitleDocName(null);
        setCedulaFileName(null);
        setSuccess(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [success, onSuccess]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleTitleDocChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTitleDocName(e.target.files?.[0]?.name ?? null);
  };

  const handleCedulaChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCedulaFileName(e.target.files?.[0]?.name ?? null);
  };

  const buildPayloadFromForm = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const raw: Record<string, unknown> = Object.fromEntries(
      Array.from(formData.entries()).filter(([, v]) => typeof v !== "object" || !(v instanceof File))
    );
    const imageFile = formData.get("image") as File | null;
    const titleDocFile = formData.get("titleDocument") as File | null;
    const cedulaFile = formData.get("cedula") as File | null;

    const fileInfo = (f: File | null) =>
      f?.name
        ? { name: f.name, size: f.size, type: f.type }
        : null;

    const availabilityRaw = raw.availability as string | undefined;
    let availability = raw.availability;
    if (typeof availabilityRaw === "string") {
      try {
        availability = JSON.parse(availabilityRaw);
      } catch {
        availability = availabilityRaw;
      }
    }

    const languages = typeof raw.languages === "string"
      ? raw.languages.split(",").map((s) => s.trim())
      : raw.languages;

    const payload = {
      walletAddress: userWallet,
      title: raw.title,
      specialty: raw.specialty,
      bio: raw.bio,
      languages,
      experienceYears: raw.experienceYears != null ? Number(raw.experienceYears) : 0,
      pricePerSession: raw.pricePerSession != null ? Number(raw.pricePerSession) : 0,
      availability,
      image: fileInfo(imageFile ?? null),
      titleDocument: fileInfo(titleDocFile ?? null),
      cedula: fileInfo(cedulaFile ?? null),
    };
    return payload;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const payload = buildPayloadFromForm(form);
    const payloadWithWallets = {
      ...payload,
      nearAddress: walletId ?? null,
      privyWallet: user?.wallet?.address ?? null,
    };

    console.log("Specialist payload (objeto construido):", payloadWithWallets);

    setUploading(true);
    try {
      const formData = new FormData(form);
      const urls = await uploadSpecialistFilesToCloudinary(formData);
      console.log("URLs de Cloudinary (image, titleDocument, cedula):", urls);

      const languagesArray = Array.isArray(payload.languages)
        ? payload.languages
        : typeof payload.languages === "string"
          ? payload.languages.split(",").map((s: string) => s.trim())
          : [];

      const document = {
        professionalTitle: String(payload.title ?? ""),
        specialty: String(payload.specialty ?? ""),
        biography: String(payload.bio ?? ""),
        yearsOfExperience: payload.experienceYears ?? 0,
        consultationPrice: payload.pricePerSession ?? 0,
        languages: languagesArray,
        nearAddress: walletId ?? "",
        privyWallet: user?.wallet?.address ?? "",
        profileImageUrl: urls.imageUrl ?? "",
        licenseDocumentUrl: urls.cedulaUrl ?? "",
        degreeDocumentUrl: urls.titleDocumentUrl ?? ""      
      };
      console.log("Documento (formato final):", document);

      const result = await saveSpecialistToApi(document);
      if (result.ok) {
        setToast({ message: "Information saved successfully", type: "success" });
        setSuccess(true);
      } else {
        setToast({
          message: (result.error ?? (result.status ? `Error ${result.status}` : "Error saving to the API.")) || "Error saving to the API.",
          type: "error",
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const inputClassName = "w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:ring-teal-500 placeholder:text-slate-400";

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-in zoom-in duration-300">
        <div className="rounded-full bg-green-100 p-4 mb-4">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900">Specialist Saved!</h3>
        <p className="text-slate-500 mt-2">Preparing form for the next one...</p>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-in slide-in-from-right-4 duration-300 ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 text-red-600" />
          )}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* ----- PROFILE PHOTO SECTION ----- */}
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="relative group">
          <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-slate-100 shadow-md">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={previewUrl} 
                alt="Preview" 
                className="h-full w-full object-cover" 
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <ImageIcon className="h-12 w-12" />
              </div>
            )}
          </div>
          
          <label 
            htmlFor="image-upload" 
            className="absolute bottom-0 right-0 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-teal-600 text-white shadow-sm transition hover:bg-teal-700 group-hover:scale-110"
            title="Upload photo"
          >
            <Camera className="h-5 w-5" />
          </label>
          
          <input 
            id="image-upload"
            type="file" 
            name="image" 
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>
        <p className="text-sm text-slate-500">Profile Photo (Optional)</p>
      </div>

      {/* Section 1: Professional Data */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <User className="w-5 h-5 text-teal-600" />
          Professional Details
        </h3>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Professional Title</label>
            <input 
              name="title" 
              placeholder="Ex: Dr. John Doe" 
              className={inputClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Specialty</label>
            <div ref={specialtyRef} className="relative">
              <input type="hidden" name="specialty" value={selectedSpecialty} />
              <div
                role="combobox"
                aria-expanded={specialtyOpen}
                aria-haspopup="listbox"
                aria-controls="specialty-listbox"
                id="specialty-combobox"
                className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-0 ${specialtyOpen ? "border-teal-400 ring-2 ring-teal-500/20" : "hover:border-slate-300"}`}
                onClick={() => setSpecialtyOpen((o) => { if (!o) setSpecialtyQuery(""); return !o; })}
              >
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={specialtyOpen ? specialtyQuery : selectedSpecialty}
                  onChange={(e) => {
                    setSpecialtyQuery(e.target.value);
                    setSpecialtyOpen(true);
                  }}
                  onFocus={() => setSpecialtyOpen(true)}
                  placeholder={selectedSpecialty || "Search specialty..."}
                  className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-slate-400"
                  aria-autocomplete="list"
                  aria-activedescendant={undefined}
                />
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${specialtyOpen ? "rotate-180" : ""}`} />
              </div>
              {specialtyOpen && (
                <ul
                  id="specialty-listbox"
                  role="listbox"
                  className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
                  aria-labelledby="specialty-combobox"
                >
                  {filteredSpecialties.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-slate-500">No specialty matches</li>
                  ) : (
                    filteredSpecialties.map((s) => (
                      <li
                        key={s}
                        role="option"
                        aria-selected={selectedSpecialty === s}
                        className={`cursor-pointer px-4 py-2.5 text-sm transition ${selectedSpecialty === s ? "bg-teal-50 text-teal-800 font-medium" : "text-slate-700 hover:bg-slate-50"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSpecialty(s);
                          setSpecialtyQuery("");
                          setSpecialtyOpen(false);
                        }}
                      >
                        {s}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Bio</label>
          <textarea 
            name="bio" 
            rows={3}
            placeholder="Describe your experience..." 
            className={inputClassName}
          />
        </div>
      </div>

      {/* Section: Verification (degree and license documents in Cloudinary) */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-teal-600" />
          Verification
        </h3>
        <p className="text-sm text-slate-500">
          Optional documents, but required to get your profile verified. Image or PDF.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <FileCheck className="w-3 h-3" /> Degree document
            </label>
            <label className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 cursor-pointer hover:bg-slate-100 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500">
              <span className="font-medium text-slate-700">Select file</span>
              <span className="text-xs text-slate-500">{titleDocName ?? "PNG, JPG, PDF"}</span>
              <input
                type="file"
                name="titleDocument"
                accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf"
                className="hidden"
                onChange={handleTitleDocChange}
              />
            </label>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
              <IdCard className="w-3 h-3" /> License document
            </label>
            <label className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 cursor-pointer hover:bg-slate-100 focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500">
              <span className="font-medium text-slate-700">Select file</span>
              <span className="text-xs text-slate-500">{cedulaFileName ?? "PNG, JPG, PDF"}</span>
              <input
                type="file"
                name="cedula"
                accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf"
                className="hidden"
                onChange={handleCedulaChange}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Section 2: Consultation Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-teal-600" />
          Consultation Details
        </h3>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
             <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
               <Clock className="w-3 h-3" /> Years Exp.
             </label>
             <input type="number" name="experienceYears" defaultValue={0} className={inputClassName} />
          </div>
          
          <div className="space-y-2">
             <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
               <DollarSign className="w-3 h-3" /> Price ($)
             </label>
             <input type="number" name="pricePerSession" defaultValue={50} className={inputClassName} />
          </div>

          <div className="space-y-2">
             <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
               <Globe className="w-3 h-3" /> Languages
             </label>
             <input name="languages" placeholder="English, Spanish" className={inputClassName}/>
          </div>
        </div>
      </div>

      <input type="hidden" name="availability" value='[{"day":"Mon","slots":["09:00","10:00"]}]' />

      <div className="pt-4">
        <button 
          type="submit" 
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 active:scale-95 disabled:opacity-50"
        >
          {uploading ? "Uploading to Cloudinary…" : "Save Profile"}
        </button>
      </div>
    </form>
    </>
  );
}