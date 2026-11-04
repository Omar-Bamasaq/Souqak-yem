import mongoose from "mongoose";

const storePwaInstallSchema = new mongoose.Schema(
  {
    storeProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "StoreProfile", required: true },
    installationId: { type: String, required: true, minlength: 36, maxlength: 36 }
  },
  { timestamps: true }
);

storePwaInstallSchema.index(
  { storeProfileId: 1, installationId: 1 },
  { unique: true, name: "store_pwa_installation_unique" }
);

export default mongoose.models.StorePwaInstall
  || mongoose.model("StorePwaInstall", storePwaInstallSchema);
