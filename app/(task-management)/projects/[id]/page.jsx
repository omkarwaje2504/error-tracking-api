'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import FileButton from '@/components/FileButton';
import ProgressModal from '@/components/ProgressModal';
import { CardSkeleton } from '@/components/Skeleton';
import { toast } from '@/lib/toast';
import { confirmDialog } from '@/lib/confirm';
import { PRIORITY_META, priorityMeta, isOverdue, formatDate } from '@/lib/taskDisplay';

const STATUS_OPTIONS = ['active', 'on-hold', 'completed', 'cancelled'];
const TYPE_OPTIONS = [
    { key: 'e-video', label: 'E-Video' },
    { key: 'ai-video', label: 'AI-Video' },
    { key: 'poster', label: 'Poster' },
    { key: 'frame', label: 'Frame' },
    { key: 'app', label: 'App' },
    { key: 'pledge', label: 'Pledge' },
    { key: 'creative', label: 'Creative' },
    { key: 'other', label: 'Other' },
];

const STAGE_LABELS = {
    kickoff: 'Kickoff Meeting',
    design: 'Design',
    development: 'Development',
    production: 'Production',
    delivery: 'Delivery',
};

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function stageDefaults(type) {
    switch (type) {
        case 'kickoff':
            return { date: '', scopeOfWork: '', attendingUsers: [] };
        case 'development':
            return { attachments: [] };
        case 'production':
            return {
                printerName: '', finalCsvAttach: null, sendDate: '', quantity: '', printType: '',
                instructions: {
                    isCsvCleaned: false, printCodeChecked: false, bleedFileShared: false,
                    fileCheckSize: false, fileCheckQuantity: false, fileCheckColors: false,
                },
                bleedFile: null, otherInstructions: '',
            };
        case 'delivery':
            return { fileReceivedDate: '', completionDate: '' };
        default:
            return {};
    }
}

const pillClass = (active) =>
    `rounded-full border border-line px-3 py-1.5 text-sm transition-colors ${active ? 'bg-neutral-900 text-white dark:bg-white dark:text-black' : 'bg-panel2 text-neutral-900 dark:text-neutral-100'
    }`;

export default function ProjectDirectory() {
    const { id } = useParams();
    const router = useRouter();

    const [user, setUser] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [form, setForm] = useState(null);
    const [createdBy, setCreatedBy] = useState(null);
    const [createdAt, setCreatedAt] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [brands, setBrands] = useState([]);
    const [users, setUsers] = useState([]);
    const [projectTasks, setProjectTasks] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [newStageType, setNewStageType] = useState('kickoff');
    const [dirty, setDirty] = useState(false);
    const [progressTask, setProgressTask] = useState(null);

    useEffect(() => { load(); }, [id]);

    useEffect(() => {
        if (!dirty) return;
        const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    async function load() {
        const me = await fetch('/api/auth/me');
        if (!me.ok) return router.push('/login');
        setUser(await me.json());

        const res = await fetch(`/api/projects/${id}`);
        if (!res.ok) { setNotFound(true); return; }
        const p = await res.json();
        setCreatedBy(p.createdBy || null);
        setCreatedAt(p.createdAt || null);

        // Migrate old fixed kickoff data (pre-dates the "kickoff as an action" model) into a real section.
        let sections = p.sections || [];
        const legacy = p.kickoff;
        const hasKickoff = sections.some((s) => s.type === 'kickoff');
        if (!hasKickoff && legacy && (legacy.date || legacy.scopeOfWork || (legacy.attendingUsers || []).length)) {
            sections = [{
                id: uid(), type: 'kickoff', createdAt: p.createdAt || new Date().toISOString(),
                data: { date: legacy.date || '', scopeOfWork: legacy.scopeOfWork || '', attendingUsers: legacy.attendingUsers || [] },
            }, ...sections];
        }

        setForm({
            name: p.name || '', description: p.description || '', link: p.link || '', status: p.status || 'active',
            company: p.company?._id || '', brand: p.brand?._id || '', client: p.client || '',
            salesPerson: p.salesPerson?._id || '', servicePerson: p.servicePerson?._id || '',
            projectType: p.projectType || '', deadline: p.deadline ? String(p.deadline).slice(0, 10) : '',
            attachments: p.attachments || [],
            sections,
        });
        setDirty(false);

        setCompanies(await (await fetch('/api/companies')).json());
        setBrands(await (await fetch('/api/brands')).json());
        setUsers(await (await fetch('/api/users')).json());
        await loadTasks();
        loadMessages();
    }

    async function loadTasks() {
        setProjectTasks(await (await fetch(`/api/tasks?project=${id}`)).json());
    }

    async function loadMessages() {
        setMessages(await (await fetch(`/api/projects/${id}/discussions`)).json());
    }

    async function save() {
        if (!form.name.trim()) return toast.error('Give the project a title before saving.');
        setSaving(true);
        try {
            const res = await fetch(`/api/projects/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (!res.ok) return toast.error('Failed to save project.');
            setDirty(false);
            toast.success('Project saved.');
        } finally {
            setSaving(false);
        }
    }

    async function removeProject() {
        const ok = await confirmDialog(`Delete "${form.name}"? It can be restored later from the database, but not from this app.`, { danger: true, confirmLabel: 'Delete project' });
        if (!ok) return;
        setDeleting(true);
        const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        setDeleting(false);
        if (!res.ok) return toast.error('Failed to delete project.');
        toast.success('Project deleted.');
        router.push('/projects');
    }

    async function uploadFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length) return [];
        const fd = new FormData();
        files.forEach((f) => fd.append('file', f));
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || 'Upload failed.'); return []; }
        toast.success(files.length > 1 ? `${files.length} files uploaded.` : 'File uploaded.');
        return data.files;
    }

    // Every form mutation should go through this so we can track unsaved changes.
    function mutate(updater) {
        setDirty(true);
        setForm((f) => (typeof updater === 'function' ? updater(f) : { ...f, ...updater }));
    }

    function set(field, value) {
        mutate((f) => ({ ...f, [field]: value }));
    }

    function selectBrand(brandId) {
        const b = brands.find((x) => x._id === brandId);
        mutate((f) => ({ ...f, brand: brandId, company: b?.company?._id || f.company }));
    }

    function addStage(type) {
        mutate((f) => ({
            ...f,
            sections: [...f.sections, { id: uid(), type, createdAt: new Date().toISOString(), data: stageDefaults(type) }],
        }));
        toast.success(`${STAGE_LABELS[type]} added — remember to Save.`);
    }

    async function removeStage(sectionId) {
        const ok = await confirmDialog('Remove this section? Any tasks already created under it stay in Tasks, just unlinked from this stage.', { danger: true, confirmLabel: 'Remove' });
        if (!ok) return;
        mutate((f) => ({ ...f, sections: f.sections.filter((s) => s.id !== sectionId) }));
    }

    function updateStage(sectionId, patch) {
        mutate((f) => ({
            ...f,
            sections: f.sections.map((s) => (s.id === sectionId ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s)),
        }));
    }

    function updateStageData(sectionId, updater) {
        updateStage(sectionId, (s) => ({ data: typeof updater === 'function' ? updater(s.data) : { ...s.data, ...updater } }));
    }

    async function sendMessage() {
        if (!newMessage.trim()) return;
        const res = await fetch(`/api/projects/${id}/discussions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: newMessage }),
        });
        if (!res.ok) return toast.error('Failed to send message.');
        setNewMessage(''); loadMessages();
    }

    async function removeMessage(msgId) {
        const ok = await confirmDialog('Delete this message?', { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        const res = await fetch(`/api/projects/${id}/discussions/${msgId}`, { method: 'DELETE' });
        if (!res.ok) return toast.error('Failed to delete message.');
        loadMessages();
    }

    const selectedBrand = useMemo(() => brands.find((b) => b._id === form?.brand), [brands, form?.brand]);

    if (notFound) {
        return (
            <Shell user={user}>
                <p className="text-neutral-500">Project not found.</p>
            </Shell>
        );
    }

    if (!form) {
        return (
            <Shell user={user}>
                <div className="space-y-4">
                    <CardSkeleton /><CardSkeleton /><CardSkeleton />
                </div>
            </Shell>
        );
    }

    const unlinkedTasks = projectTasks.filter((t) => !t.stageType);
    const pendingTasks = projectTasks.filter((t) => t.status !== 'completed').length;
    const doneTasks = projectTasks.filter((t) => t.status === 'completed').length;

    return (
        <Shell user={user}>
            <ProgressModal
                task={progressTask}
                open={!!progressTask}
                onClose={() => setProgressTask(null)}
                onChange={loadTasks}
            />

            {/* Header */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <input
                    className="min-w-0 flex-1 bg-transparent text-2xl font-semibold outline-none sm:text-3xl"
                    placeholder="Give project title here…"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                />
                <div className="flex shrink-0 items-center gap-2.5">
                    {dirty && !saving && (
                        <span className="hidden text-xs text-amber-500 sm:inline">● Unsaved changes</span>
                    )}
                    <button className="btn-primary" onClick={save} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-3">
                <select className="input w-auto capitalize" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <span className="shrink-0 font-medium text-neutral-500">Link:</span>
                    <input
                        className="input"
                        placeholder="https://…"
                        value={form.link}
                        onChange={(e) => set('link', e.target.value)}
                    />
                </div>
                <button
                    className="btn-ghost shrink-0"
                    onClick={async () => {
                        if (dirty && !(await confirmDialog('You have unsaved changes. Leave without saving?', { danger: true, confirmLabel: 'Leave' }))) return;
                        router.push('/projects');
                    }}
                >
                    ← Projects
                </button>
            </div>

            <textarea
                className="input mb-5"
                rows={4}
                placeholder="Write description…"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
            />

            {/* Meta grid */}
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                    <label className="label">Division</label>
                    <select className="input" value={form.brand} onChange={(e) => selectBrand(e.target.value)}>
                        <option value="">None</option>
                        {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Company</label>
                    {selectedBrand ? (
                        <input className="input opacity-70" disabled value={selectedBrand.company?.name || 'No company on this division'} />
                    ) : (
                        <select className="input" value={form.company} onChange={(e) => set('company', e.target.value)}>
                            <option value="">None</option>
                            {companies.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                    )}
                </div>
                <div>
                    <label className="label">Client name</label>
                    <input className="input" value={form.client} onChange={(e) => set('client', e.target.value)} />
                </div>
                <div>
                    <label className="label">Sales person</label>
                    <select className="input" value={form.salesPerson} onChange={(e) => set('salesPerson', e.target.value)}>
                        <option value="">None</option>
                        {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Service person</label>
                    <select className="input" value={form.servicePerson} onChange={(e) => set('servicePerson', e.target.value)}>
                        <option value="">None</option>
                        {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Project type</label>
                    <select className="input" value={form.projectType} onChange={(e) => set('projectType', e.target.value)}>
                        <option value="">None</option>
                        {TYPE_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Created at</label>
                    <input
                        className="input opacity-70"
                        disabled
                        value={createdAt ? `${new Date(createdAt).toLocaleDateString()}${createdBy?.name ? ` · ${createdBy.name}` : ''}` : '—'}
                    />
                </div>
                <div>
                    <label className="label">Deadline</label>
                    <input type="date" className="input" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
                    {form.deadline && form.status === 'active' && (() => {
                        const days = Math.round((new Date(form.deadline).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
                        return (
                            <p className={`mt-1.5 text-xs ${days < 0 ? 'text-red-500' : days <= 3 ? 'text-amber-500' : 'text-neutral-500'}`}>
                                {days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} left`}
                            </p>
                        );
                    })()}
                </div>
            </div>

            {/* Attachments */}
            <div className="card mb-6">
                <div className="mb-3 flex items-center justify-between">
                    <label className="label !mb-0">Multiple attachments</label>
                    <FileButton
                        label="Choose files"
                        multiple
                        onFiles={async (files) => {
                            const uploaded = await uploadFiles(files);
                            if (uploaded.length) mutate((f) => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
                        }}
                    />
                </div>
                {form.attachments.length === 0 ? (
                    <p className="text-sm text-neutral-500">No files yet.</p>
                ) : (
                    <ul className="space-y-1.5">
                        {form.attachments.map((a, i) => (
                            <li key={i} className="flex items-center justify-between gap-2 text-sm">
                                <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-neutral-700 hover:underline dark:text-neutral-300">{a.name}</a>
                                <button
                                    className="shrink-0 text-xs text-neutral-500 hover:text-red-400"
                                    onClick={() => mutate((f) => ({ ...f, attachments: f.attachments.filter((_, idx) => idx !== i) }))}
                                >✕</button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Unlinked / anonymous tasks under this project */}
            <div className="card mb-8 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="font-medium">Tasks</p>
                    <p className="text-sm text-neutral-500">
                        {pendingTasks} active · {doneTasks} completed
                        {unlinkedTasks.length > 0 && ` · ${unlinkedTasks.length} not linked to a stage`}
                    </p>
                </div>
                <button className="btn-ghost" onClick={() => router.push(`/tasks?project=${id}`)}>Manage all tasks →</button>
            </div>

            {form.sections.length === 0 && (
                <div className="card mb-8 text-center">
                    <p className="text-neutral-500">Nothing here yet — add the first action below to start the project's journey.</p>
                </div>
            )}

            {/* Dynamic journey sections */}
            {form.sections.map((s) => (
                <div key={s.id} className="mb-8">
                    <div className="mb-3 flex items-center gap-2">
                        <span className="text-sm text-neutral-500">Select next Action:</span>
                        <select
                            className="input w-auto"
                            value={s.type}
                            onChange={(e) => updateStage(s.id, { type: e.target.value, data: stageDefaults(e.target.value) })}
                        >
                            {Object.entries(STAGE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                        </select>
                        <button className="ml-auto text-xs text-neutral-500 hover:text-red-400" onClick={() => removeStage(s.id)}>Remove section ✕</button>
                    </div>

                    <div className="card">
                        {s.type === 'kickoff' && (
                            <KickoffStage section={s} users={users} updateStageData={updateStageData} />
                        )}
                        {s.type === 'design' && (
                            <StageTaskBoard
                                projectId={id} stageType="design" sectionId={s.id} users={users}
                                tasks={projectTasks} onChanged={loadTasks} openProgress={setProgressTask}
                                uploadFiles={uploadFiles} addLabel="+ Add design details…"
                            />
                        )}
                        {s.type === 'development' && (
                            <DevelopmentStage
                                projectId={id} section={s} users={users} tasks={projectTasks}
                                onChanged={loadTasks} openProgress={setProgressTask}
                                uploadFiles={uploadFiles} updateStageData={updateStageData}
                            />
                        )}
                        {s.type === 'production' && (
                            <ProductionStage section={s} uploadFiles={uploadFiles} updateStageData={updateStageData} />
                        )}
                        {s.type === 'delivery' && (
                            <DeliveryStage section={s} updateStageData={updateStageData} />
                        )}
                    </div>
                </div>
            ))}

            {/* Add new stage */}
            <div className="mb-10 flex flex-wrap items-center gap-2">
                <span className="text-neutral-500">+ Select next Action…</span>
                <select className="input w-auto" value={newStageType} onChange={(e) => setNewStageType(e.target.value)}>
                    {Object.entries(STAGE_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <button className="btn-ghost" onClick={() => addStage(newStageType)}>Add</button>
            </div>

            {/* Discussions */}
            <h2 className="mb-3 text-xl font-semibold">Discussions</h2>
            <div className="card mb-6">
                <div className="mb-4 max-h-80 space-y-3 overflow-y-auto">
                    {messages.length === 0 && <p className="text-sm text-neutral-500">No messages yet. Start the discussion.</p>}
                    {messages.map((m) => (
                        <div key={m._id} className="flex items-start justify-between gap-2 rounded-xl bg-panel2 px-3.5 py-2.5">
                            <div className="min-w-0">
                                <p className="text-xs text-neutral-500">
                                    {m.user?.name || 'Unknown'} · {new Date(m.createdAt).toLocaleString()}
                                </p>
                                <p className="whitespace-pre-wrap break-words text-sm">{m.message}</p>
                            </div>
                            {(m.user?._id === user?.id || user?.role === 'lead' || user?.role === 'head') && (
                                <button className="shrink-0 text-xs text-neutral-500 hover:text-red-400" onClick={() => removeMessage(m._id)}>✕</button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <input
                        className="input"
                        placeholder="Write a message…"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button className="btn-primary shrink-0" onClick={sendMessage}>Send</button>
                </div>
            </div>

            {/* Danger zone */}
            <div className="mb-10 flex justify-end">
                <button className="text-xs text-neutral-500 hover:text-red-500" onClick={removeProject} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Delete this project'}
                </button>
            </div>
        </Shell>
    );
}

function KickoffStage({ section, users, updateStageData }) {
    const data = section.data;
    return (
        <>
            <label className="label">Date</label>
            <input type="date" className="input mb-3.5" value={data.date} onChange={(e) => updateStageData(section.id, { date: e.target.value })} />
            <label className="label">Scope of work</label>
            <textarea className="input mb-3.5" rows={4} value={data.scopeOfWork} onChange={(e) => updateStageData(section.id, { scopeOfWork: e.target.value })} />
            <label className="label">Attending users</label>
            <div className="flex flex-wrap gap-2">
                {users.map((u) => (
                    <button
                        key={u._id} type="button"
                        className={pillClass(data.attendingUsers.includes(u._id))}
                        onClick={() => updateStageData(section.id, {
                            attendingUsers: data.attendingUsers.includes(u._id)
                                ? data.attendingUsers.filter((x) => x !== u._id)
                                : [...data.attendingUsers, u._id],
                        })}
                    >
                        {u.name}
                    </button>
                ))}
            </div>
        </>
    );
}

function TaskAddForm({ users, onSubmit, onCancel, saving, uploadFiles, submitLabel }) {
    const [form, setForm] = useState({ title: '', description: '', assignee: '', dueDate: '', priority: 'medium', trackProgress: false, unit: '', target: '', attachments: [] });

    return (
        <div className="rounded-xl border border-line p-3">
            <input
                className="input mb-2.5" placeholder="Title"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
                className="input mb-2.5" placeholder="Details (optional)" rows={2}
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="mb-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <select className="input" value={form.assignee} onChange={(e) => setForm({ ...form, assignee: e.target.value })}>
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
                <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    {Object.entries(PRIORITY_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
                </select>
            </div>
            <label className="mb-2.5 flex cursor-pointer items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                <input
                    type="checkbox" className="h-4 w-4 accent-neutral-900 dark:accent-white"
                    checked={form.trackProgress}
                    onChange={(e) => setForm({ ...form, trackProgress: e.target.checked })}
                />
                Track daily quantity (e.g. RxPad, videos)
            </label>
            {form.trackProgress && (
                <div className="mb-2.5 flex gap-2">
                    <input className="input" placeholder="Unit (RxPad)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                    <input className="input" type="number" placeholder="Target (optional)" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                </div>
            )}
            <div className="mb-2.5 flex items-center gap-2.5">
                <FileButton
                    label="Attach files"
                    multiple
                    onFiles={async (files) => {
                        const uploaded = await uploadFiles(files);
                        if (uploaded.length) setForm((f) => ({ ...f, attachments: [...f.attachments, ...uploaded] }));
                    }}
                />
                {form.attachments.length > 0 && <span className="text-xs text-neutral-500">{form.attachments.length} attached</span>}
            </div>
            <div className="flex gap-2">
                <button className="btn-primary flex-1" disabled={saving} onClick={() => onSubmit(form)}>
                    {saving ? 'Adding…' : submitLabel}
                </button>
                <button className="btn-ghost" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
}

function StageTaskRow({ task, onToggle, onDelete, openProgress }) {
    return (
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line px-3 py-2.5">
            <input
                type="checkbox" checked={task.status === 'completed'} onChange={() => onToggle(task)}
                className="h-[18px] w-[18px] shrink-0 accent-neutral-900 dark:accent-white"
            />
            <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${task.status === 'completed' ? 'text-neutral-500 line-through' : 'font-medium'}`}>{task.title}</p>
                <p className="truncate text-xs text-neutral-500">
                    {task.assignedTo?.map((u) => u.name).join(', ') || 'Unassigned'}
                    {task.dueDate && (
                        <span className={isOverdue(task) ? ' text-red-500' : ''}> · due {formatDate(task.dueDate)}</span>
                    )}
                    {task.attachments?.length > 0 && ` · ${task.attachments.length} file${task.attachments.length === 1 ? '' : 's'}`}
                </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${priorityMeta(task.priority).className}`}>{priorityMeta(task.priority).label}</span>
            {task.trackProgress && (
                <button className="btn-ghost shrink-0 !px-2.5 !py-1 !text-xs" onClick={() => openProgress(task)}>
                    {task.progress?.completed || 0}{task.target ? `/${task.target}` : ''} {task.unit || ''}
                </button>
            )}
            <button className="shrink-0 text-xs text-neutral-500 hover:text-red-400" onClick={() => onDelete(task)}>✕</button>
        </div>
    );
}

function StageTaskBoard({ projectId, stageType, sectionId, users, tasks, onChanged, openProgress, uploadFiles, addLabel }) {
    const [adding, setAdding] = useState(false);
    const [saving, setSaving] = useState(false);

    const list = tasks.filter((t) => t.stageType === stageType && t.stageId === sectionId);
    const sorted = [...list].sort((a, b) => (a.status === 'completed') - (b.status === 'completed'));

    async function toggle(t) {
        const res = await fetch(`/api/tasks/${t._id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: t.status === 'pending' ? 'completed' : 'pending' }),
        });
        if (!res.ok) return toast.error('Failed to update task.');
        onChanged();
    }

    async function del(t) {
        const ok = await confirmDialog(`Delete "${t.title}"?`, { danger: true, confirmLabel: 'Delete' });
        if (!ok) return;
        await fetch(`/api/tasks/${t._id}`, { method: 'DELETE' });
        toast.success('Task deleted.');
        onChanged();
    }

    async function submit(form) {
        if (!form.title.trim()) return toast.error('Title is required.');
        setSaving(true);
        try {
            const assignee = users.find((u) => u._id === form.assignee);
            const res = await fetch('/api/tasks', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: form.title, description: form.description, project: projectId,
                    assignedTo: form.assignee ? [form.assignee] : [],
                    department: assignee?.team || '', priority: form.priority, dueDate: form.dueDate || null,
                    trackProgress: form.trackProgress, unit: form.unit, target: form.target,
                    stageType, stageId: sectionId, attachments: form.attachments,
                }),
            });
            if (!res.ok) return toast.error('Failed to add task.');
            toast.success('Task added.');
            setAdding(false);
            onChanged();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div>
            {sorted.length === 0 && !adding && <p className="mb-3 text-sm text-neutral-500">Nothing here yet.</p>}
            {sorted.length > 0 && (
                <div className="mb-3 space-y-1.5">
                    {sorted.map((t) => (
                        <StageTaskRow key={t._id} task={t} onToggle={toggle} onDelete={del} openProgress={openProgress} />
                    ))}
                </div>
            )}
            {adding ? (
                <TaskAddForm
                    users={users} saving={saving} uploadFiles={uploadFiles}
                    onSubmit={submit} onCancel={() => setAdding(false)}
                    submitLabel="Add"
                />
            ) : (
                <button className="text-sm text-neutral-500 hover:underline" onClick={() => setAdding(true)}>{addLabel}</button>
            )}
        </div>
    );
}

function DevelopmentStage({ projectId, section, users, tasks, onChanged, openProgress, uploadFiles, updateStageData }) {
    const { attachments } = section.data;
    return (
        <>
            <div className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                    <label className="label !mb-0">Shared attachments</label>
                    <FileButton
                        label="Attach files"
                        multiple
                        onFiles={async (files) => {
                            const uploaded = await uploadFiles(files);
                            if (uploaded.length) updateStageData(section.id, (d) => ({ ...d, attachments: [...d.attachments, ...uploaded] }));
                        }}
                    />
                </div>
                {attachments.length > 0 && (
                    <ul className="space-y-1">
                        {attachments.map((a, i) => (
                            <li key={i}><a href={a.url} target="_blank" rel="noreferrer" className="text-sm text-neutral-700 hover:underline dark:text-neutral-300">{a.name}</a></li>
                        ))}
                    </ul>
                )}
            </div>
            <label className="label">Task list</label>
            <StageTaskBoard
                projectId={projectId} stageType="development" sectionId={section.id} users={users}
                tasks={tasks} onChanged={onChanged} openProgress={openProgress}
                uploadFiles={uploadFiles} addLabel="+ Add new task…"
            />
        </>
    );
}

function ProductionStage({ section, uploadFiles, updateStageData }) {
    const data = section.data;
    const checks = [
        ['isCsvCleaned', 'Is CSV cleaned'],
        ['printCodeChecked', 'Print code checked'],
        ['bleedFileShared', 'Bleed file shared'],
        ['fileCheckSize', 'File check before shared - size'],
        ['fileCheckQuantity', 'File check before shared - quantity'],
        ['fileCheckColors', 'File check before shared - colors'],
    ];
    return (
        <>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                    <label className="label">Printer name</label>
                    <input className="input" value={data.printerName} onChange={(e) => updateStageData(section.id, { printerName: e.target.value })} />
                </div>
                <div>
                    <label className="label">Final csv attach</label>
                    <FileButton
                        label={data.finalCsvAttach ? 'Replace' : 'Choose file'}
                        onFiles={async (files) => {
                            const uploaded = await uploadFiles(files);
                            if (uploaded[0]) updateStageData(section.id, { finalCsvAttach: uploaded[0] });
                        }}
                    />
                    {data.finalCsvAttach && <a href={data.finalCsvAttach.url} target="_blank" rel="noreferrer" className="mt-1.5 block truncate text-xs text-neutral-500 hover:underline">{data.finalCsvAttach.name}</a>}
                </div>
                <div>
                    <label className="label">Send date</label>
                    <input type="date" className="input" value={data.sendDate} onChange={(e) => updateStageData(section.id, { sendDate: e.target.value })} />
                </div>
                <div>
                    <label className="label">Quantity</label>
                    <input type="number" className="input" value={data.quantity} onChange={(e) => updateStageData(section.id, { quantity: e.target.value })} />
                </div>
                <div>
                    <label className="label">Print type</label>
                    <input className="input" value={data.printType} onChange={(e) => updateStageData(section.id, { printType: e.target.value })} />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-line pt-4 lg:grid-cols-3">
                <div className="space-y-2 lg:col-span-2">
                    <p className="label">Instructions</p>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                        {checks.map(([key, label]) => (
                            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                                <input
                                    type="checkbox" className="h-4 w-4 accent-neutral-900 dark:accent-white"
                                    checked={data.instructions[key]}
                                    onChange={(e) => updateStageData(section.id, (d) => ({ ...d, instructions: { ...d.instructions, [key]: e.target.checked } }))}
                                />
                                {label}
                            </label>
                        ))}
                    </div>
                </div>
                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <label className="label !mb-0">Bleed file</label>
                        <FileButton
                            label={data.bleedFile ? 'Replace' : 'Attach'}
                            onFiles={async (files) => {
                                const uploaded = await uploadFiles(files);
                                if (uploaded[0]) updateStageData(section.id, { bleedFile: uploaded[0] });
                            }}
                        />
                    </div>
                    {data.bleedFile && <a href={data.bleedFile.url} target="_blank" rel="noreferrer" className="mb-2 block truncate text-xs text-neutral-500 hover:underline">{data.bleedFile.name}</a>}
                    <textarea
                        className="input" rows={3} placeholder="Any other printing instructions…"
                        value={data.otherInstructions}
                        onChange={(e) => updateStageData(section.id, { otherInstructions: e.target.value })}
                    />
                </div>
            </div>
        </>
    );
}

function DeliveryStage({ section, updateStageData }) {
    const data = section.data;
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
                <label className="label">File received date</label>
                <input type="date" className="input" value={data.fileReceivedDate} onChange={(e) => updateStageData(section.id, { fileReceivedDate: e.target.value })} />
            </div>
            <div>
                <label className="label">Completion date</label>
                <input type="date" className="input" value={data.completionDate} onChange={(e) => updateStageData(section.id, { completionDate: e.target.value })} />
            </div>
        </div>
    );
}
