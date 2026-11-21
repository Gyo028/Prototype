<?php

namespace App\Models;

use App\Enums\ExpenseType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * An expense recorded by the Bookkeeper for a project.
 * Changes go through App\Services\ProjectExpenses so every one is logged.
 *
 * @property int $expense_id
 * @property int $project_id
 * @property ExpenseType $expense_type
 * @property string $amount decimal, e.g. "1500.00"
 * @property \Illuminate\Support\Carbon $expense_date
 * @property string $description
 * @property string|null $receipt_file_name
 * @property string|null $receipt_file_path
 * @property int|null $recorded_by
 * @property \Illuminate\Support\Carbon $recorded_at
 * @property \Illuminate\Support\Carbon|null $archived_at
 */
class ProjectExpense extends Model
{
    protected $primaryKey = 'expense_id';

    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'expense_type',
        'amount',
        'expense_date',
        'description',
        'receipt_file_name',
        'receipt_file_path',
        'recorded_by',
        'recorded_at',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'expense_type' => ExpenseType::class,
            'amount' => 'decimal:2',
            'expense_date' => 'date:Y-m-d',
            'recorded_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    /** Expenses that count in totals and reports. */
    public function scopeActive(Builder $query): Builder
    {
        return $query->whereNull('archived_at');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id', 'project_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function histories(): HasMany
    {
        return $this->hasMany(ProjectExpenseHistory::class, 'expense_id', 'expense_id');
    }
}
