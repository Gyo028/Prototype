<?php

namespace App\Http\Controllers\Bookkeeper;

use App\Enums\ExpenseType;
use App\Http\Controllers\Controller;
use App\Http\Controllers\Customer\ProjectController;
use App\Http\Requests\Bookkeeper\ExpenseRequest;
use App\Models\Project;
use App\Models\ProjectExpense;
use App\Services\ProjectExpenses;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Bookkeeper > Expenses: record, edit, archive and restore project expenses.
 * Expenses can be logged on a project at any step (e.g. transportation for
 * the ocular visit). Every change is logged by ProjectExpenses.
 */
class ExpenseController extends Controller
{
    public function __construct(private ProjectExpenses $expenses) {}

    public function index(): Response
    {
        $expenses = ProjectExpense::with(['project.serviceRequest.eventType', 'recorder'])
            ->orderByDesc('expense_date')
            ->orderByDesc('expense_id')
            ->get()
            ->map(fn (ProjectExpense $e) => [
                'id' => $e->expense_id,
                'date' => $e->expense_date->toDateString(),
                'description' => $e->description,
                'projectId' => $e->project_id,
                'project' => self::projectLabel($e->project),
                'category' => $e->expense_type->value,
                'categoryLabel' => $e->expense_type->label(),
                'amount' => (float) $e->amount,
                'receipt' => $e->receipt_file_path
                    ? ['name' => $e->receipt_file_name, 'url' => route('project-expenses.receipt', $e->expense_id)]
                    : null,
                'archived' => $e->isArchived(),
                'recordedBy' => $e->recorder?->name,
            ]);

        // Every project can have expenses, whatever step it is at.
        $projects = Project::with(['serviceRequest.eventType', 'status'])
            ->withSum('billings', 'amount')
            ->orderByDesc('project_id')
            ->get()
            ->map(fn (Project $p) => [
                'id' => $p->project_id,
                'label' => self::projectLabel($p),
                'status' => $p->status?->status_name,
                'billed' => (float) ($p->billings_sum_amount ?? 0),
            ]);

        return Inertia::render('bookkeeper/expenses', [
            'expenses' => $expenses,
            'projects' => $projects,
            'categories' => ExpenseType::options(),
            'today' => $this->expenses->today()->toDateString(),
            'receiptRules' => [
                'maxMb' => (int) config('expenses.receipt.max_mb', 5),
                'types' => config('expenses.receipt.mimes'),
            ],
        ]);
    }

    public function store(ExpenseRequest $request): RedirectResponse
    {
        $this->expenses->record($request->validated(), $request->file('receipt'), $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Expense recorded.']);

        return to_route('bookkeeper.expenses.index');
    }

    public function update(ExpenseRequest $request, ProjectExpense $expense): RedirectResponse
    {
        abort_if($expense->isArchived(), 422, 'Restore the expense before editing it.');

        $this->expenses->update($expense, $request->validated(), $request->file('receipt'), $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Expense updated.']);

        return to_route('bookkeeper.expenses.index');
    }

    public function archive(Request $request, ProjectExpense $expense): RedirectResponse
    {
        $this->expenses->archive($expense, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Expense archived. It no longer counts in totals.']);

        return back();
    }

    public function restore(Request $request, ProjectExpense $expense): RedirectResponse
    {
        $this->expenses->restore($expense, $request->user());

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Expense restored.']);

        return back();
    }

    /** "PRJ-26-0001 · Wedding" */
    public static function projectLabel(?Project $project): string
    {
        if (! $project) {
            return 'Unknown project';
        }

        $title = $project->serviceRequest ? ProjectController::titleOf($project->serviceRequest) : 'Project';

        return trim(($project->project_code ?? "#{$project->project_id}").' · '.$title);
    }
}
