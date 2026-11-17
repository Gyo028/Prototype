<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $service_request_id
 * @property int $customer_id
 * @property string $request_type standard | custom
 * @property int|null $event_type_id
 * @property string|null $project_title
 * @property string $request_date
 * @property string $start_date
 * @property string $end_date
 * @property string|null $event_start_time HH:MM:SS
 * @property string|null $event_end_time HH:MM:SS
 * @property string $venue
 * @property int|null $guest_count
 * @property string $budget_min decimal, e.g. "50000.00"
 * @property string|null $budget_max null means "no upper limit"
 * @property string|null $project_description
 * @property string $request_status pending | approved | rejected
 * @property string|null $pm_remarks
 */
class ServiceRequest extends Model
{
    public const TYPE_STANDARD = 'standard';

    public const TYPE_CUSTOM = 'custom';

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const BUDGET_RANGES = [
        'Below ₱50,000' => [0, 50000],
        '₱50,000 – ₱100,000' => [50000, 100000],
        '₱100,000 – ₱250,000' => [100000, 250000],
        '₱250,000 – ₱500,000' => [250000, 500000],
        'Above ₱500,000' => [500000, null],
    ];

    protected $primaryKey = 'service_request_id';

    protected $fillable = [
        'customer_id',
        'request_type',
        'event_type_id',
        'project_title',
        'request_date',
        'start_date',
        'end_date',
        'event_start_time',
        'event_end_time',
        'venue',
        'guest_count',
        'budget_min',
        'budget_max',
        'project_description',
        'request_status',
        'pm_remarks',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'request_date' => 'date:Y-m-d',
            'start_date' => 'date:Y-m-d',
            'end_date' => 'date:Y-m-d',
            'budget_min' => 'decimal:2',
            'budget_max' => 'decimal:2',
            'reviewed_at' => 'datetime',
        ];
    }

        /**
     * The budget labels a request type offers. Custom projects start at
     * ₱50,000, so they skip the first range.
     *
     * @return list<string>
     */
    public static function budgetChoices(string $type): array
    {
        $labels = array_keys(self::BUDGET_RANGES);

        return $type === self::TYPE_CUSTOM ? array_slice($labels, 1) : $labels;
    }

    /** The reservation fee is this share of the budget range the customer chose. */
    public const RESERVATION_FEE_RATE = 0.10;

    /**
     * 10% of the budget range's maximum, or of its minimum for "Above ₱500,000"
     * (no maximum). Below ₱50,000 → ₱5,000; Above ₱500,000 → ₱50,000.
     */
    public function reservationFee(): float
    {
        $base = $this->budget_max ?? $this->budget_min;

        return round((float) $base * (float) config('payments.reservation_fee.rate', self::RESERVATION_FEE_RATE), 2);
    }

    public function isCustom(): bool
    {
        return $this->request_type === self::TYPE_CUSTOM;
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }

    /** @return BelongsTo<EventType, $this> */
    public function eventType(): BelongsTo
    {
        return $this->belongsTo(EventType::class, 'event_type_id');
    }

    /** @return HasMany<ServiceRequestFile, $this> */
    public function files(): HasMany
    {
        return $this->hasMany(ServiceRequestFile::class, 'service_request_id');
    }

    /** @return HasMany<ServiceRequestService, $this> */
    public function services(): HasMany
    {
        return $this->hasMany(ServiceRequestService::class, 'service_request_id');
    }

    /** The project created when this request was approved. @return HasOne<Project, $this> */
    public function project(): HasOne
    {
        return $this->hasOne(Project::class, 'service_request_id');
    }
}