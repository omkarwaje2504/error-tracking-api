'use client';

export function Skeleton({ className = '' }) {
    return <div className={`animate-pulse rounded-md bg-neutral-500/15 ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
    return (
        <div className="w-full">
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex items-center gap-4 border-b border-line/60 px-4 py-3.5 last:border-0">
                    {Array.from({ length: cols }).map((__, c) => (
                        <Skeleton key={c} className={`h-3.5 ${c === 0 ? 'w-1/4' : 'flex-1'}`} />
                    ))}
                </div>
            ))}
        </div>
    );
}

export function CardSkeleton() {
    return (
        <div className="card space-y-3">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
        </div>
    );
}
