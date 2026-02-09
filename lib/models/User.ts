import mongoose, { Schema, model, models, Document, Model } from 'mongoose';

// ----------------------------------------------------------------------
// 1. Interfaces (Tipado para TypeScript)
// ----------------------------------------------------------------------

export interface IAvailability {
  day: string;
  slots: string[];
}

export interface ISpecialistProfile {
  title: string;
  specialty: string;
  bio?: string;
  languages: string[];
  experienceYears: number;
  certifications: string[];
  pricePerSession: number;
  currency: string;
  image?: string; // <--- Campo opcional para la foto
  /** URL en Cloudinary del documento de título (imagen o PDF) */
  titleDocumentUrl?: string;
  /** URL en Cloudinary de la cédula (imagen o PDF) */
  cedulaUrl?: string;
  availability: IAvailability[];
  rating: number;
  reviewCount: number;
  isVerified: boolean;
  status: "draft" | "pending_review" | "published" | "suspended";
  updatedAt: Date;
}

export interface IUser extends Document {
  name: string;
  email: string;
  image?: string;
  walletAddress?: string; // ID principal
  createdAt: Date;
  specialistProfile?: ISpecialistProfile; // Subdocumento opcional
}

// ----------------------------------------------------------------------
// 2. Schemas (Estructura para MongoDB)
// ----------------------------------------------------------------------

const AvailabilitySchema = new Schema({
  day: { type: String, required: true },
  slots: [{ type: String }]
}, { _id: false });

const SpecialistProfileSchema = new Schema<ISpecialistProfile>({
  title: { type: String, trim: true },
  specialty: { type: String, required: true },
  bio: { type: String, maxlength: 1000 },
  languages: [{ type: String }],
  experienceYears: { type: Number, min: 0 },
  certifications: [{ type: String }],
  pricePerSession: { type: Number, min: 0 },
  currency: { type: String, default: "USD" },
  
  // Campo de imagen del especialista
  image: { type: String, required: false },
  titleDocumentUrl: { type: String, required: false },
  cedulaUrl: { type: String, required: false },

  availability: [AvailabilitySchema],
  
  // Métricas y Estado
  rating: { type: Number, default: 0, min: 0, max: 5 },
  reviewCount: { type: Number, default: 0 },
  isVerified: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ["draft", "pending_review", "published", "suspended"], 
    default: "draft" 
  },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new Schema<IUser>({
  name: { type: String, required: false },
  email: { type: String, required: false, unique: true, sparse: true },
  image: { type: String },
  walletAddress: { type: String, required: true, unique: true },
  
  // Aquí incrustamos el perfil
  specialistProfile: { 
    type: SpecialistProfileSchema, 
    default: undefined 
  }
}, { 
  timestamps: true,
});

// ----------------------------------------------------------------------
// 3. Exportación (Singleton)
// ----------------------------------------------------------------------

const User: Model<IUser> = models.User || model<IUser>('User', UserSchema);

export default User;