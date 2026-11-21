<?php

namespace App\Http\Controllers\Bookkeeper;

use App\Http\Controllers\Controller;
use App\Models\ProjectExpense;
use Inertia\Inertia;

class FinancialReportController extends Controller
{
    public function index()
    {
        // Archived expenses are left out of reports.
        $transactions = ProjectExpense::active()
            ->with('project.serviceRequest.eventType')
            ->orderBy('expense_date')
            ->get()
            ->map(fn (ProjectExpense $expense) => [
                'date' => $expense->expense_date->toDateString(),
                'description' => $expense->description,
                'project' => ExpenseController::projectLabel($expense->project),
                'category' => $expense->expense_type->label(),
                'amount' => (float) $expense->amount,
                'type' => 'expense',
            ]);

        return Inertia::render('bookkeeper/financial_reports', [
            'transactions' => $transactions,
        ]);
    }
}
