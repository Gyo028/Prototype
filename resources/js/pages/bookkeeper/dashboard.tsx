import { Head, Link } from '@inertiajs/react';
import BookkeeperLayout from '@/layouts/bookkeeper-layout';
import { useState } from 'react';

type ProjectStatus = 'Ongoing' | 'Completed';

type ExpenseCategory =
    | 'Materials'
    | 'Fabrication'
    | 'Equipment rental'
    | 'Labor'
    | 'Transportation';

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
    type: ExpenseCategory | 'Payment';
    amount: number;
    category: 'income' | 'expense';
}

const projects: Project[] = [
    {
        id: 1,
        name: 'SM Mall Grand Opening',
        code: 'EVP-2027-025',
        eventDate: 'Feb 15, 2027',
        status: 'Ongoing',
        billed: 335000,
        paid: 160000,
        expenses: 96400,
        net: 63600,
    },
    {
        id: 2,
        name: 'Ayala Shopping Festival',
        code: 'EVP-2027-030',
        eventDate: 'Mar 12, 2027',
        status: 'Ongoing',
        billed: 128500,
        paid: 88000,
        expenses: 64300,
        net: 23700,
    },
    {
        id: 3,
        name: 'Robinsons Mega Mall Expo',
        code: 'EVP-2027-033',
        eventDate: 'Apr 7, 2027',
        status: 'Ongoing',
        billed: 210000,
        paid: 110000,
        expenses: 78950,
        net: 31050,
    },
    {
        id: 4,
        name: 'Quezon City Trade and Convention Fair',
        code: 'EVP-2027-020',
        eventDate: 'May 12, 2027',
        status: 'Completed',
        billed: 250000,
        paid: 250000,
        expenses: 125600,
        net: 124400,
    },
];

const categoryColors: Record<ExpenseCategory, string> = {
    Materials: '#171717',
    Fabrication: '#facc15',
    'Equipment rental': '#3b82f6',
    Labor: '#16a34a',
    Transportation: '#dc2626',
};

const transactions: Transaction[] = [
    {
        id: 1,
        date: 'Feb 8, 2027',
        description: 'LED lighting equipment',
        project: 'SM Mall Grand Opening',
        type: 'Equipment rental',
        amount: -12000,
        category: 'expense',
    },
    {
        id: 2,
        date: 'Feb 10, 2027',
        description: 'Stage and event materials',
        project: 'SM Mall Grand Opening',
        type: 'Materials',
        amount: -12900,
        category: 'expense',
    },
    {
        id: 3,
        date: 'Feb 11, 2027',
        description: 'Tables and chairs setup',
        project: 'Ayala Shopping Festival',
        type: 'Equipment rental',
        amount: -22000,
        category: 'expense',
    },
    {
        id: 4,
        date: 'Feb 13, 2027',
        description: 'Mall entrance backdrop',
        project: 'Robinsons Mega Mall Expo',
        type: 'Fabrication',
        amount: -21000,
        category: 'expense',
    },
    {
        id: 5,
        date: 'Feb 15, 2027',
        description: 'Reservation fee and down payment',
        project: 'Quezon City Trade and Convention Fair',
        type: 'Payment',
        amount: 34000,
        category: 'income',
    },
    {
        id: 6,
        date: 'Feb 18, 2027',
        description: 'Printed event materials and props',
        project: 'Ayala Shopping Festival',
        type: 'Materials',
        amount: -28400,
        category: 'expense',
    },
];

const cashFlow = [
    { month: 'January', cashIn: 140000, cashOut: 18000 },
    { month: 'February', cashIn: 340000, cashOut: 224000 },
    { month: 'March', cashIn: 109000, cashOut: 125600 },
];

const outstandingBalances = [
    {
        id: 1,
        name: 'SM Mall Grand Opening',
        balance: 175000,
        paid: '48%',
        due: 'Feb 28',
    },
    {
        id: 2,
        name: 'Ayala Shopping Festival',
        balance: 40500,
        paid: '69%',
        due: 'Mar 5',
    },
    {
        id: 3,
        name: 'Robinsons Mega Mall Expo',
        balance: 100000,
        paid: '52%',
        due: 'Apr 2',
    },
];

const formatCurrency = (amount: number) =>
    `₱${Math.abs(amount).toLocaleString('en-PH')}`;

export default function Dashboard() {
    const [activeFilter, setActiveFilter] = useState('All');
    const [showAll, setShowAll] = useState(false);

    const filteredProjects = projects.filter(
        (project) =>
            activeFilter === 'All' || project.status === activeFilter,
    );

    const displayedTransactions = showAll
        ? transactions
        : transactions.slice(0, 4);

    return (
        <BookkeeperLayout>
            <Head title="Bookkeeper Dashboard" />

            <main className="flex flex-col gap-5">
                <header>
                    <p className="text-xs text-neutral-500">
                        Bookkeeper / Dashboard
                    </p>
                    <h1 className="mt-1 text-2xl font-bold text-neutral-900">
                        Dashboard
                    </h1>
                    <p className="mt-1 text-sm text-neutral-500">
                        Financial overview of GR3AT A's projects.
                    </p>
                </header>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Cash In"
                        value="₱109,000"
                        description="February 2027"
                        color="#facc15"
                        href="/bookkeeper/expenses"
                    />

                    <StatCard
                        label="Cash Out"
                        value="₱125,600"
                        description="February 2027"
                        color="#171717"
                        href="/bookkeeper/expenses"
                    />

                    <StatCard
                        label="Net Cash Flow"
                        value="−₱16,600"
                        description="Current monthly balance"
                        color="#171717"
                        href="#cash-flow"
                    />

                    <StatCard
                        label="Outstanding Balance"
                        value="₱315,500"
                        description="3 projects with unpaid balances"
                        color="#facc15"
                        href="#outstanding-balances"
                    />
                </section>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                    <section
                        id="cash-flow"
                        className="scroll-mt-6 rounded-xl border border-neutral-200 bg-white p-4 xl:col-span-8"
                    >
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h2 className="text-sm font-bold text-neutral-900">
                                    Cash flow
                                </h2>
                                <p className="mt-1 text-xs text-neutral-500">
                                    Monthly customer payments and recorded expenses
                                </p>
                            </div>

                            <div className="flex gap-3 text-[10px] text-neutral-600">
                                <span className="flex items-center gap-1">
                                    <span className="size-2 rounded-full bg-yellow-400" />
                                    Cash In
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="size-2 rounded-full bg-neutral-900" />
                                    Cash Out
                                </span>
                            </div>
                        </div>

                        <div className="flex h-52 items-end justify-around gap-3 border-b border-neutral-100 px-2">
                            {cashFlow.map((item) => (
                                <div
                                    key={item.month}
                                    className="flex h-full flex-1 items-end justify-center gap-2"
                                >
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[9px] text-neutral-500">
                                            ₱{(item.cashIn / 1000).toFixed(0)}k
                                        </span>
                                        <div
                                            className="w-8 rounded-t-md bg-yellow-400"
                                            style={{
                                                height: `${(item.cashIn / 350000) * 145}px`,
                                            }}
                                        />
                                    </div>

                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[9px] text-neutral-500">
                                            ₱{(item.cashOut / 1000).toFixed(0)}k
                                        </span>
                                        <div
                                            className="w-8 rounded-t-md bg-neutral-900"
                                            style={{
                                                height: `${(item.cashOut / 350000) * 145}px`,
                                            }}
                                        />
                                    </div>
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
                        <p className="mt-1 text-xs text-neutral-500">
                            February 2027
                        </p>

                        <div className="mt-5 flex flex-col gap-4">
                            <CategoryItem
                                label="Materials"
                                amount="₱70,336"
                                percentage="56%"
                            />
                            <CategoryItem
                                label="Equipment rental"
                                amount="₱33,912"
                                percentage="27%"
                            />
                            <CategoryItem
                                label="Fabrication"
                                amount="₱21,352"
                                percentage="17%"
                            />
                        </div>

                        <div className="mt-5 rounded-lg bg-yellow-50 p-3">
                            <p className="text-xs text-neutral-600">
                                Total expenses
                            </p>
                            <p className="mt-1 text-xl font-bold text-neutral-900">
                                ₱125,600
                            </p>
                        </div>
                    </section>
                </div>

                <section className="rounded-xl border border-neutral-200 bg-white p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-bold text-neutral-900">
                                Project finances
                            </h2>
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
                                        <tr
                                            key={project.id}
                                            className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                                        >
                                            <td className="px-3 py-3">
                                                <p className="text-xs font-semibold text-neutral-900">
                                                    {project.name}
                                                </p>
                                                <p className="mt-1 text-[10px] text-neutral-500">
                                                    {project.code} · {project.eventDate}
                                                </p>
                                            </td>

                                            <td className="px-3 py-3">
                                                <span
                                                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                                                        project.status === 'Ongoing'
                                                            ? 'bg-yellow-100 text-yellow-800'
                                                            : 'bg-neutral-100 text-neutral-700'
                                                    }`}
                                                >
                                                    {project.status}
                                                </span>
                                            </td>

                                            <td className="px-3 py-3 text-xs text-neutral-600">
                                                {formatCurrency(project.billed)}
                                            </td>

                                            <td className="px-3 py-3 text-xs text-neutral-600">
                                                {formatCurrency(project.paid)}
                                            </td>

                                            <td className="px-3 py-3 text-xs text-neutral-600">
                                                {formatCurrency(project.expenses)}
                                            </td>

                                            <td className="px-3 py-3 text-xs font-semibold text-neutral-900">
                                                {formatCurrency(project.net)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                    <section
                        id="outstanding-balances"
                        className="scroll-mt-6 rounded-xl border border-neutral-200 bg-white p-4 xl:col-span-5"
                    >
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
                                        <p className="text-xs font-semibold text-neutral-800">
                                            {item.name}
                                        </p>
                                        <p className="whitespace-nowrap text-xs font-bold text-neutral-900">
                                            {formatCurrency(item.balance)}
                                        </p>
                                    </div>

                                    <p className="mt-1 text-[10px] text-neutral-500">
                                        {item.paid} paid · Due {item.due}, 2027
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="rounded-xl border border-neutral-200 bg-white p-4 xl:col-span-7">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-bold text-neutral-900">
                                    Recent transactions
                                </h2>
                                <p className="mt-1 text-xs text-neutral-500">
                                    Latest recorded payments and expenses
                                </p>
                            </div>

                            <Link
                                href="/bookkeeper/expenses"
                                className="text-xs font-semibold text-neutral-800 underline decoration-yellow-500 underline-offset-4 hover:text-yellow-700"
                            >
                                View all
                            </Link>
                        </div>

                        <div className="flex flex-col">
                            {displayedTransactions.map((transaction) => (
                                <div
                                    key={transaction.id}
                                    className="flex flex-col gap-2 border-b border-neutral-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-neutral-800">
                                            {transaction.description}
                                        </p>
                                        <p className="mt-1 text-[10px] text-neutral-500">
                                            {transaction.project} · {transaction.date}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                                        <span
                                            className="rounded-full px-2 py-1 text-[9px] font-medium"
                                            style={{
                                                backgroundColor:
                                                    transaction.category === 'income'
                                                        ? '#fef3c7'
                                                        : `${categoryColors[transaction.type as ExpenseCategory]}20`,
                                                color:
                                                    transaction.category === 'income'
                                                        ? '#854d0e'
                                                        : categoryColors[transaction.type as ExpenseCategory],
                                            }}
                                        >
                                            {transaction.type}
                                        </span>

                                        <span className="text-xs font-bold text-red-600">
                                            {transaction.amount < 0 ? '−' : '+'}
                                            {formatCurrency(transaction.amount)}
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
    color,
    href,
}: {
    label: string;
    value: string;
    description: string;
    color: string;
    href: string;
}) {
    return (
        <a
            href={href}
            className="block rounded-xl border border-neutral-200 bg-white p-4 transition-all duration-200 hover:-translate-y-1 hover:border-yellow-400 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
            <p className="text-xs text-neutral-500">{label}</p>
            <p className="mt-3 text-2xl font-bold text-neutral-900">
                {value}
            </p>
            <p className="mt-2 text-[10px] text-neutral-500">
                {description}
            </p>
            <div
                className="mt-3 h-1 w-10 rounded-full"
                style={{ backgroundColor: color }}
            />
        </a>
    );
}

function CategoryItem({
    label,
    amount,
    percentage,
}: {
    label: ExpenseCategory;
    amount: string;
    percentage: string;
}) {
    return (
        <div>
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-700">
                    {label}
                </p>
                <p className="text-xs font-semibold text-neutral-900">
                    {amount}
                </p>
            </div>

            <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-neutral-100">
                    <div
                        className="h-full rounded-full"
                        style={{
                            width: percentage,
                            backgroundColor: categoryColors[label],
                        }}
                    />
                </div>
                <span className="w-8 text-right text-[10px] text-neutral-500">
                    {percentage}
                </span>
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