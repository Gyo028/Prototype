import { router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import {
    DangerButton,
    Field,
    GoldButton,
    OutlineButton,
    PageHeader,
    Panel,
    Pill,
    cx,
    inputClass,
    selectClass,
} from '@/components/dashboard/ui';
import type { PillTone } from '@/components/dashboard/ui';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

const USERS_URL = '/technical-admin/users';

type Status = 'Active' | 'Archived';

/** A staff account as sent by UserAccountController. Customers and Technical Admins are never sent. */
export type StaffUser = {
    id: number;
    name: string;
    email: string;
    role: string; // display name, e.g. "Project Manager"
    roleKey: string; // e.g. "project_manager"
    status: Status;
    added: string;
};

export type RoleOption = { value: string; label: string };

/** Sent once, right after an account is created. */
export type NewAccount = { name: string; email: string; password: string };

const roleTone: Record<string, PillTone> = {
    'Project Manager': 'cream',
    'Design Specialist': 'purple',
    Bookkeeper: 'green',
    Owner: 'yellow',
};

const statusTone: Record<Status, PillTone> = { Active: 'green', Archived: 'gray' };

const initials = (name: string) =>
    name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

type Props = {
    users: StaffUser[];
    roles: RoleOption[];
    newAccount: NewAccount | null;
};

export default function UserAccountManagement({ users, roles, newAccount }: Props) {
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All Roles');

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<StaffUser | null>(null);
    const [form, setForm] = useState({ name: '', email: '', role: roles[0]?.value ?? '' });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // The temporary password is shown once, in its own dialog, right after the account is created.
    const [created, setCreated] = useState<NewAccount | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (newAccount) {
            setCreated(newAccount);
            setCopied(false);
        }
    }, [newAccount]);

    const visibleUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter(
            (u) =>
                (roleFilter === 'All Roles' || u.role === roleFilter) &&
                (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
        );
    }, [users, query, roleFilter]);

    const openAdd = () => {
        setEditing(null);
        setForm({ name: '', email: '', role: roles[0]?.value ?? '' });
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (u: StaffUser) => {
        setEditing(u);
        setForm({ name: u.name, email: u.email, role: u.roleKey });
        setErrors({});
        setDialogOpen(true);
    };

    const saveUser = () => {
        const e: Record<string, string> = {};

        if (!form.name.trim()) e.name = 'Full name is required.';
        if (!form.email.trim()) e.email = 'Email address is required.';

        setErrors(e);
        if (Object.keys(e).length) return;

        const options = {
            preserveScroll: true,
            onStart: () => setSaving(true),
            onFinish: () => setSaving(false),
            onSuccess: () => setDialogOpen(false),
            onError: (serverErrors: Record<string, string>) => setErrors(serverErrors),
        };

        if (editing) router.patch(`${USERS_URL}/${editing.id}`, form, options);
        else router.post(USERS_URL, form, options);
    };

    const toggleArchive = () => {
        if (!editing) return;
        const action = editing.status === 'Archived' ? 'restore' : 'archive';

        router.patch(
            `${USERS_URL}/${editing.id}/${action}`,
            {},
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: () => setDialogOpen(false),
            },
        );
    };

    const copyPassword = async () => {
        if (!created) return;
        try {
            await navigator.clipboard.writeText(created.password);
            setCopied(true);
        } catch {
            setCopied(false); // clipboard blocked: the password is still visible to copy by hand
        }
    };

    return (
        <>
            <PageHeader
                title="User Accounts"
                description="Search, add and edit staff accounts. Click a user to edit their account."
            />

            {/* Toolbar: search on the left, filter and add on the right */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                {/* The wrapper sets the width, so the input can simply fill it */}
                <div className="w-full max-w-sm">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search users..."
                        aria-label="Search users"
                        className={inputClass}
                    />
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-3">
                    <div className="w-44">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className={selectClass}
                            aria-label="Filter by role"
                        >
                            <option>All Roles</option>
                            {roles.map((r) => (
                                <option key={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>
                    <GoldButton onClick={openAdd}>Add User</GoldButton>
                </div>
            </div>

            {/* Users table: click a row to edit that account */}
            <Panel className="overflow-x-auto p-0">
                <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-3" />
                            <th className="px-2 py-3 font-medium">Name</th>
                            <th className="px-2 py-3 font-medium">Email</th>
                            <th className="px-2 py-3 font-medium">Role</th>
                            <th className="px-2 py-3 font-medium">Status</th>
                            <th className="px-2 py-3 pr-4 font-medium">Date Added</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {visibleUsers.map((u) => (
                            <tr
                                key={u.id}
                                tabIndex={0}
                                aria-label={`Edit ${u.name}`}
                                onClick={() => openEdit(u)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') openEdit(u);
                                }}
                                className={cx(
                                    'cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none',
                                    u.status === 'Archived' && 'opacity-50',
                                )}
                            >
                                <td className="py-3 pl-4">
                                    <span className="flex size-8 items-center justify-center rounded-full bg-gold/70 text-[11px] font-bold text-ink">
                                        {initials(u.name)}
                                    </span>
                                </td>
                                <td className="px-2 py-3 text-ink">{u.name}</td>
                                <td className="px-2 py-3 text-ink">{u.email}</td>
                                <td className="px-2 py-3">
                                    <Pill tone={roleTone[u.role] ?? 'gray'}>{u.role}</Pill>
                                </td>
                                <td className="px-2 py-3">
                                    <Pill tone={statusTone[u.status]}>{u.status}</Pill>
                                </td>
                                <td className="px-2 py-3 pr-4 text-ink">{u.added}</td>
                            </tr>
                        ))}

                        {visibleUsers.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-ink-soft">
                                    No users found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Panel>

            {/* ---------------- Add / Edit user dialog ---------------- */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Edit User' : 'Add User'}</DialogTitle>
                        <DialogDescription>
                            {editing
                                ? `Update the account of ${editing.name}.`
                                : 'Create the account and assign a role. A temporary password is generated for you.'}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault();
                            saveUser();
                        }}
                    >
                        <Field label="Full name" htmlFor="u-name" required error={errors.name}>
                            <input
                                id="u-name"
                                className={inputClass}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                            />
                        </Field>

                        <Field label="Email address" htmlFor="u-email" required error={errors.email}>
                            <input
                                id="u-email"
                                type="email"
                                className={inputClass}
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </Field>

                        <Field label="Role" htmlFor="u-role" required error={errors.role}>
                            <select
                                id="u-role"
                                className={selectClass}
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value })}
                            >
                                {roles.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        <DialogFooter>
                            {editing && (
                                <DangerButton className="sm:mr-auto" onClick={toggleArchive} disabled={saving}>
                                    {editing.status === 'Archived' ? 'Restore Account' : 'Archive Account'}
                                </DangerButton>
                            )}
                            <OutlineButton onClick={() => setDialogOpen(false)}>Cancel</OutlineButton>
                            <GoldButton type="submit" disabled={saving}>
                                {editing ? 'Save Changes' : 'Create User'}
                            </GoldButton>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ---------------- Temporary password (shown once) ---------------- */}
            <Dialog open={created !== null} onOpenChange={(open) => !open && setCreated(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Account created</DialogTitle>
                        <DialogDescription>
                            Give this temporary password to {created?.name}. It is shown only once and cannot be
                            viewed again. They can change it in Settings after logging in.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <div>
                            <p className="text-xs text-ink-soft uppercase">Email</p>
                            <p className="text-sm text-ink">{created?.email}</p>
                        </div>
                        <div>
                            <p className="text-xs text-ink-soft uppercase">Temporary password</p>
                            <p className="rounded-md border border-gold/50 bg-gold/10 px-3 py-2 font-mono text-base tracking-wide text-ink select-all">
                                {created?.password}
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <OutlineButton onClick={copyPassword}>{copied ? 'Copied' : 'Copy password'}</OutlineButton>
                        <GoldButton onClick={() => setCreated(null)}>Done</GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}