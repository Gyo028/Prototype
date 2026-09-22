import { useMemo, useState } from 'react';
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

/* ------------------------------------------------------------------ */
/* Types and constants                                                */
/* ------------------------------------------------------------------ */

/*
 * The roles and what each role can access are defined in code by the developer
 * (App\Enums\Role and the role middleware). The Technical Admin only picks one
 * of these roles for each account.
 */
const ROLES = ['Customer', 'Project Manager', 'Design Specialist', 'Bookkeeper', 'Owner', 'Technical Admin'] as const;
type RoleName = (typeof ROLES)[number];

type Status = 'Active' | 'Archived';

type User = { id: number; name: string; email: string; role: RoleName; status: Status; added: string };

const roleTone: Record<RoleName, PillTone> = {
    Customer: 'blue',
    'Project Manager': 'cream',
    'Design Specialist': 'purple',
    Bookkeeper: 'green',
    Owner: 'yellow',
    'Technical Admin': 'gray',
};

const statusTone: Record<Status, PillTone> = { Active: 'green', Archived: 'gray' };

// Placeholder data until the database is connected.
const seedUsers: User[] = [
    { id: 1, name: 'Juan dela Cruz', email: 'juan@email.com', role: 'Customer', status: 'Active', added: 'May 24' },
    { id: 2, name: 'Ana Reyes', email: 'ana@email.com', role: 'Project Manager', status: 'Active', added: 'May 22' },
    { id: 3, name: 'Mark Santos', email: 'mark@email.com', role: 'Design Specialist', status: 'Active', added: 'May 21' },
];

const initials = (name: string) =>
    name.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const today = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */

export default function UserAccountManagement() {
    const [users, setUsers] = useState<User[]>(seedUsers);

    // Table controls
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All Roles');

    // Add / edit dialog
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<User | null>(null);
    const [form, setForm] = useState({ name: '', email: '', role: 'Customer' as RoleName });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const visibleUsers = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter(
            (u) =>
                (roleFilter === 'All Roles' || u.role === roleFilter) &&
                (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)),
        );
    }, [users, query, roleFilter]);

    /* ---- actions ---- */

    const openAdd = () => {
        setEditing(null);
        setForm({ name: '', email: '', role: 'Customer' });
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (u: User) => {
        setEditing(u);
        setForm({ name: u.name, email: u.email, role: u.role });
        setErrors({});
        setDialogOpen(true);
    };

    const saveUser = () => {
        const e: Record<string, string> = {};
        const email = form.email.trim().toLowerCase();

        if (!form.name.trim()) e.name = 'Full name is required.';
        if (!email) e.email = 'Email address is required.';
        else if (users.some((u) => u.email.toLowerCase() === email && u.id !== editing?.id))
            e.email = 'Email already registered';

        setErrors(e);
        if (Object.keys(e).length) return;

        const data = { name: form.name.trim(), email: form.email.trim(), role: form.role };
        setUsers((list) =>
            editing
                ? list.map((u) => (u.id === editing.id ? { ...u, ...data } : u))
                : [...list, { id: Date.now(), status: 'Active', added: today(), ...data }],
        );
        setDialogOpen(false);
    };

    const toggleArchive = () => {
        if (!editing) return;
        const next: Status = editing.status === 'Archived' ? 'Active' : 'Archived';
        setUsers((list) => list.map((u) => (u.id === editing.id ? { ...u, status: next } : u)));
        setDialogOpen(false);
    };

    /* ---- render ---- */

    return (
        <>
            <PageHeader
                title="User Accounts"
                description="Search, add and edit user accounts. Click a user to edit their account."
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
                            {ROLES.map((r) => (
                                <option key={r}>{r}</option>
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
                                    <Pill tone={roleTone[u.role]}>{u.role}</Pill>
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
                                : 'Create the account and assign a role.'}
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

                        <Field label="Role" htmlFor="u-role" required>
                            <select
                                id="u-role"
                                className={selectClass}
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value as RoleName })}
                            >
                                {ROLES.map((r) => (
                                    <option key={r}>{r}</option>
                                ))}
                            </select>
                        </Field>

                        <DialogFooter>
                            {editing && (
                                <DangerButton className="sm:mr-auto" onClick={toggleArchive}>
                                    {editing.status === 'Archived' ? 'Restore Account' : 'Archive Account'}
                                </DangerButton>
                            )}
                            <OutlineButton onClick={() => setDialogOpen(false)}>Cancel</OutlineButton>
                            <GoldButton type="submit">{editing ? 'Save Changes' : 'Create User'}</GoldButton>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
