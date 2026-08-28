import mongoose from 'mongoose';

const TaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Team members freely move a top-level task between pending/done; only a
    // lead/head can promote done -> completed, or send it back to pending
    // (a "revert", optionally with revertNote explaining why). Subtasks
    // skip this review step entirely and just use pending/completed.
    status: { type: String, enum: ['pending', 'done', 'completed'], default: 'pending' },
    revertNote: { type: mongoose.Schema.Types.Mixed, default: null }, // { text, by, byName, at }
    deleted: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.Task || mongoose.model('Task', TaskSchema);