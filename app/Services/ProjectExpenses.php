<?php

namespace App\Services;

use App\Enums\ExpenseType;
use App\Models\Project;
use App\Models\ProjectExpense;
use App\Models\ProjectExpenseHistory;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Records, edits, archives and restores project expenses.
 * Every change is written to project_expense_histories in the same
 * transaction, so the trail can't miss a change.
 */
class ProjectExpenses
{
    /** Fields the Bookkeeper can edit, with the names shown in the history. */
    public const EDITABLE = [
        'project_id' => 'Project',
        'expense_type' => 'Category',
        'amount' => 'Amount',
        'expense_date' => 'Date',
        'description' => 'Description',
    ];

    public function today(): Carbon
    {
        return Carbon::now(ConsultationScheduler::TIMEZONE)->startOfDay();
    }

    /**
     * @param  array{project_id: int|string, expense_type: string, amount: numeric-string|float, expense_date: string, description: string}  $data
     */
    public function record(array $data, ?UploadedFile $receipt, User $user): ProjectExpense
    {
        $now = $this->now();

        $expense = DB::transaction(function () use ($data, $user, $now) {
            $expense = ProjectExpense::create([
                ...$this->only($data),
                'recorded_by' => $user->id,
                'recorded_at' => $now,
            ]);

            $this->log($expense, ProjectExpenseHistory::ACTION_CREATED, null, $user, $now);

            return $expense;
        });

        if ($receipt) {
            $this->attachReceipt($expense, $receipt, $user);
        }

        return $expense;
    }

    /**
     * Saves the edited fields and logs only the ones that really changed.
     *
     * @param  array{project_id: int|string, expense_type: string, amount: numeric-string|float, expense_date: string, description: string}  $data
     */
    public function update(ProjectExpense $expense, array $data, ?UploadedFile $receipt, User $user): ProjectExpense
    {
        $now = $this->now();
        $before = $this->snapshot($expense);

        DB::transaction(function () use ($expense, $data, $before, $user, $now) {
            $expense->fill($this->only($data));
            $after = $this->snapshot($expense);

            $changes = [];
            foreach ($after as $field => $value) {
                if ($before[$field] !== $value) {
                    $changes[$field] = ['old' => $before[$field], 'new' => $value];
                }
            }

            if ($changes) {
                $expense->save();
                $this->log($expense, ProjectExpenseHistory::ACTION_UPDATED, $changes, $user, $now);
            }
        });

        if ($receipt) {
            $this->attachReceipt($expense, $receipt, $user);
        }

        return $expense;
    }

    /** Attaches the receipt, or replaces the current one (the old file is kept in storage as proof). */
    public function attachReceipt(ProjectExpense $expense, UploadedFile $file, User $user): void
    {
        $folder = sprintf('expenses/projects/%d/%d', $expense->project_id, $expense->expense_id);
        $path = $file->store($folder);
        $name = mb_substr($file->getClientOriginalName(), 0, 150);
        $oldName = $expense->receipt_file_name;

        try {
            DB::transaction(function () use ($expense, $path, $name, $oldName, $user) {
                $expense->update(['receipt_file_name' => $name, 'receipt_file_path' => $path]);

                $this->log(
                    $expense,
                    $oldName === null ? ProjectExpenseHistory::ACTION_RECEIPT_ATTACHED : ProjectExpenseHistory::ACTION_RECEIPT_REPLACED,
                    ['receipt' => ['old' => $oldName, 'new' => $name]],
                    $user,
                    $this->now(),
                );
            });
        } catch (\Throwable $e) {
            Storage::delete($path); // don't leave a file nobody points to

            throw $e;
        }
    }

    public function archive(ProjectExpense $expense, User $user): void
    {
        if ($expense->isArchived()) {
            return;
        }

        $now = $this->now();

        DB::transaction(function () use ($expense, $user, $now) {
            $expense->update(['archived_at' => $now]);
            $this->log($expense, ProjectExpenseHistory::ACTION_ARCHIVED, null, $user, $now);
        });
    }

    public function restore(ProjectExpense $expense, User $user): void
    {
        if (! $expense->isArchived()) {
            return;
        }

        $now = $this->now();

        DB::transaction(function () use ($expense, $user, $now) {
            $expense->update(['archived_at' => null]);
            $this->log($expense, ProjectExpenseHistory::ACTION_RESTORED, null, $user, $now);
        });
    }

    /**
     * The trail, newest first, with values readable as-is
     * (project codes instead of IDs, category labels, formatted amounts).
     *
     * @return list<array{action: string, label: string, by: string, at: string, changes: list<array{field: string, old: ?string, new: ?string}>}>
     */
    public function history(ProjectExpense $expense): array
    {
        $rows = $expense->histories()->with('changer')->orderByDesc('changed_at')->orderByDesc('history_id')->get();

        $projectIds = $rows->flatMap(fn ($h) => [$h->changes['project_id']['old'] ?? null, $h->changes['project_id']['new'] ?? null])->filter()->unique();
        $codes = Project::whereIn('project_id', $projectIds)->pluck('project_code', 'project_id');

        return $rows->map(fn (ProjectExpenseHistory $h) => [
            'action' => $h->action,
            'label' => $this->actionLabel($h->action),
            'by' => $h->changer?->name ?? 'Deleted user',
            'at' => $h->changed_at->format('Y-m-d H:i'),
            'changes' => collect($h->changes ?? [])->map(fn ($change, $field) => [
                'field' => self::EDITABLE[$field] ?? 'Receipt',
                'old' => $this->display($field, $change['old'], $codes),
                'new' => $this->display($field, $change['new'], $codes),
            ])->values()->all(),
        ])->all();
    }

    private function actionLabel(string $action): string
    {
        return match ($action) {
            ProjectExpenseHistory::ACTION_CREATED => 'Recorded',
            ProjectExpenseHistory::ACTION_UPDATED => 'Edited',
            ProjectExpenseHistory::ACTION_RECEIPT_ATTACHED => 'Receipt attached',
            ProjectExpenseHistory::ACTION_RECEIPT_REPLACED => 'Receipt replaced',
            ProjectExpenseHistory::ACTION_ARCHIVED => 'Archived',
            ProjectExpenseHistory::ACTION_RESTORED => 'Restored',
            default => ucfirst(str_replace('_', ' ', $action)),
        };
    }

    /** @param  \Illuminate\Support\Collection<int, string|null>  $codes */
    private function display(string $field, mixed $value, $codes): ?string
    {
        if ($value === null) {
            return null;
        }

        return match ($field) {
            'project_id' => $codes[$value] ?? "Project #{$value}",
            'expense_type' => ExpenseType::tryFrom((string) $value)?->label() ?? (string) $value,
            'amount' => '₱'.number_format((float) $value, 2),
            default => (string) $value,
        };
    }

    /** The editable fields as plain strings, so old and new values compare cleanly. @return array<string, string> */
    private function snapshot(ProjectExpense $expense): array
    {
        return [
            'project_id' => (string) $expense->project_id,
            'expense_type' => $expense->expense_type instanceof ExpenseType ? $expense->expense_type->value : (string) $expense->expense_type,
            'amount' => number_format((float) $expense->amount, 2, '.', ''),
            'expense_date' => $expense->expense_date?->toDateString() ?? '',
            'description' => (string) $expense->description,
        ];
    }

    /** @return array<string, mixed> */
    private function only(array $data): array
    {
        return array_intersect_key($data, self::EDITABLE);
    }

    private function log(ProjectExpense $expense, string $action, ?array $changes, User $user, Carbon $at): void
    {
        $expense->histories()->create([
            'action' => $action,
            'changes' => $changes,
            'changed_by' => $user->id,
            'changed_at' => $at,
        ]);
    }

    /** Manila wall time, like the schedules and payments. */
    private function now(): Carbon
    {
        return Carbon::now(ConsultationScheduler::TIMEZONE);
    }
}
