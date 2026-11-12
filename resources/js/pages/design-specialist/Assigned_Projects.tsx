
import { Head, Link } from '@inertiajs/react';
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
    revisionVersion?: number;
    revisionDate?: string;
    revisionRemarks?: string;
    layoutImage?: string | null;
    references?: string[];
    referenceCount?: number;
    quotations?: QuotationItem[];
    ocularDate?: string;
    ocularReport?: string | null;
    venuePhotos?: string[];
};

type Props = {
    project?: Project | null;
};

const SAMPLE_PROJECT: Project = {
    id: 1,
    code: 'EVP-2026-041',
    name: 'Hotel Setup – December Getaway',
    customer: 'December Getaway Hotel',
    assignedDate: 'Oct 20, 2026',
    status: 'New assignment',
    eventType: 'Hotel Setup',
    theme: 'Christmas getaway, gold & white',
    budget: '₱250,000',
    venue: 'Hotel Function Hall and Lobby',
    eventDate: 'Dec 10, 2026',
    servicePackage: 'Holiday Hotel Setup Package',
    consultation:
        'The hotel will proceed with a December getaway setup. The design includes a Christmas entrance display, reception decorations, festive lounge seating, dining area styling, and a holiday photo wall.',
    revisionVersion: 2,
    revisionDate: 'Nov 6, 2026',
    revisionRemarks:
        'Update the entrance decorations with gold and white accents and reposition the holiday photo wall near the reception area.',
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
};

const WORKFLOW = [
    { label: 'Assigned', detail: 'Oct 20, 2026', status: 'completed' },
    { label: '2D proposal + quotation', detail: 'In progress', status: 'active' },
    { label: 'Project Manager review', detail: 'Pending', status: 'pending' },
    { label: 'Customer review', detail: 'Pending', status: 'pending' },
    { label: 'Approved', detail: 'Pending', status: 'pending' },
];

const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

export default function AssignedProjects({
    project = SAMPLE_PROJECT,
}: Props) {
    const currentProject = project ?? SAMPLE_PROJECT;
    const quotations = currentProject.quotations ?? [];
    const references = currentProject.references ?? [];
    const venuePhotos = currentProject.venuePhotos ?? [];

    const estimatedTotal = quotations.reduce(
        (total, item) => total + (item.amount ?? 0),
        0,
    );

    return (
        <>
            <Head title={currentProject.name} />

            <main className="flex flex-col gap-4 p-6">
                <header>
                    <p className="text-xs text-neutral-500">
                        <Link
                            href="/design-specialist"
                            className="hover:text-purple-800"
                        >
                            Assigned Projects
                        </Link>
                        {' / '}
                        {currentProject.code ?? 'Project Details'}
                    </p>

                    <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl font-bold text-ink">
                                    {currentProject.name}
                                </h1>

                                <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700">
                                    {currentProject.status ?? 'New assignment'}
                                </span>
                            </div>

                            <p className="mt-1 text-[11px] text-neutral-500">
                                Assigned by the Project Manager on{' '}
                                {currentProject.assignedDate ?? 'Date unavailable'}
                                {' · '}
                                Customer: {currentProject.customer ?? 'Not specified'}
                            </p>
                        </div>

                        <button
                            type="button"
                            disabled
                            className="rounded-lg bg-purple-900 px-4 py-2.5 text-xs font-semibold text-white opacity-90"
                        >
                            ↑ Submit version 1
                        </button>
                    </div>
                </header>

                <section className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                        {WORKFLOW.map((step) => (
                            <div key={step.label}>
                                <div
                                    className={`mb-2 h-1 rounded-full ${
                                        step.status === 'completed'
                                            ? 'bg-purple-900'
                                            : step.status === 'active'
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

                    <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                        <p className="text-[11px] font-semibold text-blue-800">
                            Project deadline · December 10, 2026
                        </p>

                        <p className="mt-1 text-[11px] leading-relaxed text-neutral-600">
                            Complete the hotel setup design proposal, quotation, and required revisions before the project completion date.
                        </p>
                    </div>
                </section>

                <div className="flex gap-5 border-b border-neutral-200">
                    <div className="border-b-2 border-purple-800 px-2 pb-2 text-[11px] font-semibold text-purple-900">
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
                                            className="h-full max-h-[350px] w-full object-contain"
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

                                    <div className="flex flex-col">
                                        {quotations.map((item, index) => (
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
                                        ))}
                                    </div>

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
            </main>
        </>
    );
}

AssignedProjects.layout = (page: ReactNode) => (
    <DesignSpecialistLayout>{page}</DesignSpecialistLayout>
);
