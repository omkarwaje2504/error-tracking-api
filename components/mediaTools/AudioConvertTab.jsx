'use client';
import { useState } from 'react';
import { Input, Output, Conversion, ALL_FORMATS, BlobSource, Mp3OutputFormat, WavOutputFormat, FlacOutputFormat, OggOutputFormat, AdtsOutputFormat, BufferTarget, Quality } from 'mediabunny';
import FileDropZone from './FileDropZone';
import JobList from './JobList';
import { downloadBlob, replaceExt } from '@/lib/mediaTools';

// Each output format exposes its own .mimeType/.fileExtension, so we don't
// have to hardcode either — just instantiate and read them off.
const FORMATS = {
    mp3: { label: 'MP3', make: () => new Mp3OutputFormat() },
    wav: { label: 'WAV', make: () => new WavOutputFormat() },
    flac: { label: 'FLAC', make: () => new FlacOutputFormat() },
    ogg: { label: 'OGG (Vorbis/Opus)', make: () => new OggOutputFormat() },
    m4a: { label: 'M4A (AAC)', make: () => new AdtsOutputFormat() },
};

const QUALITY_OPTIONS = [
    { value: '', label: 'Original / default' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low — smallest file' },
];

let nextId = 1;

/**
 * Extracts/converts the audio track from any video or audio file into a
 * chosen audio format — video track (if any) is always discarded. Runs
 * entirely in the browser via Mediabunny (WebCodecs).
 */
export default function AudioConvertTab() {
    const [format, setFormat] = useState('mp3');
    const [quality, setQuality] = useState('');
    const [jobs, setJobs] = useState([]);
    const [running, setRunning] = useState(false);

    function addFiles(files) {
        setJobs((prev) => [
            ...prev,
            ...files.map((f) => ({ id: nextId++, file: f, name: f.name, status: 'queued', progress: 0, originalSize: f.size })),
        ]);
    }

    async function processOne(job) {
        setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'processing', progress: 0 } : j)));
        try {
            const target = FORMATS[format];
            const outputFormat = target.make();
            const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(job.file) });
            const output = new Output({ format: outputFormat, target: new BufferTarget() });
            const conversion = await Conversion.init({
                input, output,
                video: { discard: true }, // audio-only containers — always drop any video track
                audio: quality ? { quality: new Quality(quality) } : undefined,
            });
            if (!conversion.isValid) throw new Error('This file has no audio track that can be converted to the chosen format.');
            conversion.onProgress = (p) => setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, progress: p } : j)));
            await conversion.execute();
            const blob = new Blob([output.target.buffer], { type: outputFormat.mimeType });
            const resultName = replaceExt(job.name, outputFormat.fileExtension);
            setJobs((prev) => prev.map((j) => (j.id === job.id
                ? { ...j, status: 'done', progress: 1, resultBlob: blob, resultName, resultSize: blob.size }
                : j)));
        } catch (err) {
            setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'error', error: err.message || 'Conversion failed.' } : j)));
        }
    }

    async function runAll() {
        setRunning(true);
        for (const job of jobs) {
            if (job.status === 'queued') await processOne(job);
        }
        setRunning(false);
    }

    const queuedCount = jobs.filter((j) => j.status === 'queued').length;

    return (
        <div className="space-y-4">
            <p className="text-sm text-neutral-500">
                Convert any video or audio file to MP3, WAV, FLAC, OGG or M4A — the video track (if any) is dropped, audio only. Runs entirely in your browser.
            </p>
            <FileDropZone
                accept="audio/*,video/*"
                onFiles={addFiles}
                label="Drop video or audio files here, or click to browse"
                hint="MP4, MOV, MKV, WebM, MP3, WAV, M4A, FLAC…"
            />
            <div className="flex flex-wrap gap-3">
                <div>
                    <label className="label">Convert to</label>
                    <select className="input w-auto" value={format} onChange={(e) => setFormat(e.target.value)}>
                        {Object.entries(FORMATS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label">Quality</label>
                    <select className="input w-auto" value={quality} onChange={(e) => setQuality(e.target.value)}>
                        {QUALITY_OPTIONS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
                    </select>
                </div>
            </div>
            {jobs.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    <button className="btn-primary" onClick={runAll} disabled={running || queuedCount === 0}>
                        {running ? 'Converting…' : `Convert ${queuedCount || jobs.length} file${(queuedCount || jobs.length) === 1 ? '' : 's'}`}
                    </button>
                    {jobs.some((j) => j.status === 'done') && (
                        <button className="btn-ghost" onClick={() => jobs.filter((j) => j.status === 'done').forEach((j) => downloadBlob(j.resultBlob, j.resultName))}>
                            Download all
                        </button>
                    )}
                    <button className="btn-ghost" onClick={() => setJobs([])} disabled={running}>Clear</button>
                </div>
            )}
            <JobList jobs={jobs} />
        </div>
    );
}
