<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $billing_id
 * @property int $project_id
 * @property string $amount decimal, e.g. "25000.00"
 * @property string $billing_type reservation_fee | final_billing | additional_charge
 * @property \Carbon\CarbonInterface $issued_at
 * @property \Carbon\CarbonInterface $due_date
 * @property string $status issued | paid | overdue
 * @property string|null $description
 */
class Billing extends Model
{
    public const TYPE_RESERVATION_FEE = 'reservation_fee';

    public const TYPE_FINAL_BILLING = 'final_billing';

    public const TYPE_ADDITIONAL_CHARGE = 'additional_charge';

    public const STATUS_ISSUED = 'issued';

    public const STATUS_PAID = 'paid';

    public const STATUS_OVERDUE = 'overdue';

    protected $primaryKey = 'billing_id';

    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'amount',
        'billing_type',
        'issued_at',
        'due_date',
        'status',
        'description',
        'dispute_details',
        'dispute_proof_file_path',
        'dispute_status',
        'dispute_resolution',
        'dispute_submitted_at',
        'dispute_resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'issued_at' => 'datetime',
            'due_date' => 'date:Y-m-d',
            'dispute_submitted_at' => 'datetime',
            'dispute_resolved_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    /** @return HasMany<Payment, $this> */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class, 'billing_id');
    }
}
