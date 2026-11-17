<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $payment_id
 * @property int $billing_id
 * @property string $amount_paid decimal
 * @property string $payment_reference e.g. the GCash reference number
 * @property \Carbon\CarbonInterface $payment_date
 * @property string|null $receipt_file_name
 * @property string|null $receipt_file_path
 * @property \Carbon\CarbonInterface $submitted_at
 * @property string $payment_method gcash | cash | cheque
 * @property string $status submitted | verified | rejected
 * @property int|null $recorded_by
 * @property \Carbon\CarbonInterface|null $verified_at
 * @property string|null $remarks the reason when rejected
 */
class Payment extends Model
{
    public const METHOD_GCASH = 'gcash';

    public const METHOD_CASH = 'cash';

    public const METHOD_CHEQUE = 'cheque';

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_VERIFIED = 'verified';

    public const STATUS_REJECTED = 'rejected';

    protected $primaryKey = 'payment_id';

    public $timestamps = false;

    protected $fillable = [
        'billing_id',
        'amount_paid',
        'payment_reference',
        'payment_date',
        'receipt_file_name',
        'receipt_file_path',
        'submitted_at',
        'payment_method',
        'status',
        'recorded_by',
        'verified_at',
        'remarks',
    ];

    protected function casts(): array
    {
        return [
            'amount_paid' => 'decimal:2',
            'payment_date' => 'datetime',
            'submitted_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Billing, $this> */
    public function billing(): BelongsTo
    {
        return $this->belongsTo(Billing::class, 'billing_id');
    }

    /** @return BelongsTo<User, $this> */
    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
