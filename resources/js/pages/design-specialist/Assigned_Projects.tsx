import { Head, Link } from '@inertiajs/react';
import DesignSpecialistLayout from '@/layouts/design-specialist-layout';
import type { ReactNode } from 'react';

interface QuotationItem {
    description: string;
    amount: number | null;
}

interface AssignedProjectData {
    id: number;
    code: string;
    name: string;
    customer: string;
    assignedDate: string;
    status: string;
    eventType: string;
    theme: string;
    eventDate: string;
    venue: string;
    budget: string;
    servicePackage: string;
    consultation: string;
    revisionVersion: number;
    revisionDate: string;
    revisionRemarks: string;
    layoutImage: string | null;
    references: string[];
    quotations: QuotationItem[];
    ocularReport: string | null;
    venuePhotos: string[];
}

interface AssignedProjectProps {
    project?: AssignedProjectData;
}

const SAMPLE_PROJECT: AssignedProjectData = {
    id: 1,
    code: 'EVP-2026-041',
    name: 'Mall Event',
    customer: 'Juan Santos',
    assignedDate: 'Oct 22, 2026',
    status: 'Revision requested by customer',
    eventType: 'Arch Set Up',
    theme: 'Garden',
    eventDate: 'Feb 14, 2027',
    venue: 'Garden pavilion (indoor)',
    budget: '₱250,000',
    servicePackage: 'Package name',

    consultation:
        'Customer will proceed. Wants a floral arch at the entrance, and a photo wall near the stage.',

    revisionVersion: 2,
    revisionDate: 'Nov 6, 2026',

    revisionRemarks:
        'Change the arch florals to white and sage, and move the photo wall to the left of the stage.',

    layoutImage: null,
    references: [],

    quotations: [
        { description: 'Floral arch (entrance)', amount: 18000 },
        { description: 'Long tables with linens × 15', amount: 18000 },
        { description: 'Chairs × 150', amount: 18000 },
        { description: 'Stage backdrop', amount: 22000 },
        { description: 'Centerpieces × 15', amount: 12750 },
        { description: 'Photo wall', amount: 9500 },
        { description: 'Lounge seating × 2', amount: 9000 },
        { description: 'Ceiling draping and lights', amount: 56200 },
        { description: 'Hanging greenery (custom item)', amount: null },
    ],

    ocularReport: null,
    venuePhotos: [],
};

const WORKFLOW = [
    { label: 'Assigned', detail: 'Oct 22', status: 'completed' },
    { label: '2D proposal + quotation', detail: 'Version 2 - Nov 3', status: 'completed' },
    { label: 'Project Manager review', detail: 'Approved Nov 4', status: 'completed' },
    { label: 'Customer review', detail: 'Revision requested Nov 6', status: 'revision' },
    { label: 'Approved', detail: 'Pending', status: 'pending' },
];

function SectionCard({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <section className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-bold text-ink">
                {title}
            </h2>
            {children}
        </section>
    );
}

function formatCurrency(amount: number) {
    return `₱${amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

export default function AssignedProject({
    project = SAMPLE_PROJECT,
}: AssignedProjectProps) {

    const estimatedTotal = project.quotations.reduce(
        (total, item) => total + (item.amount ?? 0),
        0,
    );

    return (
        <DesignSpecialistLayout>
            <Head title={`${project.name} - Assigned Project`} />

            <main className="flex flex-col gap-4">

                {/* PROJECT HEADER */}
                <header>
                    <p className="text-xs text-neutral-500">
                        <Link
                            href="/design-specialist"
                            className="hover:text-purple-700"
                        >
                            Assigned Projects
                        </Link>
                        {' / '}
                        {project.code}
                    </p>

                    <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl font-bold text-ink">
                                    {project.name}
                                </h1>

                                <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-semibold text-orange-700">
                                    {project.status}
                                </span>
                            </div>

                            <p className="mt-1 text-xs text-neutral-500">
                                Assigned by the Project Manager on{' '}
                                {project.assignedDate}
                                {' · '}
                                Customer: {project.customer}
                            </p>
                        </div>

                        <button
                            type="button"
                            disabled
                            className="rounded-lg bg-purple-800 px-4 py-2.5 text-xs font-semibold text-white opacity-80 disabled:cursor-not-allowed"
                        >
                            ↑ Submit version {project.revisionVersion + 1}
                        </button>
                    </div>
                </header>

                {/* PROJECT WORKFLOW */}
                <section className="rounded-xl border border-neutral-200 bg-white p-4">

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {WORKFLOW.map((step) => (
                            <div key={step.label}>
                                <div
                                    className={`mb-2 h-1 rounded-full ${
                                        step.status === 'completed'
                                            ? 'bg-purple-800'
                                            : step.status === 'revision'
                                              ? 'bg-orange-500'
                                              : 'bg-neutral-200'
                                    }`}
                                />

                                <p className="text-[11px] font-semibold text-ink">
                                    {step.label}
                                </p>

                                <p className="mt-1 text-[10px] text-neutral-500">
                                    {step.detail}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* REVISION REQUEST */}
                    <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50/50 p-3">
                        <p className="text-xs font-semibold text-orange-800">
                            Open revision request · Version{' '}
                            {project.revisionVersion}
                            {' · From Customer · '}
                            {project.revisionDate}
                        </p>

                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
                            Remarks: {project.revisionRemarks}
                        </p>
                    </div>
                </section>

                {/* PROJECT CONTENT */}
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">

                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-4 xl:col-span-9">

                        {/* PROJECT SPECIFICATIONS */}
                        <SectionCard title="Project details">

                            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">

                                {[
                                    ['Event type', project.eventType],
                                    ['Theme', project.theme],
                                    ['Budget', project.budget],
                                    ['Venue', project.venue],
                                    ['Event date', project.eventDate],
                                    ['Service package', project.servicePackage],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <p className="text-[10px] text-neutral-400">
                                            {label}
                                        </p>

                                        <p className="mt-1 text-xs font-medium text-ink">
                                            {value}
                                        </p>
                                    </div>
                                ))}

                            </div>

                            <div className="mt-4">
                                <p className="mb-2 text-[10px] font-semibold text-neutral-500">
                                    Consultation outcome (recorded by Project Manager)
                                </p>

                                <div className="rounded-lg bg-neutral-50 p-3 text-[11px] leading-relaxed text-neutral-600">
                                    {project.consultation}
                                </div>
                            </div>

                        </SectionCard>

                        {/* CUSTOMER 2D LAYOUT */}
                        <SectionCard title="Customer's preliminary 2D layout">

                            <p className="mt-1 text-[10px] text-neutral-400">
                                Made by the customer in the 2D Design Layout tool when submitting the service request.
                            </p>

                            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">

                                {/* LAYOUT IMAGE */}
                                <div className="flex min-h-[280px] items-center justify-center overflow-hidden rounded-lg bg-[#f0edf3]">

                                    {project.layoutImage ? (
                                        <img
                                            src={project.layoutImage}
                                            alt="Customer 2D layout"
                                            className="h-full max-h-[350px] w-full object-contain"
                                        />
                                    ) : (
                                        <div className="text-center text-neutral-400">
                                            <span className="text-3xl">▧</span>
                                            <p className="mt-2 text-xs">
                                                Layout snapshot image
                                            </p>
                                        </div>
                                    )}

                                </div>

                                {/* INITIAL QUOTATION */}
                                <div>

                                    <h3 className="mb-3 text-xs font-semibold text-ink">
                                        Initial quotation
                                    </h3>

                                    <div className="flex flex-col gap-2">

                                        {project.quotations.map((item, index) => (
                                            <div
                                                key={index}
                                                className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-2 text-[10px]"
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
                                        ))}

                                    </div>

                                    <div className="mt-3 flex justify-between border-t border-neutral-200 pt-3 text-xs font-bold text-ink">
                                        <span>Estimated total</span>

                                        <span>
                                            {formatCurrency(estimatedTotal)}
                                        </span>
                                    </div>

                                    <div className="mt-3 rounded-lg bg-neutral-50 p-2">
                                        <p className="text-[10px] leading-relaxed text-neutral-500">
                                            Initial material cost estimate only. The final project quotation is prepared with the design proposal and finalized by the Project Manager.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        disabled
                                        className="mt-3 text-[10px] font-semibold text-purple-800 underline disabled:cursor-not-allowed"
                                    >
                                        Download initial quotation (PDF)
                                    </button>

                                </div>
                            </div>

                        </SectionCard>

                    </div>
                    <aside className="flex flex-col gap-4 xl:col-span-3">
                        <SectionCard title="Reference designs">
                            <p className="mt-1 text-[10px] text-neutral-400">
                                Uploaded by the customer · {project.references.length} files
                            </p>

                            {project.references.length > 0 ? (
                                <div className="mt-3 grid grid-cols-3 gap-2">

                                    {project.references.map((image, index) => (
                                        <a
                                            key={index}
                                            href={image}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="aspect-square overflow-hidden rounded-md bg-neutral-100"
                                        >
                                            <img
                                                src={image}
                                                alt={`Reference design ${index + 1}`}
                                                className="h-full w-full object-cover"
                                            />
                                        </a>
                                    ))}

                                </div>
                            ) : (
                                <div className="mt-3 rounded-lg bg-neutral-50 p-4 text-center text-[10px] text-neutral-400">
                                    No reference images uploaded.
                                </div>
                            )}

                        </SectionCard>

                        {/* OCULAR VISIT */}
                        <SectionCard title="Ocular visit">

                            <p className="mt-1 text-[10px] text-neutral-400">
                                Recorded by the Project Manager
                            </p>

                            <div className="mt-3 flex flex-col gap-2">

                                {project.ocularReport ? (
                                    <a
                                        href={project.ocularReport}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center justify-between rounded-lg border border-neutral-100 p-2 text-[10px] text-neutral-600 hover:bg-neutral-50"
                                    >
                                        <span>▤ &nbsp; Site assessment report</span>
                                        <span className="text-purple-700">PDF</span>
                                    </a>
                                ) : (
                                    <div className="rounded-lg bg-neutral-50 p-3 text-[10px] text-neutral-400">
                                        No site assessment report available.
                                    </div>
                                )}

                                <div className="flex items-center justify-between rounded-lg border border-neutral-100 p-2 text-[10px] text-neutral-600">
                                    <span>▧ &nbsp; Venue photos</span>
                                    <span>{project.venuePhotos.length} photos</span>
                                </div>

                                {project.venuePhotos.length > 0 && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {project.venuePhotos.map((photo, index) => (
                                            <a
                                                key={index}
                                                href={photo}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="aspect-square overflow-hidden rounded-md"
                                            >
                                                <img
                                                    src={photo}
                                                    alt={`Venue photo ${index + 1}`}
                                                    className="h-full w-full object-cover"
                                                />
                                            </a>
                                        ))}
                                    </div>
                                )}

                            </div>

                        </SectionCard>

                    </aside>
                </div>
            </main>
        </DesignSpecialistLayout>
    );
}
