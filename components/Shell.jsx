'use client';
import Sidebar from './Sidebar';

export default function Shell({ user, onAdd, children }) {
    return (
        <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar user={user} onAdd={onAdd} />
            <main className="flex-1 p-5 sm:p-8">{children}</main>
        </div>
    );
}