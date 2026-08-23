'use client';
import Sidebar from './Sidebar';
import ToastHost from './ToastHost';
import ConfirmHost from './ConfirmHost';

export default function Shell({ user, onAdd, children }) {
    return (
        <div className="flex min-h-screen 2xl:max-w-3/4 mx-auto flex-col md:flex-row">
            <Sidebar user={user} onAdd={onAdd} />
            <main className="flex-1 p-5 sm:p-8">{children}</main>
            <ToastHost />
            <ConfirmHost />
        </div>
    );
}
