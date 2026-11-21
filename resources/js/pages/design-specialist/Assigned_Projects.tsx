
import { Head } from '@inertiajs/react';
import { useState } from 'react';
import DesignSpecialistLayout from '@/layouts/design-specialist-layout';
import type { ReactNode } from 'react';

type QuotationItem = {
    description: string;
    amount: number | null;
};

type Project = {
    id: number;
    code?: string;
    name: string;
    customer?: string;
    assignedDate?: string;
    status?: string | null;
    eventType?: string;
    theme?: string;
    budget?: string;
    venue?: string;
    eventDate?: string;
    servicePackage?: string;
    consultation?: string;
    layoutImage?: string | null;
    references?: string[];
    referenceCount?: number;
    quotations?: QuotationItem[];
    ocularDate?: string;
    ocularReport?: string | null;
    venuePhotos?: string[];
};

type Props = {
    projects?: Project[];
    project?: Project | null;
};

const SAMPLE_PROJECTS: Project[] = [
    {
        id: 1,
        code: 'EVP-2026-041',
        name: 'Hotel Setup – December Getaway',
        customer: 'December Getaway Hotel',
        assignedDate: 'Oct 20, 2026',
        status: '1 Revision from customer',
        eventType: 'Hotel Setup',
        theme: 'Christmas getaway, gold & white',
        budget: '₱250,000',
        venue: 'Hotel Function Hall and Lobby',
        eventDate: 'Dec 10, 2026',
        servicePackage: 'Holiday Hotel Setup Package',
        consultation: 'The hotel will proceed with a December getaway setup. The design includes a Christmas entrance display, reception decorations, festive lounge seating, dining area styling, and a holiday photo wall.',
        layoutImage: null,
        references: [],
        referenceCount: 6,
        quotations: [
            { description: 'Christmas entrance arch', amount: 25000 },
            { description: 'Reception counter decorations', amount: 18000 },
            { description: 'Christmas tree display', amount: 22000 },
            { description: 'Holiday photo wall', amount: 18000 },
            { description: 'Lobby decorations', amount: 25000 },
            { description: 'Dining area styling', amount: 30000 },
            { description: 'Festive lounge seating', amount: 20000 },
            { description: 'Ceiling decorations and lights', amount: 35000 },
            { description: 'Holiday centerpieces', amount: 12000 },
            { description: 'Additional decorative materials', amount: 15000 },
        ],
        ocularDate: 'Oct 22, 2026',
        ocularReport: null,
        venuePhotos: [],
    },
    {
        id: 2,
        code: 'EVP-2026-042',
        name: 'Mall Design Setup',
        customer: 'City Mall',
        assignedDate: 'Oct 25, 2026',
        status: 'Assigned by Project Manager',
        eventType: 'Mall Design Setup',
        theme: 'Modern festive mall decorations',
        budget: '₱350,000',
        venue: 'Main Atrium and Shopping Areas',
        eventDate: 'Dec 15, 2026',
        servicePackage: 'Mall Decoration Package',
        consultation: 'The project involves designing and preparing the mall decorations, including the main atrium display, entrance decorations, shopping area styling, and festive displays.',
        layoutImage: null,
        references: [],
        referenceCount: 0,
        quotations: [],
        ocularDate: 'Oct 27, 2026',
        ocularReport: null,
        venuePhotos: [],
    },
];

const WORKFLOW = [
    { label: 'Assigned', detail: 'Assigned to specialist', status: 'completed' },
    { label: '2D proposal + quotation', detail: 'In progress', status: 'active' },
    { label: 'Project Manager review', detail: 'Pending', status: 'pending' },
    { label: 'Customer review', detail: 'Pending', status: 'pending' },
    { label: 'Approved', detail: 'Pending', status: 'pending' },
];

const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const getStatusStyle = (status?: string | null) => {
    const value = status?.toLowerCase() ?? '';

    if (value.includes('revision')) {
        return 'bg-orange-100 text-orange-700';
    }

    if (value.includes('approved') || value.includes('completed')) {
        return 'bg-green-100 text-green-700';
    }

    if (value.includes('submitted')) {
        return 'bg-purple-100 text-purple-700';
    }

    if (value.includes('assigned')) {
        return 'bg-blue-100 text-blue-700';
    }

    return 'bg-neutral-100 text-neutral-600';
};

export default function AssignedProjects({
    projects = [],
    project = null,
}: Props) {
    const [selectedProject, setSelectedProject] = useState<Project | null>(project);

    const [projectList, setProjectList] = useState<Project[]>(
        projects.length > 0 ? projects : SAMPLE_PROJECTS
    );

    const [showAddForm, setShowAddForm] = useState(false);

    const [newProject, setNewProject] = useState({
        name: '',
        customer: '',
        eventType: '',
        venue: '',
        eventDate: '',
        budget: '',
        theme: '',
        servicePackage: '',
    });

    const currentProject = selectedProject ?? SAMPLE_PROJECTS[0];
    const quotations = currentProject.quotations ?? [];
    const references = currentProject.references ?? [];
    const venuePhotos = currentProject.venuePhotos ?? [];

    const estimatedTotal = quotations.reduce(
        (total, item) => total + (item.amount ?? 0),
        0,
    );

    const handleAddProject = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const newId = Math.max(0, ...projectList.map((item) => item.id)) + 1;

        const addedProject: Project = {
            id: newId,
            code: `EVP-2026-${String(40 + newId).padStart(3, '0')}`,
            name: newProject.name,
            customer: newProject.customer,
            eventType: newProject.eventType,
            venue: newProject.venue,
            eventDate: newProject.eventDate,
            budget: newProject.budget,
            theme: newProject.theme,
            servicePackage: newProject.servicePackage,
            assignedDate: new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            }),
            status: 'Assigned by Project Manager',
            consultation: 'Project details will be provided by the Project Manager.',
            quotations: [],
            references: [],
            referenceCount: 0,
            venuePhotos: [],
        };

        setProjectList((previous) => [...previous, addedProject]);

        setNewProject({
            name: '',
            customer: '',
            eventType: '',
            venue: '',
            eventDate: '',
            budget: '',
            theme: '',
            servicePackage: '',
        });

        setShowAddForm(false);
    };

    const handleSubmitVersion = () => {
        const updatedProject: Project = {
            ...currentProject,
            status: 'Submitted for Review',
        };

        setProjectList((previous) =>
            previous.map((item) =>
                item.id === updatedProject.id ? updatedProject : item
            )
        );

        setSelectedProject(updatedProject);
    };

    return (
        <>
            <Head title="Assigned Projects" />

            <main className="flex flex-col gap-4 p-6">

                {!selectedProject ? (
                    <section className="rounded-xl border border-neutral-200 bg-white p-4">

                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h1 className="text-base font-bold text-ink">
                                    Assigned Projects
                                </h1>
                                <p className="mt-1 text-xs text-neutral-500">
                                    View and manage your assigned projects.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600">
                                    {projectList.length} {projectList.length === 1 ? 'Project' : 'Projects'}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => setShowAddForm(!showAddForm)}
                                    className="rounded-lg bg-purple-900 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-800"
                                >
                                    {showAddForm ? 'Close Form' : '+ Add Project'}
                                </button>
                            </div>
                        </div>

                        {showAddForm && (
                            <form
                                onSubmit={handleAddProject}
                                className="mb-5 rounded-xl border border-neutral-200 bg-neutral-50 p-4"
                            >
                                <h2 className="mb-4 text-sm font-bold text-ink">
                                    Add New Project
                                </h2>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <input
                                        required
                                        placeholder="Project name"
                                        value={newProject.name}
                                        onChange={(e) => setNewProject({
                                            ...newProject,
                                            name: e.target.value,
                                        })}
                                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs"
                                    />

                                    <input
                                        required
                                        placeholder="Customer name"
                                        value={newProject.customer}
                                        onChange={(e) => setNewProject({
                                            ...newProject,
                                            customer: e.target.value,
                                        })}
                                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs"
                                    />

                                    <input
                                        required
                                        placeholder="Event type"
                                        value={newProject.eventType}
                                        onChange={(e) => setNewProject({
                                            ...newProject,
                                            eventType: e.target.value,
                                        })}
                                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs"
                                    />

                                    <input
                                        placeholder="Venue"
                                        value={newProject.venue}
                                        onChange={(e) => setNewProject({
                                            ...newProject,
                                            venue: e.target.value,
                                        })}
                                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs"
                                    />

                                    <input
                                        type="date"
                                        value={newProject.eventDate}
                                        onChange={(e) => setNewProject({
                                            ...newProject,
                                            eventDate: e.target.value,
                                        })}
                                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs"
                                    />

                                    <input
                                        placeholder="Budget"
                                        value={newProject.budget}
                                        onChange={(e) => setNewProject({
                                            ...newProject,
                                            budget: e.target.value,
                                        })}
                                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs"
                                    />

                                    <input
                                        placeholder="Project theme"
                                        value={newProject.theme}
                                        onChange={(e) => setNewProject({
                                            ...newProject,
                                            theme: e.target.value,
                                        })}
                                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs"
                                    />

                                    <input
                                        placeholder="Service package"
                                        value={newProject.servicePackage}
                                        onChange={(e) => setNewProject({
                                            ...newProject,
                                            servicePackage: e.target.value,
                                        })}
                                        className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-xs"
                                    />
                                </div>

                                <div className="mt-4 flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddForm(false)}
                                        className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        className="rounded-lg bg-purple-900 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-800"
                                    >
                                        + Save Project
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-neutral-100 bg-neutral-50">
                                        <th className="px-4 py-3 text-xs font-semibold text-neutral-500">
                                            Project Title
                                        </th>
                                        <th className="px-4 py-3 text-xs font-semibold text-neutral-500">
                                            Status
                                        </th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {projectList.map((item) => (
                                        <tr
                                            key={item.id}
                                            className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                                        >
                                            <td className="px-4 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedProject(item)}
                                                    className="text-left text-sm font-semibold text-ink hover:text-purple-800 hover:underline"
                                                >
                                                    {item.name}
                                                </button>

                                                <p className="mt-1 text-[10px] text-neutral-500">
                                                    {item.code ?? 'Project details'}
                                                </p>
                                            </td>

                                            <td className="px-4 py-4">
                                                <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold ${getStatusStyle(item.status)}`}>
                                                    {item.status ?? 'New Assignment'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}

                                    {projectList.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={2}
                                                className="px-4 py-8 text-center text-xs text-neutral-400"
                                            >
                                                No assigned projects yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => setSelectedProject(null)}
                            className="w-fit text-xs font-medium text-purple-800 hover:underline"
                        >
                            ← Back to Assigned Projects
                        </button>

                        <header>
                            <p className="text-xs text-neutral-500">
                                Assigned Projects / {currentProject.code}
                            </p>

                            <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h1 className="text-xl font-bold text-ink">
                                            {currentProject.name}
                                        </h1>

                                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${getStatusStyle(currentProject.status)}`}>
                                            {currentProject.status ?? 'New Assignment'}
                                        </span>
                                    </div>

                                    <p className="mt-1 text-[11px] text-neutral-500">
                                        Assigned by the Project Manager on {currentProject.assignedDate} · Customer: {currentProject.customer}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleSubmitVersion}
                                    disabled={currentProject.status === 'Submitted for Review'}
                                    className="rounded-lg bg-purple-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
                                >
                                    ↑ {currentProject.status === 'Submitted for Review'
                                        ? 'Version 1 Submitted'
                                        : 'Submit Version 1'}
                                </button>
                            </div>
                        </header>

                        <section className="rounded-xl border border-neutral-200 bg-white p-4">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                {WORKFLOW.map((step) => (
                                    <div key={step.label}>
                                        <div className={`mb-2 h-1 rounded-full ${
                                            step.status === 'completed'
                                                ? 'bg-purple-900'
                                                : step.status === 'active'
                                                  ? 'bg-orange-500'
                                                  : 'bg-neutral-200'
                                        }`} />

                                        <p className="text-[11px] font-semibold text-ink">
                                            {step.label}
                                        </p>

                                        <p className="mt-1 text-[10px] text-neutral-500">
                                            {step.detail}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                                <p className="text-[11px] font-semibold text-blue-800">
                                    Project completion date · {currentProject.eventDate ?? 'Not specified'}
                                </p>

                                <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
                                    Complete the project design proposal, quotation, and required revisions before the project completion date.
                                </p>
                            </div>
                        </section>

                        <div className="border-b border-neutral-200">
                            <div className="inline-block border-b-2 border-purple-800 px-2 pb-2 text-[11px] font-semibold text-purple-900">
                                Specifications
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                            <div className="flex flex-col gap-4 xl:col-span-9">

                                <section className="rounded-xl border border-neutral-200 bg-white p-4">
                                    <h2 className="text-sm font-bold text-ink">
                                        Project details
                                    </h2>

                                    <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                                        <div>
                                            <p className="text-[10px] text-neutral-400">Event type</p>
                                            <p className="text-xs font-medium text-ink">
                                                {currentProject.eventType ?? 'Not specified'}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[10px] text-neutral-400">Theme</p>
                                            <p className="text-xs font-medium text-ink">
                                                {currentProject.theme ?? 'Not specified'}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[10px] text-neutral-400">Budget</p>
                                            <p className="text-xs font-medium text-ink">
                                                {currentProject.budget ?? 'Not specified'}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[10px] text-neutral-400">Venue</p>
                                            <p className="text-xs font-medium text-ink">
                                                {currentProject.venue ?? 'Not specified'}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[10px] text-neutral-400">Project completion date</p>
                                            <p className="text-xs font-medium text-ink">
                                                {currentProject.eventDate ?? 'Not specified'}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[10px] text-neutral-400">Service package</p>
                                            <p className="text-xs font-medium text-ink">
                                                {currentProject.servicePackage ?? 'Not specified'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <p className="mb-2 text-[10px] font-medium text-neutral-500">
                                            Consultation outcome (recorded by Project Manager)
                                        </p>

                                        <div className="rounded-lg bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
                                            {currentProject.consultation ?? 'No consultation details available.'}
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-xl border border-neutral-200 bg-white p-4">
                                    <h2 className="text-sm font-bold text-ink">
                                        Customer's preliminary 2D layout
                                    </h2>

                                    <p className="mt-1 text-[10px] text-neutral-400">
                                        Made by the customer in the 2D Design Layout tool when submitting the service request.
                                    </p>

                                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-lg bg-[#f0edf3]">
                                            {currentProject.layoutImage ? (
                                                <img
                                                    src={currentProject.layoutImage}
                                                    alt="Customer layout"
                                                    className="max-h-[350px] w-full object-contain"
                                                />
                                            ) : (
                                                <p className="text-[10px] text-neutral-400">
                                                    Layout snapshot image
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <h3 className="mb-3 text-xs font-semibold text-ink">
                                                Initial quotation
                                            </h3>

                                            {quotations.length > 0 ? (
                                                quotations.map((item, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex justify-between gap-2 border-b border-neutral-100 py-2 text-[10px]"
                                                    >
                                                        <span className="text-neutral-600">
                                                            {item.description}
                                                        </span>

                                                        <span className="whitespace-nowrap font-semibold text-ink">
                                                            {item.amount !== null
                                                                ? formatCurrency(item.amount)
                                                                : 'To be priced'}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="py-4 text-[10px] text-neutral-400">
                                                    No quotation items available yet.
                                                </p>
                                            )}

                                            <div className="mt-3 flex justify-between border-t border-neutral-200 pt-3 text-xs font-bold text-ink">
                                                <span>Estimated total</span>
                                                <span>{formatCurrency(estimatedTotal)}</span>
                                            </div>

                                            <div className="mt-3 rounded-lg bg-neutral-50 p-2">
                                                <p className="text-[10px] leading-relaxed text-neutral-500">
                                                    Initial material cost estimate only. The final project quotation is prepared with the design proposal and finalized by the Project Manager.
                                                </p>
                                            </div>

                                            <p className="mt-3 text-[10px] font-medium text-purple-900 underline">
                                                Download initial quotation (PDF)
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <aside className="flex flex-col gap-4 xl:col-span-3">

                                <section className="rounded-xl border border-neutral-200 bg-white p-4">
                                    <h2 className="text-sm font-bold text-ink">
                                        Reference designs
                                    </h2>

                                    <p className="mt-1 text-[10px] text-neutral-400">
                                        Uploaded by the customer · {currentProject.referenceCount ?? references.length} files
                                    </p>

                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {references.length > 0 ? (
                                            references.slice(0, 3).map((image, index) => (
                                                <a
                                                    key={index}
                                                    href={image}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="aspect-square overflow-hidden rounded-md bg-neutral-100"
                                                >
                                                    <img
                                                        src={image}
                                                        alt={`Reference ${index + 1}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </a>
                                            ))
                                        ) : (
                                            <>
                                                <div className="aspect-square rounded-md bg-[#f0edf3]" />
                                                <div className="aspect-square rounded-md bg-[#f0edf3]" />
                                                <div className="flex aspect-square items-center justify-center rounded-md bg-[#f0edf3] text-[10px] text-neutral-500">
                                                    + {Math.max((currentProject.referenceCount ?? 0) - 2, 0)} more
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </section>

                                <section className="rounded-xl border border-neutral-200 bg-white p-4">
                                    <h2 className="text-sm font-bold text-ink">
                                        Ocular visit
                                    </h2>

                                    <p className="mt-1 text-[10px] text-neutral-400">
                                        Recorded by the Project Manager · {currentProject.ocularDate ?? 'Date unavailable'}
                                    </p>

                                    <div className="mt-3 flex flex-col gap-2">
                                        {currentProject.ocularReport ? (
                                            <a
                                                href={currentProject.ocularReport}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center justify-between rounded-lg border border-neutral-100 p-2 text-[10px] text-neutral-600 hover:bg-neutral-50"
                                            >
                                                <span>▤ &nbsp; Site assessment report</span>
                                                <span className="text-purple-700">PDF</span>
                                            </a>
                                        ) : (
                                            <div className="flex items-center justify-between rounded-lg border border-neutral-100 p-2 text-[10px] text-neutral-600">
                                                <span>▤ &nbsp; Site assessment report</span>
                                                <span>PDF</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between rounded-lg border border-neutral-100 p-2 text-[10px] text-neutral-600">
                                            <span>▧ &nbsp; Venue photos</span>
                                            <span>{venuePhotos.length || 8} photos</span>
                                        </div>

                                        {venuePhotos.length > 0 && (
                                            <div className="grid grid-cols-3 gap-2">
                                                {venuePhotos.map((photo, index) => (
                                                    <img
                                                        key={index}
                                                        src={photo}
                                                        alt={`Venue photo ${index + 1}`}
                                                        className="aspect-square rounded-md object-cover"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </aside>
                        </div>
                    </>
                )}
            </main>
        </>
    );
}

AssignedProjects.layout = (page: ReactNode) => (
    <DesignSpecialistLayout>{page}</DesignSpecialistLayout>
);
