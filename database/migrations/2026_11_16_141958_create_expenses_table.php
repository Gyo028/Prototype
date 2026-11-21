<?php

namespace App\Http\Controllers\Bookkeeper;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Inertia\Inertia;

class FinancialReportController extends Controller
{
    public function index()
    {
        return Inertia::render('bookkeeper/financial_report', [
            'totalExpenses' => (float) Expense::sum('amount'),
            'entryCount'    => Expense::count(),
            'missingReceipts' => Expense::where('receipt', false)->count(),

            'byCategory' => Expense::selectRaw('category, SUM(amount) as total')
                ->groupBy('category')
                ->orderByDesc('total')
                ->get(),

            'byProject' => Expense::selectRaw('project, SUM(amount) as total')
                ->groupBy('project')
                ->orderByDesc('total')
                ->get(),

            'byMonth' => Expense::selectRaw("DATE_FORMAT(date, '%Y-%m') as month, SUM(amount) as total")
                ->groupBy('month')
                ->orderBy('month')
                ->get(),
        ]);
    }
}