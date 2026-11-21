<?php

namespace App\Http\Controllers\Bookkeeper;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ExpenseController extends Controller
{
    // Shows the Expenses page with all expenses from the database
    public function index()
    {
        return Inertia::render('bookkeeper/expenses', [
            'expenses' => Expense::orderByDesc('date')->orderByDesc('id')->get(),
        ]);
    }

    // Saves a new expense from the "Record expense" form
    public function store(Request $request)
    {
        $validated = $request->validate([
            'date'        => ['required', 'date'],
            'description' => ['required', 'string', 'max:255'],
            'project'     => ['required', 'string', 'max:255'],
            'category'    => ['required', 'in:Materials,Fabrication,Equipment rental,Labor,Transportation'],
            'receipt'     => ['boolean'],
            'amount'      => ['required', 'numeric', 'min:1'],
        ]);

        Expense::create($validated);

        return redirect()->route('bookkeeper.expenses.index');
    }
}