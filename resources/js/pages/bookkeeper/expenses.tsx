import { Head, router, useForm } from '@inertiajs/react';
import BookkeeperLayout from '@/layouts/bookkeeper-layout';
import { useMemo, useState, type FormEvent } from 'react';

type Category =
    | 'materials'
    | 'fabrication'
    | 'equipment_rental'
    | 'labor'
    | 'transportation';

type Option = { value: Category; label: string };

type Expense = {
    id: number;
    date: string;
    description: string;
    projectId: number;
    project: string;
    category: Category;
    categoryLabel: string;
    amount: number;
    receipt: { name: string; url: string } | null;
    archived: boolean;
    recordedBy: string | null;
};

type Project = {
    id: number;
    label: string;
    status: string | null;
    billed: number;
};

type HistoryEntry = {
    action: string;
    label: string;
    by: string;
    at: string;
    changes: { field: string; old: string | null; new: string | null }[];
};

type Props = {
    expenses: Expense[];
    projects: Project[];
    categories: Option[];
    today: string;
    receiptRules: { maxMb: number; types: string[] };
};

const categoryColors: Record<Category, string> = {
    materials: '#000000',
    fabrication: '#EAB308',
    equipment_rental: '#2563EB',
    labor: '#16A34A',
    transportation: '#DC2626',
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

// "2027-02" -> "February 2027"
const formatMonth = (month: string) =>
    new Date(`${month}-01T00:00:00`).toLocaleDateString('en-PH', {
        month: 'long',
        year: 'numeric',
    });

// "2027-02" -> "Feb"
const shortMonth = (month: string) =>
    new Date(`${month}-01T00:00:00`).toLocaleDateString('en-PH', {
        month: 'short',
    });

const PAGE_SIZE = 10;

export default function Expenses({
    expenses = [],
    projects = [],
    categories = [],
    today,
    receiptRules,
}: Props) {
    const [period, setPeriod] = useState('all');
    const [selectedProject, setSelectedProject] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showArchived, setShowArchived] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Expense | null>(null);

    const [historyFor, setHistoryFor] = useState<Expense | null>(null);
    const [history, setHistory] = useState<HistoryEntry[] | null>(null);
    const [historyError, setHistoryError] = useState(false);

    const emptyForm = {
        project_id: projects[0] ? String(projects[0].id) : '',
        expense_type: (categories[0]?.value ?? 'materials') as Category,
        amount: '',
        expense_date: today,
        description: '',
        receipt: null as File | null,
    };

    const {
        data: form,
        setData,
        post,
        processing,
        errors,
        reset,
        clearErrors,
    } = useForm(emptyForm);

    const projectLabel = (id: string) =>
        projects.find((p) => String(p.id) === id)?.label ?? 'Project';

    // Archived expenses don't count in totals, charts or exports.
    const activeExpenses = useMemo(
        () => expenses.filter((expense) => !expense.archived),
        [expenses],
    );

    const archivedCount = expenses.length - activeExpenses.length;

    // Months that have expenses, newest first, for the Period filter.
    const periodOptions = useMemo(
        () =>
            [...new Set(activeExpenses.map((e) => e.date.slice(0, 7)))]
                .sort()
                .reverse(),
        [activeExpenses],
    );

    const matchesFilters = (expense: Expense) => {
        const matchesPeriod =
            period === 'all' || expense.date.slice(0, 7) === period;

        const matchesProject =
            selectedProject === 'all' ||
            String(expense.projectId) === selectedProject;

        return matchesPeriod && matchesProject;
    };

    // Used by the cards and charts (active expenses only).
    const filteredExpenses = useMemo(
        () => activeExpenses.filter(matchesFilters),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeExpenses, period, selectedProject],
    );

    // Used by the table (can include archived ones).
    const tableExpenses = useMemo(() => {
        const term = search.toLowerCase();

        return (showArchived ? expenses.filter((e) => e.archived) : activeExpenses)
            .filter(matchesFilters)
            .filter(
                (expense) =>
                    selectedCategory === 'all' ||
                    expense.category === selectedCategory,
            )
            .filter(
                (expense) =>
                    expense.description.toLowerCase().includes(term) ||
                    expense.project.toLowerCase().includes(term),
            );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [expenses, activeExpenses, showArchived, period, selectedProject, selectedCategory, search]);

    const totalExpenses = filteredExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount),
        0,
    );

    const tableTotal = tableExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount),
        0,
    );

    const missingReceipts = filteredExpenses.filter(
        (expense) => !expense.receipt,
    ).length;

    const totalPages = Math.max(1, Math.ceil(tableExpenses.length / PAGE_SIZE));

    const displayedExpenses = tableExpenses.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE,
    );

    const categoryTotals = categories.map((category) => ({
        name: category.value,
        label: category.label,
        amount: filteredExpenses
            .filter((expense) => expense.category === category.value)
            .reduce((sum, expense) => sum + Number(expense.amount), 0),
    }));

    const highestCategory = [...categoryTotals].sort(
        (a, b) => b.amount - a.amount,
    )[0];

    const highestAmount = Math.max(
        ...categoryTotals.map((item) => item.amount),
        1,
    );

    // The last 6 months that have expenses, oldest first.
    const chartMonths = [
        ...new Set(filteredExpenses.map((e) => e.date.slice(0, 7))),
    ]
        .sort()
        .slice(-6);

    const monthlyTotals = chartMonths.map((month) => {
        const monthExpenses = filteredExpenses.filter(
            (expense) => expense.date.slice(0, 7) === month,
        );

        return {
            month,
            categories: categories.map((category) => ({
                name: category.value,
                amount: monthExpenses
                    .filter((expense) => expense.category === category.value)
                    .reduce((sum, expense) => sum + Number(expense.amount), 0),
            })),
            total: monthExpenses.reduce(
                (sum, expense) => sum + Number(expense.amount),
                0,
            ),
        };
    });

    const highestMonth = Math.max(...monthlyTotals.map((m) => m.total), 1);

    // Only projects that have expenses in the current filter.
    const projectTotals = projects
        .map((project) => {
            const amount = filteredExpenses
                .filter((expense) => expense.projectId === project.id)
                .reduce((sum, expense) => sum + Number(expense.amount), 0);

            return {
                ...project,
                amount,
                percentage:
                    project.billed > 0
                        ? Math.min((amount / project.billed) * 100, 100)
                        : 0,
            };
        })
        .filter((project) => project.amount > 0)
        .sort((a, b) => b.amount - a.amount);

    const periodLabel = period === 'all' ? 'All time' : formatMonth(period);
    const projectFilterLabel =
        selectedProject === 'all' ? 'All projects' : projectLabel(selectedProject);

    const openNewForm = () => {
        setEditing(null);
        clearErrors();
        setData({ ...emptyForm });
        setShowForm(true);
    };

    const openEditForm = (expense: Expense) => {
        setEditing(expense);
        clearErrors();
        setData({
            project_id: String(expense.projectId),
            expense_type: expense.category,
            amount: String(expense.amount),
            expense_date: expense.date,
            description: expense.description,
            receipt: null,
        });
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
        reset();
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        post(editing ? `/bookkeeper/expenses/${editing.id}` : '/bookkeeper/expenses', {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                closeForm();
                if (!editing) setPage(1);
            },
        });
    };

    const toggleArchive = (expense: Expense) => {
        const action = expense.archived ? 'restore' : 'archive';

        if (
            !expense.archived &&
            !window.confirm('Archive this expense? It will no longer count in totals and reports. You can restore it later.')
        ) {
            return;
        }

        router.patch(`/bookkeeper/expenses/${expense.id}/${action}`, {}, { preserveScroll: true });
    };

    const openHistory = async (expense: Expense) => {
        setHistoryFor(expense);
        setHistory(null);
        setHistoryError(false);

        try {
            const response = await fetch(`/project-expenses/${expense.id}/history`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });

            if (!response.ok) throw new Error(String(response.status));

            const body = await response.json();
            setHistory(body.history);
        } catch {
            setHistoryError(true);
        }
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
            expense.categoryLabel,
            expense.receipt ? 'Attached' : 'Missing',
            expense.amount,
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

        const blob = new Blob(['﻿' + csv], {
            type: 'text/csv;charset=utf-8;',
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        link.href = url;
        link.download = `expenses-${period === 'all' ? 'all-time' : period}.csv`;
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
                                onClick={openNewForm}
                                disabled={projects.length === 0}
                                title={projects.length === 0 ? 'No projects yet' : undefined}
                                className="rounded-md bg-black px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
                            <option value="all">All time</option>
                            {periodOptions.map((month) => (
                                <option key={month} value={month}>
                                    {formatMonth(month)}
                                </option>
                            ))}
                        </select>

                        <label className="text-gray-500">Project</label>

                        <select
                            value={selectedProject}
                            onChange={(e) => {
                                setSelectedProject(e.target.value);
                                resetPage();
                            }}
                            className="min-w-40 max-w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-black"
                        >
                            <option value="all">All projects</option>
                            {projects.map((project) => (
                                <option key={project.id} value={String(project.id)}>
                                    {project.label}
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
                                {periodLabel} · {projectFilterLabel}
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
                                {projectTotals.length} project{projectTotals.length === 1 ? '' : 's'}
                                {archivedCount > 0 && ` · ${archivedCount} archived`}
                            </p>
                        </div>

                        <div className="rounded-lg border border-gray-200 bg-white p-4">
                            <p className="text-[11px] text-gray-500">
                                Top category
                            </p>
                            <h2 className="mt-1 text-xl font-bold text-gray-900">
                                {highestCategory?.amount
                                    ? highestCategory.label
                                    : 'No entries'}
                            </h2>
                            <p className="mt-1 text-[10px] text-gray-400">
                                {highestCategory?.amount
                                    ? formatCurrency(highestCategory.amount)
                                    : '₱0'}{' '}
                                ·{' '}
                                {totalExpenses > 0 && highestCategory
                                    ? Math.round(
                                          (highestCategory.amount /
                                              totalExpenses) *
                                              100,
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
                                {periodLabel} · {projectFilterLabel}
                            </p>

                            {monthlyTotals.length === 0 ? (
                                <p className="mt-4 flex h-44 items-center justify-center text-xs text-gray-400">
                                    No expenses to chart yet.
                                </p>
                            ) : (
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
                                                            height: `${(category.amount / highestMonth) * 120}px`,
                                                            backgroundColor:
                                                                categoryColors[
                                                                    category.name
                                                                ],
                                                        }}
                                                    />
                                                ))}
                                            </div>

                                            <span className="mt-2 text-[10px] text-gray-500">
                                                {shortMonth(month.month)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2">
                                {categories.map((category) => (
                                    <div
                                        key={category.value}
                                        className="flex items-center gap-1"
                                    >
                                        <span
                                            className="h-2 w-2 rounded-sm"
                                            style={{
                                                backgroundColor:
                                                    categoryColors[category.value],
                                            }}
                                        />
                                        <span className="text-[9px] text-gray-500">
                                            {category.label}
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
                                {periodLabel} · {projectFilterLabel}
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
                                                    {category.label}
                                                </span>
                                            </div>

                                            <span className="text-[10px] font-semibold text-gray-800">
                                                {formatCurrency(category.amount)}{' '}
                                                ·{' '}
                                                {totalExpenses
                                                    ? Math.round(
                                                          (category.amount /
                                                              totalExpenses) *
                                                              100,
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
                            Total expenses as a share of each project's billed amount ({periodLabel.toLowerCase()})
                        </p>

                        {projectTotals.length === 0 ? (
                            <p className="mt-3 text-xs text-gray-400">
                                No project expenses yet.
                            </p>
                        ) : (
                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                {projectTotals.map((project) => (
                                    <div
                                        key={project.id}
                                        className="rounded-lg border border-gray-200 p-3"
                                    >
                                        <p className="text-[10px] font-medium text-gray-700">
                                            {project.label}
                                        </p>
                                        {project.status && (
                                            <p className="text-[9px] text-gray-400">
                                                {project.status}
                                            </p>
                                        )}

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
                                            {project.billed > 0
                                                ? `${Math.round(project.percentage)}% of ${formatCurrency(project.billed)} billed`
                                                : 'Nothing billed yet'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                        <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">
                                    {showArchived ? 'Archived expenses' : 'All expenses'}
                                </h3>
                                <p className="text-[10px] text-gray-400">
                                    {tableExpenses.length} entries · {periodLabel} · {projectFilterLabel}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                                    <option value="all">All categories</option>
                                    {categories.map((category) => (
                                        <option key={category.value} value={category.value}>
                                            {category.label}
                                        </option>
                                    ))}
                                </select>

                                <label className="flex items-center gap-1.5 text-[10px] text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={showArchived}
                                        onChange={(e) => {
                                            setShowArchived(e.target.checked);
                                            resetPage();
                                        }}
                                        className="accent-black"
                                    />
                                    Show archived ({archivedCount})
                                </label>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[950px] text-left">
                                <thead className="border-y border-gray-100 bg-gray-50">
                                    <tr className="text-[10px] text-gray-500">
                                        <th className="px-4 py-3 font-medium">Date ↓</th>
                                        <th className="px-4 py-3 font-medium">Description</th>
                                        <th className="px-4 py-3 font-medium">Project</th>
                                        <th className="px-4 py-3 font-medium">Category</th>
                                        <th className="px-4 py-3 text-center font-medium">Receipt</th>
                                        <th className="px-4 py-3 text-right font-medium">Amount</th>
                                        <th className="px-4 py-3 text-right font-medium">Actions</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100">
                                    {displayedExpenses.map((expense) => (
                                        <tr
                                            key={expense.id}
                                            className={`text-[10px] hover:bg-gray-50 ${expense.archived ? 'text-gray-400' : ''}`}
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
                                                    {expense.categoryLabel}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                {expense.receipt ? (
                                                    <a
                                                        href={expense.receipt.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        title={expense.receipt.name}
                                                        className="text-black underline"
                                                    >
                                                        View
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400">
                                                        —
                                                    </span>
                                                )}
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-gray-900">
                                                {formatCurrency(Number(expense.amount))}
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-3 text-right">
                                                <div className="inline-flex gap-2">
                                                    {!expense.archived && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditForm(expense)}
                                                            className="text-gray-700 underline hover:text-black"
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => openHistory(expense)}
                                                        className="text-gray-700 underline hover:text-black"
                                                    >
                                                        History
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleArchive(expense)}
                                                        className="text-gray-700 underline hover:text-black"
                                                    >
                                                        {expense.archived ? 'Restore' : 'Archive'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {displayedExpenses.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={7}
                                                className="px-4 py-10 text-center text-xs text-gray-400"
                                            >
                                                {showArchived ? 'No archived expenses.' : 'No expenses found.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-col justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center">
                            <p className="text-[10px] font-semibold text-gray-600">
                                Total ({tableExpenses.length} entries)
                                <span className="ml-2 text-gray-900">
                                    {formatCurrency(tableTotal)}
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
                                            Math.max(1, current - 1),
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
                                            Math.min(totalPages, current + 1),
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
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {editing ? 'Edit expense' : 'Record expense'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {editing
                                        ? 'Changes are saved to this expense\'s history.'
                                        : 'Add an expense to any project, at any step.'}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeForm}
                                className="text-xl text-gray-400 hover:text-gray-700"
                            >
                                ×
                            </button>
                        </div>

                        <form
                            onSubmit={handleSubmit}
                            className="space-y-3"
                        >
                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Description
                                </label>

                                <input
                                    required
                                    maxLength={255}
                                    value={form.description}
                                    onChange={(e) =>
                                        setData('description', e.target.value)
                                    }
                                    placeholder="e.g. Van rental for the ocular visit"
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
                                        max={today}
                                        value={form.expense_date}
                                        onChange={(e) =>
                                            setData('expense_date', e.target.value)
                                        }
                                        className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-black"
                                    />

                                    {errors.expense_date && (
                                        <p className="mt-1 text-[10px] text-red-500">
                                            {errors.expense_date}
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
                                    Project
                                </label>

                                <select
                                    required
                                    value={form.project_id}
                                    onChange={(e) =>
                                        setData('project_id', e.target.value)
                                    }
                                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                                >
                                    {projects.map((project) => (
                                        <option key={project.id} value={String(project.id)}>
                                            {project.label}
                                            {project.status ? ` (${project.status})` : ''}
                                        </option>
                                    ))}
                                </select>

                                {errors.project_id && (
                                    <p className="mt-1 text-[10px] text-red-500">
                                        {errors.project_id}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Category
                                </label>

                                <select
                                    value={form.expense_type}
                                    onChange={(e) =>
                                        setData(
                                            'expense_type',
                                            e.target.value as Category,
                                        )
                                    }
                                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-black"
                                >
                                    {categories.map((category) => (
                                        <option key={category.value} value={category.value}>
                                            {category.label}
                                        </option>
                                    ))}
                                </select>

                                {errors.expense_type && (
                                    <p className="mt-1 text-[10px] text-red-500">
                                        {errors.expense_type}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-medium text-gray-600">
                                    Receipt (optional)
                                </label>

                                {editing?.receipt && (
                                    <p className="mb-1 text-[10px] text-gray-500">
                                        Current:{' '}
                                        <a
                                            href={editing.receipt.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="underline"
                                        >
                                            {editing.receipt.name}
                                        </a>
                                        . Choosing a new file replaces it.
                                    </p>
                                )}

                                <input
                                    type="file"
                                    accept={receiptRules.types.map((t) => `.${t}`).join(',')}
                                    onChange={(e) =>
                                        setData('receipt', e.target.files?.[0] ?? null)
                                    }
                                    className="w-full text-xs text-gray-600 file:mr-3 file:rounded-md file:border file:border-gray-200 file:bg-white file:px-3 file:py-1.5 file:text-xs"
                                />

                                <p className="mt-1 text-[10px] text-gray-400">
                                    PDF, JPG or PNG, up to {receiptRules.maxMb} MB. You can attach it later.
                                </p>

                                {errors.receipt && (
                                    <p className="mt-1 text-[10px] text-red-500">
                                        {errors.receipt}
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-3">
                                <button
                                    type="button"
                                    onClick={closeForm}
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
                                        : editing
                                          ? 'Save changes'
                                          : 'Save expense'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {historyFor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    Expense history
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {historyFor.description} · {historyFor.project}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setHistoryFor(null)}
                                className="text-xl text-gray-400 hover:text-gray-700"
                            >
                                ×
                            </button>
                        </div>

                        {historyError && (
                            <p className="text-xs text-red-500">
                                Couldn't load the history. Please try again.
                            </p>
                        )}

                        {!historyError && history === null && (
                            <p className="text-xs text-gray-400">Loading...</p>
                        )}

                        {history && history.length === 0 && (
                            <p className="text-xs text-gray-400">No history yet.</p>
                        )}

                        {history && history.length > 0 && (
                            <ol className="space-y-3">
                                {history.map((entry, index) => (
                                    <li
                                        key={index}
                                        className="rounded-lg border border-gray-200 p-3"
                                    >
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <p className="text-xs font-semibold text-gray-900">
                                                {entry.label}
                                            </p>
                                            <p className="text-[10px] text-gray-400">
                                                {entry.by} · {entry.at}
                                            </p>
                                        </div>

                                        {entry.changes.length > 0 && (
                                            <ul className="mt-2 space-y-1">
                                                {entry.changes.map((change, i) => (
                                                    <li key={i} className="text-[10px] text-gray-600">
                                                        <span className="font-medium text-gray-800">
                                                            {change.field}:
                                                        </span>{' '}
                                                        <span className="line-through">
                                                            {change.old ?? '—'}
                                                        </span>{' '}
                                                        → {change.new ?? '—'}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            )}
        </BookkeeperLayout>
    );
}
