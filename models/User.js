import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobile: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['team-member', 'lead', 'head'], default: 'team-member' },
    team: { type: String, enum: ['graphic', 'video', 'frontend', 'backend', 'app', 'all'], default: 'graphic' },
    deleted: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.User || mongoose.model('User', UserSchema);