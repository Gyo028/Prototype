import { Link, router, usePage } from '@inertiajs/react';
import { Check, UserCheck, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    Field,
    GoldButton,
    OutlineButton,
    PageHeader,
    Panel,
    Pill,
    cx,
    inputClass,
    selectClass,
    textareaClass,
} from '@/components/dashboard/ui';
import { Detail, Section, formatDate, formatDateTime } from '@/components/project-manager/request-details';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { READINESS_ITEMS, SAMPLE_ASSIGNMENT_PROJECTS, SAMPLE_SPECIALISTS, isReady } from '@/data/project-manager/design-assignments';
import type { AssignmentProject, DesignSpecialist } from '@/data/project-manager/design-assignments';

/*
 * Backlog #21: Assign a Design Specialist to a project.
 * The Project Manager picks a Design Specialist for a project so they can prepare the design proposal.
 * The assignment is blocked when no specialist is selected, or when the project's
 * information is incomplete (consultation, contract or site assessment missing).
 */

const ASSIGNMENTS_URL = '/project-manager/design-assignments';

type Filter = 'Ready' | 'Not Ready' | 'Assigned' | 'All';

const FILTERS: { value: Filter; label: string }[] = [
    { value: 'Ready', label: 'Ready to Assign' },
    { value: 'Not Ready', label: 'Not Ready' },
    { value: 'Assigned', label: 'Assigned' },
    { value: 'All', label: 'All' },
];

const stageOf = (p: AssignmentProject): Exclude<Filter, 'All'> =>
    p.assignment ? 'Assigned' : isReady(p) ? 'Ready' : 'Not Ready';

type FormErrors = Partial<Record<'specialist' | 'readiness', string>>;

type Props = {
    /** Sent by the controller. Leave both out to use the sample data. */
    projects?: AssignmentProject[];
    specialists?: DesignSpecialist[];
};

export default function DesignAssignmentList({ projects, specialists }: Props) {
    const { props } = usePage();
    const managerName = props.auth?.user?.name ?? 'Project Manager';

    const usingSample = projects === undefined;
    const [sampleProjects, setSampleProjects] = useState(SAMPLE_ASSIGNMENT_PROJECTS);
    const allProjects = projects ?? sampleProjects;
    const allSpecialists = specialists ?? SAMPLE_SPECIALISTS;

    // Toolbar
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState<Filter>('Ready');

    // Dialog
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const selected = allProjects.find((p) => p.id === selectedId) ?? null;
    const [assigning, setAssigning] = useState(false);
    const [specialistId, setSpecialistId] = useState('');
    const [notes, setNotes] = useState('');
    const [errors, setErrors] = useState<FormErrors>({});
    const [saving, setSaving] = useState(false);

    const count = (f: Filter) => (f === 'All' ? allProjects.length : allProjects.filter((p) => stageOf(p) === f).length);

    const q = query.trim().toLowerCase();
    const visibleProjects = allProjects
        .filter((p) => filter === 'All' || stageOf(p) === filter)
        .filter(
            (p) =>
                !q ||
                p.code.toLowerCase().includes(q) ||
                p.customerName.toLowerCase().includes(q) ||
                p.eventType.toLowerCase().includes(q) ||
                (p.assignment?.specialistName.toLowerCase().includes(q) ?? false),
        )
        // Nearest event first.
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate));

    const openProject = (p: AssignmentProject) => {
        setSelectedId(p.id);
        setAssigning(false);
        setErrors({});
    };

    const closeProject = () => setSelectedId(null);

    const startAssigning = () => {
        if (!selected) return;
        setSpecialistId(selected.assignment ? String(selected.assignment.specialistId) : '');
        setNotes(selected.assignment?.notes ?? '');
        setErrors({});
        setAssigning(true);
    };

    const saveAssignment = () => {
        if (!selected) return;

        // Acceptance criterion 2: no specialist, or incomplete project information, means no save.
        const e: FormErrors = {};
        if (!isReady(selected)) {
            e.readiness = 'The project information is incomplete. Complete the missing items above before assigning.';
        }
        if (!specialistId) e.specialist = 'Select a Design Specialist.';
        setErrors(e);
        if (Object.keys(e).length) return;

        const specialist = allSpecialists.find((s) => s.id === Number(specialistId));
        if (!specialist) return;

        const message = `${specialist.name} is now assigned to ${selected.code} and can start the design proposal.`;
        const finish = () => {
            toast.success(message);
            setAssigning(false);
        };

        // Acceptance criterion 1: the assignment is saved and shared with the Design Specialist.
        if (usingSample) {
            setSampleProjects((list) =>
                list.map((p) =>
                    p.id === selected.id
                        ? {
                              ...p,
                              assignment: {
                                  specialistId: specialist.id,
                                  specialistName: specialist.name,
                                  notes: notes.trim() || null,
                                  assignedBy: managerName,
                                  assignedAt: new Date().toISOString(),
                              },
                          }
                        : p,
                ),
            );
            finish();
            return;
        }

        router.patch(
            `${ASSIGNMENTS_URL}/${selected.id}`,
            { specialistId: specialist.id, notes: notes.trim() || null },
            {
                preserveScroll: true,
                onStart: () => setSaving(true),
                onFinish: () => setSaving(false),
                onSuccess: finish,
                onError: (err) => setErrors({ specialist: err.specialistId, readiness: err.project }),
            },
        );
    };
    
    return (
        <>
            <PageHeader
                title="Design Assignments"
                description="Assign a Design Specialist to each project so they can prepare the design proposal."
            />

            {/* Toolbar */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm" role="tablist" aria-label="Filter by assignment">
                    {FILTERS.map((f) => (
                        <button
                            key={f.value}
                            type="button"
                            role="tab"
                            aria-selected={filter === f.value}
                            onClick={() => setFilter(f.value)}
                            className={cx(
                                'rounded-lg px-4 py-1.5 text-sm font-semibold transition',
                                filter === f.value ? 'bg-gold text-white' : 'text-ink-soft hover:bg-gold/10',
                            )}
                        >
                            {f.label} <span className="ml-1 text-xs opacity-80">{count(f.value)}</span>
                        </button>
                    ))}
                </div>

                <div className="ml-auto w-full max-w-sm">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by project no., customer, event or designer..."
                        aria-label="Search design assignments"
                        className={inputClass}
                    />
                </div>
            </div>

            {/* Table */}
            <Panel className="overflow-x-auto p-0">
                <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-neutral-200/70 text-xs text-ink-soft uppercase">
                        <tr>
                            <th className="px-4 py-3 font-medium">Project No.</th>
                            <th className="px-2 py-3 font-medium">Customer</th>
                            <th className="px-2 py-3 font-medium">Event</th>
                            <th className="px-2 py-3 font-medium">Event Date</th>
                            <th className="px-2 py-3 font-medium">Project Info</th>
                            <th className="px-2 py-3 pr-4 font-medium">Design Specialist</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/10">
                        {visibleProjects.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-10 text-center text-ink-soft">
                                    {q ? 'No projects match your search.' : 'No projects here.'}
                                </td>
                            </tr>
                        ) : (
                            visibleProjects.map((p) => {
                                const done = READINESS_ITEMS.filter((item) => p.readiness[item.key]).length;
                                return (
                                    <tr
                                        key={p.id}
                                        tabIndex={0}
                                        aria-label={`Open ${p.code} for ${p.customerName}`}
                                        onClick={() => openProject(p)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') openProject(p);
                                        }}
                                        className="cursor-pointer transition hover:bg-gold/10 focus-visible:bg-gold/10 focus-visible:outline-none"
                                    >
                                        <td className="px-4 py-3 font-semibold text-ink">{p.code}</td>
                                        <td className="px-2 py-3 text-ink">{p.customerName}</td>
                                        <td className="px-2 py-3 text-ink">{p.eventType}</td>
                                        <td className="px-2 py-3 text-ink">{formatDate(p.eventDate)}</td>
                                        <td className="px-2 py-3">
                                            {isReady(p) ? (
                                                <Pill tone="green">Complete</Pill>
                                            ) : (
                                                <Pill tone="yellow">
                                                    {done} of {READINESS_ITEMS.length} complete
                                                </Pill>
                                            )}
                                        </td>
                                        <td className="px-2 py-3 pr-4 text-ink">
                                            {p.assignment ? p.assignment.specialistName : <span className="text-ink-soft">Not assigned</span>}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </Panel>

            {/* ---------------- Project + assignment ---------------- */}
            <Dialog open={selected !== null} onOpenChange={(open) => !open && closeProject()}>
                <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
                    {selected && (
                        <>
                            <DialogHeader>
                                <div className="flex flex-wrap items-center gap-3 pr-6">
                                    <DialogTitle>
                                        {selected.code} · {selected.eventType}
                                    </DialogTitle>
                                    {selected.assignment ? (
                                        <Pill tone="blue">Assigned</Pill>
                                    ) : isReady(selected) ? (
                                        <Pill tone="green">Ready</Pill>
                                    ) : (
                                        <Pill tone="yellow">Not ready</Pill>
                                    )}
                                </div>
                                <DialogDescription>
                                    {selected.customerName} · {formatDate(selected.eventDate)}
                                </DialogDescription>
                            </DialogHeader>

                            <Section title="Project Information">
                                <div className="grid grid-cols-2 gap-3">
                                    <Detail label="Customer">{selected.customerName}</Detail>
                                    <Detail label="Event">{selected.eventType}</Detail>
                                    <Detail label="Event date">{formatDate(selected.eventDate)}</Detail>
                                    <Detail label="Guests">{selected.guests ?? 'Not applicable'}</Detail>
                                    <Detail label="Theme">{selected.theme ?? 'No theme selected'}</Detail>
                                    <div className="col-span-2">
                                        <Detail label="Venue">{selected.venue}</Detail>
                                    </div>
                                </div>
                            </Section>

                            {/* What the project needs before it can be assigned */}
                            <Section title="Required Project Information">
                                <ul className="grid gap-2">
                                    {READINESS_ITEMS.map((item) => {
                                        const ok = selected.readiness[item.key];
                                        return (
                                            <li
                                                key={item.key}
                                                className={cx(
                                                    'flex items-start gap-3 rounded-lg border p-3 text-sm',
                                                    ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50',
                                                )}
                                            >
                                                {ok ? (
                                                    <Check className="mt-0.5 size-4 shrink-0 text-green-600" />
                                                ) : (
                                                    <X className="mt-0.5 size-4 shrink-0 text-red-600" />
                                                )}
                                                <span className="flex-1 text-ink">{item.label}</span>
                                                {!ok && (
                                                    <Link href={item.page} className="text-xs font-semibold whitespace-nowrap text-gold-dark underline">
                                                        Go to {item.pageName}
                                                    </Link>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Section>

                            {/* Current assignment (read-only) */}
                            {selected.assignment && !assigning && (
                                <Section title="Assigned Design Specialist">
                                    <div className="grid grid-cols-2 gap-3">
                                        <Detail label="Design Specialist">{selected.assignment.specialistName}</Detail>
                                        <Detail label="Assigned">
                                            {formatDateTime(selected.assignment.assignedAt)} by {selected.assignment.assignedBy}
                                        </Detail>
                                        <div className="col-span-2">
                                            <Detail label="Notes for the designer">{selected.assignment.notes ?? 'No notes.'}</Detail>
                                        </div>
                                    </div>
                                </Section>
                            )}

                            {/* Assignment form */}
                            {assigning ? (
                                <form
                                    noValidate
                                    className="space-y-4 rounded-xl border border-gold/40 bg-gold/5 p-4"
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        saveAssignment();
                                    }}
                                >
                                    <Field label="Design Specialist" htmlFor="da-specialist" required error={errors.specialist}>
                                        <select
                                            id="da-specialist"
                                            value={specialistId}
                                            onChange={(e) => {
                                                setSpecialistId(e.target.value);
                                                setErrors((x) => ({ ...x, specialist: undefined }));
                                            }}
                                            className={cx(selectClass, errors.specialist && 'border-red-500')}
                                        >
                                            <option value="">Select a Design Specialist</option>
                                            {allSpecialists.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name} ({s.activeProjects} active {s.activeProjects === 1 ? 'project' : 'projects'})
                                                </option>
                                            ))}
                                        </select>
                                    </Field>

                                    <Field label="Notes for the designer (optional)" htmlFor="da-notes">
                                        <textarea
                                            id="da-notes"
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="e.g. Client prefers pastel tones; keep the arch from the inspiration photo."
                                            className={textareaClass}
                                        />
                                    </Field>

                                    {errors.readiness && (
                                        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm font-bold text-red-700">
                                            {errors.readiness}
                                        </div>
                                    )}

                                    <p className="text-xs text-ink-soft">
                                        The Design Specialist will see this project and its information once it is assigned.
                                    </p>

                                    <DialogFooter>
                                        <OutlineButton onClick={() => setAssigning(false)} disabled={saving}>
                                            Cancel
                                        </OutlineButton>
                                        <GoldButton type="submit" disabled={saving}>
                                            {saving ? 'Assigning...' : 'Save Assignment'}
                                        </GoldButton>
                                    </DialogFooter>
                                </form>
                            ) : (
                                <DialogFooter>
                                    <OutlineButton onClick={closeProject}>Close</OutlineButton>
                                    <GoldButton onClick={startAssigning}>
                                        <UserCheck className="size-4" />
                                        {selected.assignment ? 'Reassign' : 'Assign Design Specialist'}
                                    </GoldButton>
                                </DialogFooter>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}