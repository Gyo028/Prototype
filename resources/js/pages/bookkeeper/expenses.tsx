
import { Head, useForm } from '@inertiajs/react';
import BookkeeperLayout from '@/layouts/bookkeeper-layout';
import { useMemo, useState, type FormEvent } from 'react';

type Category =
    | 'Materials'
    | 'Fabrication'
    | 'Equipment rental'
    | 'Labor'
    | 'Transportation';

type Expense = {
    id: number;
    date: string;
    description: string;
    project: string;
    category: Category;
    receipt: boolean;
    amount: number;
};

const projects = [
    { name: 'SM Mall Grand Opening', budget: 850000 },
    { name: 'Ayala Shopping Festival', budget: 650000 },
    { name: 'Robinsons Mega Mall Expo', budget: 550000 },
    { name: 'Quezon City Trade and Convention Fair', budget: 950000 },
];

const categories: Category[] = [
    'Materials',
    'Fabrication',
    'Equipment rental',
    'Labor',
    'Transportation',
];

const categoryColors: Record<Category, string> = {
    Materials: '#000000',
    Fabrication: '#EAB308',
    'Equipment rental': '#2563EB',
    Labor: '#16A34A',
    Transportation: '#DC2626',
};

const formatCurrency = (amount: number) =>
    '₱' + amount.toLocaleString('en-PH', {
        maximumFractionDigits: 0,
    });

const formatDate = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

export default function Expenses({ expenses = [] }: { expenses: Expense[] }) {
    const [period, setPeriod] = useState('All time');
    const [selectedProject, setSelectedProject] = useState('All projects');
    const [selectedCategory, setSelectedCategory] = useState('All categories');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);

    const {
        data: form,
        setData,
        post,
        processing,
        errors,
        reset,
    } = useForm({
        date: '2027-02-20',
        description: '',
        project: projects[0].name,
        category: 'Materials' as Category,
        amount: '',
        receipt: false,
    });

    const filteredExpenses = useMemo(() => {
        return expenses.filter((expense) => {
            const expenseMonth = expense.date.slice(0, 7);

            const matchesPeriod =
                period === 'All time' ||
                (period === 'February 2027' && expenseMonth === '2027-02') ||
                (period === 'January 2027' && expenseMonth === '2027-01');

            const matchesProject =
                selectedProject === 'All projects' ||
                expense.project === selectedProject;

            const matchesCategory =
                selectedCategory === 'All categories' ||
                expense.category === selectedCategory;

            const matchesSearch =
                expense.description.toLowerCase().includes(search.toLowerCase()) ||
                expense.project.toLowerCase().includes(search.toLowerCase());

            return (
                matchesPeriod &&
                matchesProject &&
                matchesCategory &&
                matchesSearch
            );
        });
    }, [expenses, period, selectedProject, selectedCategory, search]);

    const totalExpenses = filteredExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount),
        0
    );

    const missingReceipts = filteredExpenses.filter(
        (expense) => !expense.receipt
    ).length;

    const totalPages = Math.max(
        1,
        Math.ceil(filteredExpenses.length / 10)
    );

    const displayedExpenses = filteredExpenses.slice(
        (page - 1) * 10,
        page * 10
    );

    const categoryTotals = categories.map((category) => ({
        name: category,
        amount: filteredExpenses
            .filter((expense) => expense.category === category)
            .reduce((sum, expense) => sum + Number(expense.amount), 0),
    }));

    const highestCategory = [...categoryTotals].sort(
        (a, b) => b.amount - a.amount
    )[0];

    const highestAmount = Math.max(
        ...categoryTotals.map((item) => item.amount),
        1
    );

    const months = ['January', 'February'];

    const monthlyTotals = months.map((month) => {
        const monthExpenses = filteredExpenses.filter(
            (expense) =>
                new Date(`${expense.date}T00:00:00`).toLocaleString(
                    'en-US',
                    { month: 'long' }
                ) === month
        );

        return {
            month,
            categories: categories.map((category) => ({
                name: category,
                amount: monthExpenses
                    .filter((expense) => expense.category === category)
                    .reduce(
                        (sum, expense) => sum + Number(expense.amount),
                        0
                    ),
            })),
            total: monthExpenses.reduce(
                (sum, expense) => sum + Number(expense.amount),
                0
            ),
        };
    });

    const projectTotals = projects.map((project) => {
        const amount = filteredExpenses
            .filter((expense) => expense.project === project.name)
            .reduce((sum, expense) => sum + Number(expense.amount), 0);

        return {
            ...project,
            amount,
            percentage:
                project.budget > 0
                    ? Math.min((amount / project.budget) * 100, 100)
                    : 0,
        };
    });

    const handleAddExpense = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        post('/bookkeeper/expenses', {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                setShowForm(false);
                setPage(1);
            },
        });
    };

    const handleExport = () => {
        const headers = [
            'Date',
            'Description',
            'Project',
            'Category',
            'Receipt',
            'Amount',
        ];

        const rows = filteredExpenses.map((expense) => [
            expense.date,
            expense.description,
            expense.project,
            expense.category,
            expense.receipt ? 'Attached' : 'Missing',
            expense.amount,
        ]);

        const csv = [headers, ...rows]
            .map((row) =>
                row
                    .map(
                        (value) =>
                            `"${String(value).replace(/"/g, '""')}"`
                    )
                    .join(',')
            )
            .join('\n');

        const blob = new Blob([csv], {
            type: 'text/csv;charset=utf-8;',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = 'expenses-2027.csv';
        link.click();

        URL.revokeObjectURL(url);
    };

    const resetPage = () => setPage(1);

    return (
        <BookkeeperLayout>
            <Head title="Expenses" />

            <div className="min-h-screen bg-[#f8f8fa] px-4 py-5 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-[1500px] space-y-4">

                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <h1 className="text-xl font-bold text-[#25232a]">
                                Expenses
                            </h1>
                            <p className="text-xs text-gray-500">
                                Record and monitor project expenses by amount, category and description.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleExport}
                                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                            >
                                ↓ Export
                            </button>

                            <button
                                type="button"
                                onClick={() => setShowForm(true)}
                                className="rounded-md bg-black px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-gray-800"
                            >
                                + Record expense
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <label className="text-gray-500">Period</label>

                        <select
                            value={period}
                            onChange={(e) => {
                                setPeriod(e.target.value);
                                resetPage();
                            }}
                            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-black"
                        >
                            <option>All time</option>
                            <option>February 2027</option>
                            <option>January 2027</option>
                        </select>

                        <label className="text-gray-500">Project</label>

                        <select
                            value={selectedProject}
                            onChange={(e) => {
                                setSelectedProject(e.target.value);
                                resetPage();
                            }}
                            className="min-w-40 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-black"
                        >
                            <option>All projects</option>
                            {projects.map((project) => (
                                <option key={project.name}>
                                    {project.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                            <p className="text-[11px] text-gray-500">
                                Total expenses
                            </p>
                            <h2 className="mt-1 text-xl font-bold text-gray-900">
                                {formatCurrency(totalExpenses)}
                            </h2>
                            <p className="mt-1 text-[10px] text-gray-400">
                                {period} · {selectedProject}
                            </p>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                            <p className="text-[11px] text-gray-500">
                                Entries recorded
                            </p>
                            <h2 className="mt-1 text-xl font-bold text-gray-900">
                                {filteredExpenses.length}
                            </h2>
                            <p className="mt-1 text-[10px] text-gray-400">
                                {projects.length} projects
                            </p>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                            <p className="text-[11px] text-gray-500">
                                Top category
                            </p>
                            <h2 className="mt-1 text-xl font-bold text-gray-900">
                                {highestCategory?.amount
                                    ? highestCategory.name
                                    : 'No entries'}
                            </h2>
                            <p className="mt-1 text-[10px] text-gray-400">
                                {highestCategory?.amount
                                    ? formatCurrency(highestCategory.amount)
                                    : '₱0'}{' '}
                                ·{' '}
                                {totalExpenses > 0
                                    ? Math.round(
                                          (highestCategory.amount /
                                              totalExpenses) *
                                              100
                                      )
                                    : 0}
                                % of total
                            </p>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                            <p className="text-[11px] text-gray-500">
                                Missing receipts
                            </p>
                            <h2 className="mt-1 text-xl font-bold text-gray-900">
                                {missingReceipts}
                            </h2>
                            <p className="mt-1 text-[10px] text-gray-400">
                                Entries without a receipt attached
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
                        <section className="rounded-lg border border-gray-200 bg-white p-4">
                            <h3 className="text-sm font-bold text-gray-900">
                                Monthly expenses by category
                            </h3>
                            <p className="text-[10px] text-gray-400">
                                {period} · {selectedProject}
                            </p>

                            <div className="mt-4 flex h-44 items-end justify-around border-b border-gray-200 px-3">
                                {monthlyTotals.map((month) => (
                                    <div
                                        key={month.month}
                                        className="flex h-full w-20 flex-col items-center justify-end"
                                    >
                                        <span className="mb-1 text-[9px] font-semibold text-gray-700">
                                            {month.total
                                                ? `₱${(month.total / 1000).toFixed(1)}k`
                                                : '₱0'}
                                        </span>

                                        <div className="flex w-9 flex-col-reverse overflow-hidden rounded-t-sm">
                                            {month.categories.map((category) => (
                                                <div
                                                    key={category.name}
                                                    style={{
                                                        height: `${(category.amount / 160000) * 145}px`,
                                                        backgroundColor:
                                                            categoryColors[
                                                                category.name
                                                            ],
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        <span className="mt-2 text-[10px] text-gray-500">
                                            {month.month}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
                                {categories.map((category) => (
                                    <div
                                        key={category}
                                        className="flex items-center gap-1"
                                    >
                                        <span
                                            className="h-2 w-2 rounded-sm"
                                            style={{
                                                backgroundColor:
                                                    categoryColors[category],
                                            }}
                                        />
                                        <span className="text-[9px] text-gray-500">
                                            {category}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-lg border border-gray-200 bg-white p-4">
                            <h3 className="text-sm font-bold text-gray-900">
                                By category
                            </h3>
                            <p className="text-[10px] text-gray-400">
                                {period} · {selectedProject}
                            </p>

                            <div className="mt-4 space-y-3">
                                {categoryTotals.map((category) => (
                                    <div key={category.name}>
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="h-2 w-2 rounded-sm"
                                                    style={{
                                                        backgroundColor:
                                                            categoryColors[
                                                                category.name
                                                            ],
                                                    }}
                                                />
                                                <span className="text-[10px] text-gray-700">
                                                    {category.name}
                                                </span>
                                            </div>

                                            <span className="text-[10px] font-semibold text-gray-800">
                                                {formatCurrency(category.amount)}{' '}
                                                ·{' '}
                                                {totalExpenses
                                                    ? Math.round(
                                                          (category.amount /
                                                              totalExpenses) *
                                                              100
                                                      )
                                                    : 0}
                                                %
                                            </span>
                                        </div>

                                        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${(category.amount / highestAmount) * 100}%`,
                                                    backgroundColor:
                                                        categoryColors[
                                                            category.name
                                                        ],
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <section className="rounded-lg border border-gray-200 bg-white p-4">
                        <h3 className="text-sm font-bold text-gray-900">
                            Expenses per project
                        </h3>
                        <p className="text-[10px] text-gray-400">
                            Total expenses as a share of each project's billed amount ({period.toLowerCase()})
                        </p>

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                            {projectTotals.map((project) => (
                                <div
                                    key={project.name}
                                    className="rounded-lg border border-gray-200 p-3"
                                >
                                    <p className="text-[10px] font-medium text-gray-700">
                                        {project.name}
                                    </p>

                                    <h4 className="mt-1 text-base font-bold text-gray-900">
                                        {formatCurrency(project.amount)}
                                    </h4>

                                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-gray-100">
                                        <div
                                            className="h-full rounded-full bg-black"
                                            style={{
                                                width: `${project.percentage}%`,
                                            }}
                                        />
                                    </div>

                                    <p className="mt-1 text-[9px] text-gray-400">
                                        {Math.round(project.percentage)}% of{' '}
                                        {formatCurrency(project.budget)} billed
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                        <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">
                                    All expenses
                                </h3>
                                <p className="text-[10px] text-gray-400">
                                    {filteredExpenses.length} entries · {period} · {selectedProject}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        resetPage();
                                    }}
                                    placeholder="⌕ Search description or project..."
                                    className="rounded-md border border-gray-200 px-3 py-2 text-[10px] outline-none focus:border-black"
                                />

                                <select
                                    value={selectedCategory}
                                    onChange={(e) => {
                                        setSelectedCategory(e.target.value);
                                        resetPage();
                                    }}
                                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-[10px] outline-none focus:border-black"
                                >
                                    <option>All categories</option>
                                    {categories.map((category) => (
                                        <option key={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[850px] text-left">
                                <thead className="border-y border-gray-100 bg-gray-50">
                                    <tr className="text-[10px] text-gray-500">
                                        <th className="px-4 py-3 font-medium">Date ↓</th>
                                        <th className="px-4 py-3 font-medium">Description</th>
                                        <th className="px-4 py-3 font-medium">Project</th>
                                        <th className="px-4 py-3 font-medium">Category</th>
                                        <th className="px-4 py-3 text-center font-medium">Receipt</th>
                                        <th className="px-4 py-3 text-right font-medium">Amount ↑</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {displayedExpenses.map((expense) => (
                                        <tr
                                            key={expense.id}
                                            className="text-[10px] hover:bg-gray-50"
                                        >
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                                                {formatDate(expense.date)}
                                            </td>

                                            <td className="px-4 py-3 font-medium text-gray-800">
                                                {expense.description}
                                            </td>

                                            <td className="px-4 py-3 text-gray-600">
                                                {expense.project}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2 py-1 text-[9px] text-gray-700">
                                                    <span
                                                        className="h-1.5 w-1.5 rounded-full"
                                                        style={{
                                                            backgroundColor:
                                                                categoryColors[
                                                                    expense.category
                                                                ],
                                                        }}
                                                    />
                                                    {expense.category}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                {expense.receipt ? (
                                                    <span className="text-black underline">
                                                        View
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">
                                                        —
                                                    </span>
                                                )}
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-gray-900">
                                                {formatCurrency(Number(expense.amount))}
                                            </td>
                                        </tr>
                                    ))}

                                    {displayedExpenses.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={6}
                                                className="px-4 py-10 text-center text-xs text-gray-400"
                                            >
                                                No expenses found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center">
                            <p className="text-[10px] font-semibold text-gray-600">
                                Total ({filteredExpenses.length} entries)
                                <span className="ml-2 text-gray-900">
                                    {formatCurrency(totalExpenses)}
                                </span>
                            </p>

                            <div className="flex items-center gap-2">
                                <span className="mr-2 text-[9px] text-gray-400">
                                    Page {page} of {totalPages}
                                </span>

                                <button
                                    type="button"
                                    disabled={page === 1}
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.max(1, current - 1)
                                        )
                                    }
                                    className="rounded-md border border-gray-200 px-3 py-1.5 text-[10px] text-gray-600 disabled:opacity-40"
                                >
                                    Previous
                                </button>

                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.min(totalPages, current + 1)
                                        )
                                    }
                                    className="rounded-md border border-gray-200 px-3 py-1.5 text-[10px] text-gray-600 disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    Record expense
                                </h2>
                                <p className="text-xs text-gray-500">
                                    Add a new project expense for 2027.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="text-xl text-gray-400 hover:text-gray-700"
                            >
                                ×
                            </button>
                        </div>

                        <form
                            onSubmit={handleAddExpense}
                            className="space-y-3"
                        >
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Description
                                </label>

                                <input
                                    required
                                    value={form.description}
                                    onChange={(e) =>
                                        setData('description', e.target.value)
                                    }
                                    placeholder="Enter expense description"
                                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-black"
                                />

                                {errors.description && (
                                    <p className="mt-1 text-[10px] text-red-500">
                                        {errors.description}
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">
                                        Date
                                    </label>

                                    <input
                                        required
                                        type="date"
                                        min="2027-01-01"
                                        max="2027-12-31"
                                        value={form.date}
                                        onChange={(e) =>
                                            setData('date', e.target.value)
                                        }
                                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-black"
                                    />

                                    {errors.date && (
                                        <p className="mt-1 text-[10px] text-red-500">
                                            {errors.date}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-medium text-gray-600">
                                        Amount (₱)
                                    </label>

                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        step="0.01"
                                        value={form.amount}
                                        onChange={(e) =>
                                            setData('amount', e.target.value)
                                        }
                                        placeholder="0.00"
                                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-black"
                                    />

                                    {errors.amount && (
                                        <p className="mt-1 text-[10px] text-red-500">
                                            {errors.amount}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Project / Event
                                </label>

                                <select
                                    value={form.project}
                                    onChange={(e) =>
                                        setData('project', e.target.value)
                                    }
                                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                                >
                                    {projects.map((project) => (
                                        <option key={project.name}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Category
                                </label>

                                <select
                                    value={form.category}
                                    onChange={(e) =>
                                        setData(
                                            'category',
                                            e.target.value as Category
                                        )
                                    }
                                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                                >
                                    {categories.map((category) => (
                                        <option key={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <label className="flex items-center gap-2 text-xs text-gray-600">
                                <input
                                    type="checkbox"
                                    checked={form.receipt}
                                    onChange={(e) =>
                                        setData('receipt', e.target.checked)
                                    }
                                    className="accent-black"
                                />
                                Receipt attached
                            </label>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="rounded-md border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="rounded-md bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {processing
                                        ? 'Saving...'
                                        : 'Save expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </BookkeeperLayout>
    );
}
