import mongoose, { Schema, model, models } from 'mongoose';

const LabSchema = new Schema({
  fileName: { type: String, required: true },
  contentType: { type: String, required: true },
  fileData: { type: Buffer, required: true }, // Aquí se guardan los bytes del PDF
  size: { type: Number, required: true },
  uploadDate: { type: Date, default: Date.now },
});

// Evitamos recompilar el modelo si ya existe
const Lab = models.Lab || model('Lab', LabSchema);

export default Lab;