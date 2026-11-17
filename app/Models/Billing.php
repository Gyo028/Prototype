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
 * @property string|null $dispute_details the customer's reason
 * @property string|null $dispute_proof_file_path
 * @property string|null $dispute_proof_file_name
 * @property string|null $dispute_status pending | reviewed | resolved
 * @property string|null $dispute_resolution upheld | rejected | adjusted
 * @property string|null $dispute_remarks the Project Manager's explanation
 * @property \Carbon\CarbonInterface|null $dispute_submitted_at
 * @property \Carbon\CarbonInterface|null $dispute_resolved_at
 */
class Billing extends Model
{
    public const TYPE_RESERVATION_FEE = 'reservation_fee';

    public const TYPE_FINAL_BILLING = 'final_billing';

    public const TYPE_ADDITIONAL_CHARGE = 'additional_charge';

    public const STATUS_ISSUED = 'issued';

    public const STATUS_PAID = 'paid';

    public const STATUS_OVERDUE = 'overdue';

    public const DISPUTE_PENDING = 'pending';

    public const DISPUTE_REVIEWED = 'reviewed';

    public const DISPUTE_RESOLVED = 'resolved';

    public const RESOLUTION_UPHELD = 'upheld';

    public const RESOLUTION_REJECTED = 'rejected';

    public const RESOLUTION_ADJUSTED = 'adjusted';

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
        'dispute_proof_file_name',
        'dispute_status',
        'dispute_resolution',
        'dispute_remarks',
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

    /** True while a dispute waits for the Project Manager (pending or reviewed). */
    public function hasOpenDispute(): bool
    {
        return in_array($this->dispute_status, [self::DISPUTE_PENDING, self::DISPUTE_REVIEWED], true);
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
