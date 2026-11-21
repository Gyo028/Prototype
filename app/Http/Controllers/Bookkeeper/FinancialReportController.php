<?php

namespace App\Http\Controllers\Bookkeeper;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Inertia\Inertia;

class FinancialReportController extends Controller
{
    public function index()
    {
        $transactions = Expense::orderBy('date')->get()->map(fn ($expense) => [
            'date'        => $expense->date->format('Y-m-d'),
            'description' => $expense->description,
            'project'     => $expense->project,
            'category'    => $expense->category,
            'amount'      => (float) $expense->amount,
            'type'        => 'expense',
        ]);

        return Inertia::render('bookkeeper/financial_reports', [
            'transactions' => $transactions,
        ]);
    }
}