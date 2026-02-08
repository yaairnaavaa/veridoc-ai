"use client";

import { useActionState, useEffect, useState, ChangeEvent } from "react";
import { updateSpecialistProfile } from "@/app/actions/specialist";
import { User, Stethoscope, Clock, Globe, Award, DollarSign, CheckCircle, Camera, Image as ImageIcon } from "lucide-react";

export function SpecialistOnboardingForm({ 
  userWallet, 
  onSuccess 
}: { 
  userWallet: string;
  onSuccess?: () => void;
}) {
  const updateProfileWithId = updateSpecialistProfile.bind(null, userWallet);
  
  const [state, formAction, isPending] = useActionState(updateProfileWithId, {
    success: false,
    message: "",
    errors: {},
  });

  // PREVIEW STATE
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (state.success && onSuccess) {
      const timer = setTimeout(() => {
        onSuccess();
        setPreviewUrl(null); // Clear preview on reset
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, onSuccess]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const inputClassName = "w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:ring-teal-500 placeholder:text-slate-400";

  if (state.success) {
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
    <form action={formAction} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
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
            {state.errors?.title && <p className="text-red-500 text-xs">{state.errors.title}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Specialty</label>
            <select 
              name="specialty" 
              className={inputClassName}
            >
              <option value="">Select...</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Dermatology">Dermatology</option>
              <option value="General Medicine">General Medicine</option>
              <option value="Neurology">Neurology</option>
              <option value="Nutrition">Nutrition</option>
            </select>
            {state.errors?.specialty && <p className="text-red-500 text-xs">{state.errors.specialty}</p>}
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
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-full bg-slate-900 px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800 active:scale-95 disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Specialist"}
        </button>
        {state.message && !state.success && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-center text-sm font-medium text-red-700">
            {state.message}
          </div>
        )}
      </div>
    </form>
  );
}