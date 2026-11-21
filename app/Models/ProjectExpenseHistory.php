<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One entry in an expense's change trail. Only ever added, never changed.
 *
 * @property int $history_id
 * @property int $expense_id
 * @property string $action see ACTIONS
 * @property array<string, array{old: mixed, new: mixed}>|null $changes
 * @property int|null $changed_by
 * @property \Illuminate\Support\Carbon $changed_at
 */
class ProjectExpenseHistory extends Model
{
    public const ACTION_CREATED = 'created';

    public const ACTION_UPDATED = 'updated';

    public const ACTION_RECEIPT_ATTACHED = 'receipt_attached';

    public const ACTION_RECEIPT_REPLACED = 'receipt_replaced';

    public const ACTION_ARCHIVED = 'archived';

    public const ACTION_RESTORED = 'restored';

    public const ACTIONS = [
        self::ACTION_CREATED,
        self::ACTION_UPDATED,
        self::ACTION_RECEIPT_ATTACHED,
        self::ACTION_RECEIPT_REPLACED,
        self::ACTION_ARCHIVED,
        self::ACTION_RESTORED,
    ];

    protected $primaryKey = 'history_id';

    public $timestamps = false;

    protected $fillable = [
        'expense_id',
        'action',
        'changes',
        'changed_by',
        'changed_at',
    ];

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'changed_at' => 'datetime',
        ];
    }

    public function expense(): BelongsTo
    {
        return $this->belongsTo(ProjectExpense::class, 'expense_id', 'expense_id');
    }

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
