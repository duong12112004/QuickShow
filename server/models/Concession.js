import mongoose from "mongoose";

export const CONCESSION_STATUS = {
    ACTIVE: "ACTIVE",
    INACTIVE: "INACTIVE"
};

export const CONCESSION_CATEGORY = {
    COMBO: "COMBO",
    POPCORN: "POPCORN",
    DRINK: "DRINK",
    SNACK: "SNACK"
};

const concessionSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    imageUrl: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    category: {
        type: String,
        enum: Object.values(CONCESSION_CATEGORY),
        default: CONCESSION_CATEGORY.COMBO
    },
    status: {
        type: String,
        enum: Object.values(CONCESSION_STATUS),
        default: CONCESSION_STATUS.ACTIVE
    },
    sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

const Concession = mongoose.model("Concession", concessionSchema);
export default Concession;
