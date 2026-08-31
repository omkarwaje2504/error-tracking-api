'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { getSession } from '@/lib/session';
import VideoCompressTab from '@/components/mediaTools/VideoCompressTab';
import VideoConvertTab from '@/components/mediaTools/VideoConvertTab';
import AudioConvertTab from '@/components/mediaTools/AudioConvertTab';
import ImageConvertTab from '@/components/mediaTools/ImageConvertTab';
import ImageToPdfTab from '@/components/mediaTools/ImageToPdfTab';
import PdfMergeTab from '@/components/mediaTools/PdfMergeTab';
import PdfCompressTab from '@/components/mediaTools/PdfCompressTab';

const TABS = [
    { key: 'video-compress', label: 'Video Compressor', icon: '🎬', Component: VideoCompressTab },
    { key: 'video-convert', label: 'Video Converter', icon: '🔁', Component: VideoConvertTab },
    { key: 'audio-convert', label: 'Audio Converter', icon: '🎧', Component: AudioConvertTab },
    { key: 'image-convert', label: 'Image Converter', icon: '🖼️', Component: ImageConvertTab },
    { key: 'image-to-pdf', label: 'Image → PDF', icon: '📸', Component: ImageToPdfTab },
    { key: 'pdf-merge', label: 'PDF Merger', icon: '📎', Component: PdfMergeTab },
    { key: 'pdf-compress', label: 'PDF Compressor', icon: '📉', Component: PdfCompressTab },
];

export default function MediaTools() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [tab, setTab] = useState(TABS[0].key);

    useEffect(() => {
        (async () => {
            const me = await getSession();
            if (!me) return router.push('/login');
            setUser(me);
        })();
    }, []);

    const active = TABS.find((t) => t.key === tab) || TABS[0];
    const Active = active.Component;

    return (
        <Shell user={user}>
            <div className="mb-7">
                <h1 className="text-2xl font-semibold sm:text-3xl">Media Tools</h1>
                <p className="mt-1 text-neutral-500">
                    Compress and convert video, audio, images and PDFs — everything runs locally in your browser, nothing is uploaded anywhere.
                </p>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                            t.key === tab
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-panel2 text-neutral-600 hover:text-fg dark:text-neutral-400'
                        }`}
                    >
                        <span>{t.icon}</span>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="card">
                <Active />
            </div>
        </Shell>
    );
}
