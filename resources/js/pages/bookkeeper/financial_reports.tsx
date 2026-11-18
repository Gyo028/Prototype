import { Head } from '@inertiajs/react';
import BookkeeperLayout from '@/layouts/bookkeeper-layout';
import { useMemo, useState } from 'react';

type ReportType = 'Cash flow statement' | 'Cost summary';

type ExpenseCategory =
    | 'Materials'
    | 'Fabrication'
    | 'Equipment rental'
    | 'Labor'
    | 'Transportation';

const projects = [
    'SM Mall Grand Opening',
    'Ayala Shopping Festival',
    'Robinsons Mega Mall Expo',
    'Quezon City Trade and Convention Fair',
];

const categories: ExpenseCategory[] = [
    'Materials',
    'Fabrication',
    'Equipment rental',
    'Labor',
    'Transportation',
];

const categoryColors: Record<ExpenseCategory, string> = {
    Materials: '#171717',
    Fabrication: '#facc15',
    'Equipment rental': '#3b82f6',
    Labor: '#16a34a',
    Transportation: '#dc2626',
};

const transactions = [
    {
        date: '2027-01-08',
        description: 'LED lighting equipment',
        project: projects[0],
        category: 'Equipment rental' as ExpenseCategory,
        amount: 12000,
        type: 'expense',
    },
    {
        date: '2027-01-10',
        description: 'Stage and event materials',
        project: projects[0],
        category: 'Materials' as ExpenseCategory,
        amount: 12900,
        type: 'expense',
    },
    {
        date: '2027-02-11',
        description: 'Tables and chairs setup',
        project: projects[1],
        category: 'Equipment rental' as ExpenseCategory,
        amount: 22000,
        type: 'expense',
    },
    {
        date: '2027-02-13',
        description: 'Mall entrance backdrop',
        project: projects[2],
        category: 'Fabrication' as ExpenseCategory,
        amount: 21000,
        type: 'expense',
    },
    {
        date: '2027-02-15',
        description: 'Customer down payment',
        project: projects[3],
        category: 'Materials' as ExpenseCategory,
        amount: 34000,
        type: 'income',
    },
    {
        date: '2027-03-18',
        description: 'Printed event materials',
        project: projects[1],
        category: 'Materials' as ExpenseCategory,
        amount: 28400,
        type: 'expense',
    },
    {
        date: '2027-03-20',
        description: 'Installation labor',
        project: projects[2],
        category: 'Labor' as ExpenseCategory,
        amount: 15000,
        type: 'expense',
    },
    {
        date: '2027-04-05',
        description: 'Transportation and delivery',
        project: projects[3],
        category: 'Transportation' as ExpenseCategory,
        amount: 8500,
        type: 'expense',
    },
];

const formatCurrency = (amount: number) =>
    `₱${amount.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatMonth = (period: string) =>
    new Date(`${period}-01T00:00:00`).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
    });

export default function FinancialReports() {
    const [reportType, setReportType] = useState<ReportType>('Cash flow statement');
    const [period, setPeriod] = useState('');
    const [selectedProject, setSelectedProject] = useState('All projects');
    const [generated, setGenerated] = useState(false);
    const [exported, setExported] = useState<string[]>([]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter((transaction) => {
            const matchesPeriod =
                !period || transaction.date.startsWith(period);

            const matchesProject =
                selectedProject === 'All projects' ||
                transaction.project === selectedProject;

            return matchesPeriod && matchesProject;
        });
    }, [period, selectedProject]);

    const totalIncome = filteredTransactions
        .filter((item) => item.type === 'income')
        .reduce((sum, item) => sum + item.amount, 0);

    const totalExpenses = filteredTransactions
        .filter((item) => item.type === 'expense')
        .reduce((sum, item) => sum + item.amount, 0);

    const netCashFlow = totalIncome - totalExpenses;

    const categoryTotals = categories.map((category) => {
        const amount = filteredTransactions
            .filter(
                (item) =>
                    item.category === category &&
                    item.type === 'expense',
            )
            .reduce((sum, item) => sum + item.amount, 0);

        return {
            name: category,
            amount,
        };
    });

    const generateReport = () => {
        if (!period) return;
        setGenerated(true);
    };

    const downloadReport = (format: 'PDF' | 'XLSX') => {
        if (!generated) return;

        const month = formatMonth(period);

        if (format === 'PDF') {
            window.print();
        } else {
            const headers = [
                'Date',
                'Description',
                'Project',
                'Category',
                'Type',
                'Amount',
            ];

            const rows = filteredTransactions.map((item) => [
                item.date,
                item.description,
                item.project,
                item.category,
                item.type,
                item.amount,
            ]);

            const csv = [headers, ...rows]
                .map((row) =>
                    row
                        .map(
                            (value) =>
                                `"${String(value).replace(/"/g, '""')}"`,
                        )
                        .join(','),
                )
                .join('\n');

            const blob = new Blob(['\uFEFF' + csv], {
                type: 'text/csv;charset=utf-8;',
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.download = `financial-report-${period}.csv`;
            link.click();

            URL.revokeObjectURL(url);
        }

        setExported((current) => [
            `${reportType} — ${month}`,
            ...current,
        ]);
    };

    const recentExports = [
        {
            type: 'PDF',
            name: 'Cash flow statement — October 2026',
            date: 'All projects · exported Nov 2, 2026',
        },
        {
            type: 'XLSX',
            name: 'Cost summary — October 2026',
            date: 'All projects · exported Nov 2, 2026',
        },
        {
            type: 'PDF',
            name: 'Cash flow statement — September 2026',
            date: 'All projects · exported Oct 1, 2026',
        },
    ];

    return (
        <BookkeeperLayout>
            <Head title="Financial Reports" />

            <main className="min-h-screen space-y-3 bg-[#f8f8fa] p-4">
                <header>
                    <h1 className="text-xl font-bold text-neutral-900">
                        Financial reports
                    </h1>
                    <p className="text-[10px] text-neutral-500">
                        Generate a report from recorded payments and expenses, then export it as PDF or Excel.
                    </p>
                </header>

                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
                    <section className="rounded-xl border border-neutral-200 bg-white p-3 lg:col-span-4">
                        <h2 className="mb-3 text-sm font-bold text-neutral-900">
                            Generate report
                        </h2>

                        <label className="mb-2 block text-[10px] font-semibold text-neutral-700">
                            Report type *
                        </label>

                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setReportType('Cash flow statement');
                                    setGenerated(false);
                                }}
                                className={`w-full rounded-lg border p-2 text-left transition ${
                                    reportType === 'Cash flow statement'
                                        ? 'border-neutral-900 bg-neutral-50'
                                        : 'border-neutral-200 hover:border-neutral-400'
                                }`}
                            >
                                <p className="text-[10px] font-semibold text-neutral-900">
                                    Cash flow statement
                                </p>
                                <p className="mt-0.5 text-[9px] leading-3 text-neutral-500">
                                    Money in from verified customer payments and money out from recorded expenses, with the net cash flow.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setReportType('Cost summary');
                                    setGenerated(false);
                                }}
                                className={`w-full rounded-lg border p-2 text-left transition ${
                                    reportType === 'Cost summary'
                                        ? 'border-neutral-900 bg-neutral-50'
                                        : 'border-neutral-200 hover:border-neutral-400'
                                }`}
                            >
                                <p className="text-[10px] font-semibold text-neutral-900">
                                    Cost summary
                                </p>
                                <p className="mt-0.5 text-[9px] leading-3 text-neutral-500">
                                    Project costs by expense category, compared with each project's total billed amount.
                                </p>
                            </button>
                        </div>

                        <div className="mt-3">
                            <label className="mb-1 block text-[10px] font-semibold text-neutral-700">
                                Report period *
                            </label>

                            <select
                                value={period}
                                onChange={(e) => {
                                    setPeriod(e.target.value);
                                    setGenerated(false);
                                }}
                                className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] outline-none focus:border-neutral-900"
                            >
                                <option value="">Select a period</option>
                                <option value="2027-01">January 2027</option>
                                <option value="2027-02">February 2027</option>
                                <option value="2027-03">March 2027</option>
                                <option value="2027-04">April 2027</option>
                            </select>
                        </div>

                        <div className="mt-3">
                            <label className="mb-1 block text-[10px] font-semibold text-neutral-700">
                                Project
                            </label>

                            <select
                                value={selectedProject}
                                onChange={(e) => {
                                    setSelectedProject(e.target.value);
                                    setGenerated(false);
                                }}
                                className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-2 text-[10px] outline-none focus:border-neutral-900"
                            >
                                <option>All projects</option>
                                {projects.map((project) => (
                                    <option key={project}>{project}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={generateReport}
                            disabled={!period}
                            className="mt-3 w-full rounded-lg bg-neutral-900 px-3 py-3 text-[10px] font-bold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Generate report
                        </button>
                    </section>

                    <section className="min-h-[165px] rounded-xl border border-neutral-200 bg-white p-3 lg:col-span-8">
                        {!generated ? (
                            <div className="flex min-h-[135px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 text-center">
                                <svg
                                    viewBox="0 0 24 24"
                                    className="mb-2 h-6 w-6 text-neutral-400"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.5"
                                >
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <path d="M14 2v6h6M8 13h8M8 17h8" />
                                </svg>

                                <p className="text-xs font-bold text-neutral-900">
                                    No report generated yet
                                </p>
                                <p className="mt-1 text-[10px] text-neutral-500">
                                    Choose a report type and period, then select Generate report.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <h2 className="text-sm font-bold text-neutral-900">
                                            {reportType}
                                        </h2>
                                        <p className="text-[10px] text-neutral-500">
                                            {formatMonth(period)} · {selectedProject}
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => downloadReport('PDF')}
                                            className="rounded-md border border-neutral-200 px-3 py-2 text-[10px] font-semibold text-neutral-800 hover:bg-neutral-50"
                                        >
                                            PDF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => downloadReport('XLSX')}
                                            className="rounded-md bg-neutral-900 px-3 py-2 text-[10px] font-semibold text-white hover:bg-neutral-700"
                                        >
                                            Export Excel
                                        </button>
                                    </div>
                                </div>

                                {reportType === 'Cash flow statement' ? (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                        <ReportStat
                                            label="Cash In"
                                            amount={totalIncome}
                                            color="#facc15"
                                        />
                                        <ReportStat
                                            label="Cash Out"
                                            amount={totalExpenses}
                                            color="#171717"
                                        />
                                        <ReportStat
                                            label="Net Cash Flow"
                                            amount={netCashFlow}
                                            color="#facc15"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {categoryTotals.map((item) => (
                                            <div key={item.name}>
                                                <div className="flex justify-between text-[10px]">
                                                    <span className="text-neutral-700">
                                                        {item.name}
                                                    </span>
                                                    <span className="font-semibold text-neutral-900">
                                                        {formatCurrency(item.amount)}
                                                    </span>
                                                </div>
                                                <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                                                    <div
                                                        className="h-full rounded-full"
                                                        style={{
                                                            width: `${
                                                                totalExpenses
                                                                    ? (item.amount / totalExpenses) * 100
                                                                    : 0
                                                            }%`,
                                                            backgroundColor: categoryColors[item.name],
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        <p className="border-t border-neutral-100 pt-3 text-xs font-bold text-neutral-900">
                                            Total expenses: {formatCurrency(totalExpenses)}
                                        </p>
                                    </div>
                                )}

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[10px]">
                                        <thead>
                                            <tr className="border-b border-neutral-100 text-neutral-500">
                                                <th className="py-2">Description</th>
                                                <th className="py-2">Project</th>
                                                <th className="py-2 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTransactions.map((item, index) => (
                                                <tr key={index} className="border-b border-neutral-50">
                                                    <td className="py-2 text-neutral-800">
                                                        {item.description}
                                                    </td>
                                                    <td className="py-2 text-neutral-600">
                                                        {item.project}
                                                    </td>
                                                    <td className="py-2 text-right font-semibold text-neutral-900">
                                                        {item.type === 'expense' ? '−' : '+'}
                                                        {formatCurrency(item.amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredTransactions.length === 0 && (
                                                <tr>
                                                    <td colSpan={3} className="py-6 text-center text-neutral-400">
                                                        No transactions found for this period.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                <section className="rounded-xl border border-neutral-200 bg-white p-3">
                    <h2 className="mb-2 text-sm font-bold text-neutral-900">
                        Recently exported
                    </h2>

                    <div className="divide-y divide-neutral-100">
                        {exported.map((item, index) => (
                            <div
                                key={`${item}-${index}`}
                                className="flex items-center justify-between gap-3 py-3"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="rounded bg-yellow-100 px-2 py-1 text-[8px] font-bold text-neutral-900">
                                        CSV
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-[10px] font-medium text-neutral-900">
                                            {item}
                                        </p>
                                        <p className="text-[9px] text-neutral-500">
                                            {selectedProject} · recently exported
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => downloadReport('XLSX')}
                                    className="text-[9px] font-semibold text-neutral-900 underline decoration-yellow-400 underline-offset-2"
                                >
                                    Download
                                </button>
                            </div>
                        ))}

                        {recentExports.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between gap-3 py-3"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <span
                                        className={`rounded px-2 py-1 text-[8px] font-bold ${
                                            item.type === 'PDF'
                                                ? 'bg-neutral-100 text-neutral-900'
                                                : 'bg-green-100 text-green-800'
                                        }`}
                                    >
                                        {item.type}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-[10px] font-medium text-neutral-900">
                                            {item.name}
                                        </p>
                                        <p className="text-[9px] text-neutral-500">
                                            {item.date}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[9px] font-semibold text-neutral-900 underline decoration-yellow-400 underline-offset-2">
                                    Download
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
            </main>

            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    main, main * {
                        visibility: visible;
                    }
                    main {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                    }
                    button, header, main > section:first-of-type {
                        display: none !important;
                    }
                }
            `}</style>
        </BookkeeperLayout>
    );
}

function ReportStat({
    label,
    amount,
    color,
}: {
    label: string;
    amount: number;
    color: string;
}) {
    return (
        <div className="rounded-lg border border-neutral-200 p-3">
            <p className="text-[10px] text-neutral-500">{label}</p>
            <p className="mt-2 text-lg font-bold text-neutral-900">
                {amount < 0 ? '−' : ''}
                {formatCurrency(amount)}
            </p>
            <div
                className="mt-2 h-1 w-8 rounded-full"
                style={{ backgroundColor: color }}
            />
        </div>
    );
}