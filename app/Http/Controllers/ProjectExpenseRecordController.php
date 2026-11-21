<?php

namespace App\Http\Controllers;

use App\Models\ProjectExpense;
use App\Services\ProjectExpenses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Read-only access to an expense's receipt and change trail, shared by the
 * Bookkeeper, the Owner and the Project Manager (route-limited to those roles),
 * so their own pages can show them too.
 */
class ProjectExpenseRecordController extends Controller
{
    public function __construct(private ProjectExpenses $expenses) {}

    /** Who changed what and when, newest first. */
    public function history(ProjectExpense $expense): JsonResponse
    {
        return response()->json([
            'expenseId' => $expense->expense_id,
            'history' => $this->expenses->history($expense),
        ]);
    }

    /** Opens the receipt in the browser, or downloads it with ?download=1. */
    public function receipt(Request $request, ProjectExpense $expense): StreamedResponse
    {
        $path = $expense->receipt_file_path;
        abort_unless($path && Storage::exists($path), 404);

        $name = $expense->receipt_file_name ?: basename($path);

        return $request->boolean('download') ? Storage::download($path, $name) : Storage::response($path, $name);
    }
}
