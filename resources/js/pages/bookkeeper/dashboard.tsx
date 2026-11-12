
import { Head } from '@inertiajs/react';
import BookkeeperLayout from '@/layouts/bookkeeper-layout';
import { useState } from 'react';

type ProjectStatus = 'Ongoing' | 'Completed';

interface Project {
    id: number;
    name: string;
    code: string;
    eventDate: string;
    status: ProjectStatus;
    billed: number;
    paid: number;
    expenses: number;
    net: number;
}

interface Transaction {
    id: number;
    date: string;
    description: string;
    project: string;
    type: string;
    amount: number;
    category: 'income' | 'expense';
}

const projects: Project[] = [
    { id: 1, name: 'Games Event', code: 'EVP-2026-025', eventDate: 'Sept 17, 2026', status: 'Ongoing', billed: 335000, paid: 160000, expenses: 96400, net: 63600 },
    { id: 2, name: 'Christmas Launch', code: 'EVP-2026-030', eventDate: 'Nov 12, 2026', status: 'Ongoing', billed: 128500, paid: 88000, expenses: 64300, net: 23700 },
    { id: 3, name: 'Bay Board', code: 'EVP-2026-033', eventDate: 'Aug 7, 2026', status: 'Ongoing', billed: 68000, paid: 34000, expenses: 12100, net: 21900 },
    { id: 4, name: 'Independence Day Event', code: 'EVP-2026-020', eventDate: 'July 12, 2026', status: 'Completed', billed: 210000, paid: 210000, expenses: 78950, net: 131050 },
    { id: 5, name: 'Plants and Pots', code: 'EVP-2026-022', eventDate: 'July 11, 2026', status: 'Completed', billed: 95000, paid: 95000, expenses: 58200, net: 36800 },
];

const transactions: Transaction[] = [
    { id: 1, date: 'May 8, 2026', description: 'LED', project: 'Cruz 25th Anniversary', type: 'Equipment rental', amount: -12000, category: 'expense' },
    { id: 2, date: 'May 5, 2026', description: 'Plants', project: 'Del Rosario Christening', type: 'Materials', amount: -12900, category: 'expense' },
    { id: 3, date: 'May 11, 2026', description: 'Table SetUp', project: 'Harbor Point Mall 5th Anniversary', type: 'Equipment rental', amount: -22000, category: 'expense' },
    { id: 4, date: 'May 13, 2026', description: 'Backdrop arch', project: 'Cruz 25th Anniversary', type: 'Fabrication', amount: -21000, category: 'expense' },
    { id: 5, date: 'May 18, 2026', description: 'Reservation fee and down payment', project: 'Del Rosario Christening', type: 'Payment', amount: 34000, category: 'income' },
    { id: 6, date: 'May 20, 2026', description: 'Print and props', project: 'Harbor Point Mall 5th Anniversary', type: 'Materials', amount: -28400, category: 'expense' },
];

const cashFlow = [
    { month: 'May', cashIn: 140000, cashOut: 18000 },
    { month: 'June', cashIn: 340000, cashOut: 224000 },
    { month: 'July', cashIn: 109000, cashOut: 125600 },
];

const outstandingBalances = [
    { id: 1, name: 'Games Event', balance: 1335000, paid: '48%', due: 'Oct 30' },
    { id: 2, name: 'Mall Event', balance: 800500, paid: '69%', due: 'Jan 5' },
    { id: 3, name: 'Arch Setup', balance: 34000, paid: '50%', due: 'Nov 2' },
];

const formatCurrency = (amount: number) =>
    `₱${Math.abs(amount).toLocaleString('en-PH')}`;

export default function Dashboard() {
    const [activeFilter, setActiveFilter] = useState('All');
    const [showAll, setShowAll] = useState(false);

    const filteredProjects = projects.filter(
        (project) => activeFilter === 'All' || project.status === activeFilter,
    );

    const displayedTransactions = showAll ? transactions : transactions.slice(0, 4);

    return (
        <BookkeeperLayout>
            <Head title="Bookkeeper Dashboard" />

            <main className="flex flex-col gap-5">

                <header>
                    <p className="text-xs text-neutral-500">Bookkeeper / Dashboard</p>
                    <h1 className="mt-1 text-2xl font-bold text-neutral-900">
                        Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-neutral-500">
                        Financial overview of GR3AT A's projects.
                    </p>
                </header>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Cash In" value="₱109,000" description="November 2026" />
                    <StatCard label="Cash Out" value="₱125,600" description="November 2026" />
                    <StatCard label="Net Cash Flow" value="−₱16,600" description="Current monthly balance" />
                    <StatCard label="Outstanding Balance" value="₱245,500" description="3 projects with unpaid balances" />
                </section>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">

                    <section className="rounded-xl border border-neutral-200 bg-white p-4 xl:col-span-8">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-bold text-neutral-900">Cash flow</h2>
                                <p className="mt-1 text-xs text-neutral-500">
                                    Monthly customer payments and recorded expenses
                                </p>
                            </div>

                            <div className="flex gap-3 text-[10px] text-neutral-600">
                                <span className="flex items-center gap-1">
                                    <span className="size-2 rounded-sm bg-yellow-400" />
                                    Cash In
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="size-2 rounded-sm bg-neutral-900" />
                                    Cash Out
                                </span>
                            </div>
                        </div>

                        <div className="flex h-52 items-end justify-around gap-3 border-b border-neutral-100 px-2">
                            {cashFlow.map((item) => (
                                <div key={item.month} className="flex h-full flex-1 items-end justify-center gap-2">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[9px] text-neutral-500">
                                            ₱{(item.cashIn / 1000).toFixed(0)}k
                                        </span>
                                        <div
                                            className="w-8 rounded-t-md bg-yellow-400"
                                            style={{ height: `${(item.cashIn / 350000) * 145}px` }}
                                        />
                                    </div>

                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[9px] text-neutral-500">
                                            ₱{(item.cashOut / 1000).toFixed(0)}k
                                        </span>
                                        <div
                                            className="w-8 rounded-t-md bg-neutral-900"
                                            style={{ height: `${(item.cashOut / 350000) * 145}px` }}
                                        />
                                    </div>

                                    <span className="absolute" />
                                </div>
                            ))}
                        </div>

                        <div className="mt-2 flex justify-around text-[10px] text-neutral-500">
                            {cashFlow.map((item) => (
                                <span key={item.month}>{item.month}</span>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-xl border border-neutral-200 bg-white p-4 xl:col-span-4">
                        <h2 className="text-sm font-bold text-neutral-900">
                            Expenses by category
                        </h2>
                        <p className="mt-1 text-xs text-neutral-500">August 2025</p>

                        <div className="mt-5 flex flex-col gap-4">
                            <CategoryItem label="Materials" amount="₱70,336" percentage="56%" />
                            <CategoryItem label="Equipment rental" amount="₱33,912" percentage="27%" />
                            <CategoryItem label="Fabrication" amount="₱21,352" percentage="17%" />
                        </div>

                        <div className="mt-5 rounded-lg bg-yellow-50 p-3">
                            <p className="text-xs text-neutral-600">Total expenses</p>
                            <p className="mt-1 text-xl font-bold text-neutral-900">₱125,600</p>
                        </div>
                    </section>
                </div>

                <section className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-neutral-900">Project finances</h2>
                            <p className="mt-1 text-xs text-neutral-500">
                                Financial records for assigned projects
                            </p>
                        </div>

                        <div className="flex gap-1">
                            {['All', 'Ongoing', 'Completed'].map((filter) => (
                                <button
                                    key={filter}
                                    type="button"
                                    onClick={() => setActiveFilter(filter)}
                                    className={`rounded-lg px-3 py-2 text-[10px] font-semibold ${
                                        activeFilter === filter
                                            ? 'bg-yellow-400 text-neutral-900'
                                            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                    }`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredProjects.length === 0 ? (
                        <EmptyState text="No project records available." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[650px] text-left">
                                <thead>
                                    <tr className="border-b border-neutral-100 bg-neutral-50 text-[11px] text-neutral-500">
                                        <th className="px-3 py-3 font-medium">Project</th>
                                        <th className="px-3 py-3 font-medium">Status</th>
                                        <th className="px-3 py-3 font-medium">Billed</th>
                                        <th className="px-3 py-3 font-medium">Paid</th>
                                        <th className="px-3 py-3 font-medium">Expenses</th>
                                        <th className="px-3 py-3 font-medium">Net</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProjects.map((project) => (
                                        <tr key={project.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                                            <td className="px-3 py-3">
                                                <p className="text-xs font-semibold text-neutral-900">{project.name}</p>
                                                <p className="mt-1 text-[10px] text-neutral-500">{project.code} · {project.eventDate}</p>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                    project.status === 'Ongoing'
                                                        ? 'bg-yellow-100 text-yellow-800'
                                                        : 'bg-neutral-100 text-neutral-700'
                                                }`}>
                                                    {project.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-xs text-neutral-600">{formatCurrency(project.billed)}</td>
                                            <td className="px-3 py-3 text-xs text-neutral-600">{formatCurrency(project.paid)}</td>
                                            <td className="px-3 py-3 text-xs text-neutral-600">{formatCurrency(project.expenses)}</td>
                                            <td className="px-3 py-3 text-xs font-semibold text-neutral-900">{formatCurrency(project.net)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                    <section className="rounded-xl border border-neutral-200 bg-white p-4 xl:col-span-5">
                        <h2 className="text-sm font-bold text-neutral-900">
                            Outstanding balances
                        </h2>
                        <p className="mt-1 text-xs text-neutral-500">
                            Projects with remaining customer payments
                        </p>

                        <div className="mt-4 flex flex-col gap-4">
                            {outstandingBalances.map((item) => (
                                <div key={item.id}>
                                    <div className="flex justify-between gap-2">
                                        <p className="text-xs font-semibold text-neutral-800">{item.name}</p>
                                        <p className="whitespace-nowrap text-xs font-bold text-neutral-900">{formatCurrency(item.balance)}</p>
                                    </div>
                                    <p className="mt-1 text-[10px] text-neutral-500">
                                        {item.paid} paid · Due {item.due}, 2026
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-xl border border-neutral-200 bg-white p-4 xl:col-span-7">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-neutral-900">Recent transactions</h2>
                                <p className="mt-1 text-xs text-neutral-500">
                                    Latest recorded payments and expenses
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAll(!showAll)}
                                className="text-xs font-semibold text-neutral-800 underline decoration-yellow-500 underline-offset-4"
                            >
                                {showAll ? 'Show less' : 'View all'}
                            </button>
                        </div>

                        <div className="flex flex-col">
                            {displayedTransactions.map((transaction) => (
                                <div key={transaction.id} className="flex flex-col gap-2 border-b border-neutral-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-neutral-800">{transaction.description}</p>
                                        <p className="mt-1 text-[10px] text-neutral-500">
                                            {transaction.project} · {transaction.date}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                                        <span className="rounded-full bg-neutral-100 px-2 py-1 text-[9px] text-neutral-600">
                                            {transaction.type}
                                        </span>
                                        <span className={`text-xs font-bold ${
                                            transaction.category === 'income'
                                                ? 'text-green-700'
                                                : 'text-neutral-900'
                                        }`}>
                                            {transaction.amount < 0 ? '−' : '+'}{formatCurrency(transaction.amount)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </BookkeeperLayout>
    );
}

function StatCard({
    label,
    value,
    description,
}: {
    label: string;
    value: string;
    description: string;
}) {
    return (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="mt-3 text-2xl font-bold text-neutral-900">{value}</p>
            <p className="mt-2 text-[10px] text-neutral-500">{description}</p>
            <div className="mt-3 h-1 w-10 rounded-full bg-yellow-400" />
        </div>
    );
}

function CategoryItem({
    label,
    amount,
    percentage,
}: {
    label: string;
    amount: string;
    percentage: string;
}) {
    return (
        <div>
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-700">{label}</p>
                <p className="text-xs font-semibold text-neutral-900">{amount}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-neutral-100">
                    <div className="h-full rounded-full bg-yellow-400" style={{ width: percentage }} />
                </div>
                <span className="w-8 text-right text-[10px] text-neutral-500">{percentage}</span>
            </div>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="rounded-lg bg-neutral-50 px-4 py-8 text-center">
            <p className="text-xs text-neutral-500">{text}</p>
        </div>
    );
}
