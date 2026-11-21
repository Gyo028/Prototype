<?php

namespace App\Http\Requests\Bookkeeper;

use App\Enums\ExpenseType;
use App\Services\ProjectExpenses;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Recording or editing a project expense. The receipt is optional;
 * when sent while editing, it replaces the current one.
 */
class ExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        // The route is limited to the Bookkeeper.
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $today = app(ProjectExpenses::class)->today()->toDateString();
        $maxKb = (int) config('expenses.receipt.max_mb', 5) * 1024;

        return [
            'project_id' => ['required', 'integer', Rule::exists('projects', 'project_id')],
            'expense_type' => ['required', Rule::enum(ExpenseType::class)],
            'amount' => ['required', 'numeric', 'min:1', 'max:99999999.99'],
            'expense_date' => ['required', 'date_format:Y-m-d', 'before_or_equal:'.$today],
            'description' => ['required', 'string', 'max:255'],
            'receipt' => ['nullable', 'file', 'mimes:'.implode(',', config('expenses.receipt.mimes', ['pdf', 'jpg', 'jpeg', 'png'])), 'max:'.$maxKb],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'project_id.required' => 'Choose the project this expense is for.',
            'project_id.exists' => 'That project no longer exists.',
            'expense_date.before_or_equal' => 'The date can\'t be in the future.',
            'receipt.max' => 'The receipt must be '.config('expenses.receipt.max_mb', 5).' MB or smaller.',
            'receipt.mimes' => 'The receipt must be a PDF, JPG or PNG file.',
        ];
    }
}
