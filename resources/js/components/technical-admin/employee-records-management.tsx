import { Archive, ArchiveRestore, Check, ChevronLeft, ChevronRight, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
    Field,
    GoldButton,
    OutlineButton,
    Panel,
    Pill,
    Switch,
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

/*
 * Employee records (backlog item 9). Maps to `employees` in the ERD:
 * first_name, last_name, contact_number, email, position_id and employee_status.
 *
 * An employee does NOT need a user account. `user_id` is optional:
 *  - Staff who log in (Project Manager, Design Specialist, Bookkeeper) can be linked
 *    to their account.
 *  - Field personnel (the Fabrication Head and the Installation Head) have no login.
 *    They receive work orders and reminders by email, so the email address is
 *    required for everyone.
 *
 * Employees are archived (Inactive) rather than deleted, because production
 * assignments refer to them.
 */

const PAGE_SIZE = 8;

// From `employee_positions`.
const POSITIONS = ['Fabrication Head', 'Installation Head', 'Project Manager', 'Design Specialist', 'Bookkeeper'];

const positionTone: Record<string, PillTone> = {
    'Fabrication Head': 'gray',
    'Installation Head': 'gray',
    'Project Manager': 'blue',
    'Design Specialist': 'purple',
    Bookkeeper: 'green',
};

type Employee = {
    id: number;
    firstName: string;
    lastName: string;
    position: string;
    contact: string;
    email: string;
    /** Linked user account (users.user_id), or null when the employee has no login */
    userId: number | null;
    active: boolean;
};

// Placeholder staff accounts (users with a staff role). Customers are never employees.
const staffAccounts = [
    { id: 101, name: 'Ana Reyes', email: 'ana@email.com', role: 'Project Manager' },
    { id: 102, name: 'Mark Santos', email: 'mark@email.com', role: 'Design Specialist' },
    { id: 103, name: 'Liza Ramos', email: 'liza@email.com', role: 'Bookkeeper' },
    { id: 104, name: 'Paolo Villar', email: 'paolo@email.com', role: 'Design Specialist' },
];

// Placeholder data until the database is connected.
const seed: Employee[] = [
    { id: 1, firstName: 'Ana', lastName: 'Reyes', position: 'Project Manager', contact: '0917 000 0001', email: 'ana@email.com', userId: 101, active: true },
    { id: 2, firstName: 'Mark', lastName: 'Santos', position: 'Design Specialist', contact: '0917 000 0002', email: 'mark@email.com', userId: 102, active: true },
    { id: 3, firstName: 'Liza', lastName: 'Ramos', position: 'Bookkeeper', contact: '0917 000 0003', email: 'liza@email.com', userId: 103, active: true },
    { id: 4, firstName: 'Ronaldo', lastName: 'Dizon', position: 'Fabrication Head', contact: '0917 000 0004', email: 'ronaldo@email.com', userId: null, active: true },
    { id: 5, firstName: 'Jun', lastName: 'Aquino', position: 'Installation Head', contact: '0917 000 0005', email: 'jun@email.com', userId: null, active: true },
    { id: 6, firstName: 'Carlo', lastName: 'Mendoza', position: 'Fabrication Head', contact: '0917 000 0006', email: 'carlo@email.com', userId: null, active: true },
    { id: 7, firstName: 'Ben', lastName: 'Lopez', position: 'Installation Head', contact: '0917 000 0007', email: 'ben@email.com', userId: null, active: true },
    { id: 8, firstName: 'Grace', lastName: 'Tan', position: 'Installation Head', contact: '0917 000 0008', email: 'grace@email.com', userId: null, active: false },
    { id: 9, firstName: 'Paolo', lastName: 'Cruz', position: 'Fabrication Head', contact: '0917 000 0009', email: 'paolocruz@email.com', userId: null, active: true },
];

type Form = {
    firstName: string;
    lastName: string;
    position: string;
    contact: string;
    email: string;
    userId: string; // '' = no login
    active: boolean;
};

const emptyForm: Form = {
    firstName: '',
    lastName: '',
    position: POSITIONS[0],
    contact: '',
    email: '',
    userId: '',
    active: true,
};

const initials = (e: Employee) => (e.firstName[0] + e.lastName[0]).toUpperCase();
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

/* Icon-only button with an accessible name and a tooltip */
function IconButton({
    label,
    onClick,
    tone = 'plain',
    children,
}: {
    label: string;
    onClick: () => void;
    tone?: 'plain' | 'gold';
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            className={cx(
                'inline-flex size-9 items-center justify-center rounded-lg border transition',
                tone === 'plain' && 'border-black/15 bg-white text-ink hover:bg-black/5',
                tone === 'gold' && 'border-gold bg-gold text-white hover:bg-gold-dark',
            )}
        >
            {children}
        </button>
    );
}

export default function EmployeeRecordsManagement() {
    const [employees, setEmployees] = useState<Employee[]>(seed);
    const [page, setPage] = useState(1);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<Form>(emptyForm);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const pages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
    const current = Math.min(page, pages);
    const start = (current - 1) * PAGE_SIZE;
    const visible = employees.slice(start, start + PAGE_SIZE);
    const activeCount = employees.filter((e) => e.active).length;

    const accountFor = (userId: number | null) => staffAccounts.find((a) => a.id === userId);

    // Accounts that are free to link (not already linked to another employee)
    const availableAccounts = staffAccounts.filter(
        (a) => !employees.some((e) => e.userId === a.id && e.id !== editingId),
    );

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setErrors({});
        setDialogOpen(true);
    };

    const openEdit = (e: Employee) => {
        setEditingId(e.id);
        setForm({
            firstName: e.firstName,
            lastName: e.lastName,
            position: e.position,
            contact: e.contact,
            email: e.email,
            userId: e.userId ? String(e.userId) : '',
            active: e.active,
        });
        setErrors({});
        setDialogOpen(true);
    };

    // Choosing an account fills in the blanks from it, so nothing is typed twice
    const chooseAccount = (value: string) => {
        const account = staffAccounts.find((a) => String(a.id) === value);
        setForm((f) => {
            if (!account) return { ...f, userId: '' };
            const [first, ...rest] = account.name.split(' ');
            return {
                ...f,
                userId: value,
                firstName: f.firstName || first,
                lastName: f.lastName || rest.join(' '),
                email: f.email || account.email,
                position: POSITIONS.includes(account.role) ? account.role : f.position,
            };
        });
    };

    const save = () => {
        const e: Record<string, string> = {};
        const email = form.email.trim().toLowerCase();

        if (!form.firstName.trim()) e.firstName = 'First name is required.';
        if (!form.lastName.trim()) e.lastName = 'Last name is required.';
        if (!form.contact.trim()) e.contact = 'Contact number is required.';
        else if (form.contact.replace(/\D/g, '').length < 7) e.contact = 'Enter a valid contact number.';
        if (!email) e.email = 'Email is required. Assignments are sent by email.';
        else if (!emailOk(email)) e.email = 'Enter a valid email address.';
        else if (employees.some((x) => x.email.toLowerCase() === email && x.id !== editingId))
            e.email = 'Email already registered';

        setErrors(e);
        if (Object.keys(e).length) return;

        const data = {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            position: form.position,
            contact: form.contact.trim(),
            email: form.email.trim(),
            userId: form.userId ? Number(form.userId) : null,
            active: form.active,
        };

        if (editingId === null) {
            setEmployees([...employees, { id: Date.now(), ...data }]);
            setPage(Math.ceil((employees.length + 1) / PAGE_SIZE)); // jump to the new record
        } else {
            setEmployees(employees.map((x) => (x.id === editingId ? { ...x, ...data } : x)));
        }
        setDialogOpen(false);
    };

    const setActive = (id: number, active: boolean) =>
        setEmployees(employees.map((x) => (x.id === id ? { ...x, active } : x)));

    return (
        <div className="space-y-4">
            {/* Count and the Add button (upper right) */}
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                    {employees.length} {employees.length === 1 ? 'employee' : 'employees'} · {activeCount} active
                </p>
                <GoldButton onClick={openAdd}>
                    <Plus className="size-4" />
                    Add Employee Record
                </GoldButton>
            </div>

            <Panel className="overflow-x-auto p-0">
                <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-3" />
                            <th className="px-2 py-3 font-medium">Name</th>
                            <th className="px-2 py-3 font-medium">Position</th>
                            <th className="px-2 py-3 font-medium">Contact</th>
                            <th className="px-2 py-3 font-medium">Email</th>
                            <th className="px-2 py-3 font-medium">Linked account</th>
                            <th className="px-2 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {visible.map((e) => {
                            const account = accountFor(e.userId);
                            return (
                                <tr key={e.id} className={e.active ? '' : 'opacity-50'}>
                                    <td className="py-3 pl-4">
                                        <span className="flex size-8 items-center justify-center rounded-full bg-gold/70 text-[11px] font-bold text-ink">
                                            {initials(e)}
                                        </span>
                                    </td>
                                    <td className="px-2 py-3 text-ink">
                                        {e.firstName} {e.lastName}
                                    </td>
                                    <td className="px-2 py-3">
                                        <Pill tone={positionTone[e.position] ?? 'gray'}>{e.position}</Pill>
                                    </td>
                                    <td className="px-2 py-3 text-ink">{e.contact}</td>
                                    <td className="px-2 py-3 text-ink">{e.email}</td>
                                    <td className="px-2 py-3">
                                        {account ? (
                                            <span className="text-ink">{account.email}</span>
                                        ) : (
                                            <span title="Receives assignments and reminders by email only">
                                                <Pill tone="gray">No login</Pill>
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-2 py-3">
                                        <Pill tone={e.active ? 'green' : 'gray'}>{e.active ? 'Active' : 'Inactive'}</Pill>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <IconButton label={`Edit ${e.firstName}`} tone="gold" onClick={() => openEdit(e)}>
                                                <Pencil className="size-4" />
                                            </IconButton>
                                            {e.active ? (
                                                <IconButton label={`Archive ${e.firstName}`} onClick={() => setActive(e.id, false)}>
                                                    <Archive className="size-4" />
                                                </IconButton>
                                            ) : (
                                                <IconButton label={`Restore ${e.firstName}`} onClick={() => setActive(e.id, true)}>
                                                    <ArchiveRestore className="size-4" />
                                                </IconButton>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {employees.length === 0 && (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-ink-soft">
                                    No employee records yet. Use Add Employee Record to add the first one.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Panel>

            {/* Pagination */}
            {employees.length > 0 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-ink-soft">
                        Showing {start + 1}–{Math.min(start + PAGE_SIZE, employees.length)} of {employees.length}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            aria-label="Previous page"
                            disabled={current === 1}
                            onClick={() => setPage(current - 1)}
                            className="rounded border border-black/15 bg-white p-1.5 disabled:opacity-40"
                        >
                            <ChevronLeft className="size-4" />
                        </button>
                        {Array.from({ length: pages }).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Page ${i + 1}`}
                                onClick={() => setPage(i + 1)}
                                className={cx(
                                    'size-8 rounded border text-xs font-bold',
                                    current === i + 1 ? 'border-gold bg-gold text-white' : 'border-black/15 bg-white',
                                )}
                            >
                                {i + 1}
                            </button>
                        ))}
                        <button
                            type="button"
                            aria-label="Next page"
                            disabled={current === pages}
                            onClick={() => setPage(current + 1)}
                            className="rounded border border-black/15 bg-white p-1.5 disabled:opacity-40"
                        >
                            <ChevronRight className="size-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Add / edit modal */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId === null ? 'Add Employee' : 'Edit Employee'}</DialogTitle>
                        <DialogDescription>
                            Employees do not need a system account. The Fabrication Head and the Installation Head receive
                            work orders and reminders by email.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="First name" htmlFor="emp-first" required error={errors.firstName}>
                            <input
                                id="emp-first"
                                className={inputClass}
                                value={form.firstName}
                                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                            />
                        </Field>
                        <Field label="Last name" htmlFor="emp-last" required error={errors.lastName}>
                            <input
                                id="emp-last"
                                className={inputClass}
                                value={form.lastName}
                                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                            />
                        </Field>

                        <Field label="Position" htmlFor="emp-position" required>
                            <select
                                id="emp-position"
                                className={selectClass}
                                value={form.position}
                                onChange={(e) => setForm({ ...form, position: e.target.value })}
                            >
                                {POSITIONS.map((p) => (
                                    <option key={p}>{p}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Contact number" htmlFor="emp-contact" required error={errors.contact}>
                            <input
                                id="emp-contact"
                                type="tel"
                                className={inputClass}
                                value={form.contact}
                                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                            />
                        </Field>

                        <Field label="Email address" htmlFor="emp-email" required error={errors.email} className="sm:col-span-2">
                            <input
                                id="emp-email"
                                type="email"
                                className={inputClass}
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                            />
                        </Field>

                        <Field label="Linked account (optional)" htmlFor="emp-account" className="sm:col-span-2">
                            <select
                                id="emp-account"
                                className={selectClass}
                                value={form.userId}
                                onChange={(e) => chooseAccount(e.target.value)}
                            >
                                <option value="">No login (email only)</option>
                                {availableAccounts.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} · {a.email} · {a.role}
                                    </option>
                                ))}
                            </select>
                            <span className="text-[11px] text-ink-soft">
                                Only staff accounts that are not linked to another employee are listed.
                            </span>
                        </Field>

                        {editingId !== null && (
                            <div className="flex items-center gap-3 sm:col-span-2">
                                <span className="text-sm text-ink">Status</span>
                                <Switch checked={form.active} label="Employee status" onChange={(v) => setForm({ ...form, active: v })} />
                                <span className={cx('text-xs font-semibold', form.active ? 'text-green-700' : 'text-ink-soft')}>
                                    {form.active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <OutlineButton onClick={() => setDialogOpen(false)}>Cancel</OutlineButton>
                        <GoldButton onClick={save}>
                            <Check className="size-4" /> Save
                        </GoldButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
