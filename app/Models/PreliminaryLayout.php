<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * The preliminary 2D layout saved with a Standard Event Styling request.
 *
 * @property int $preliminary_layout_id
 * @property int $service_request_id
 * @property int|null $theme_id
 * @property string $total_initial_cost decimal: services (with the styling fee) + priced assets
 * @property string $layout_status draft | submitted
 * @property \Illuminate\Support\Carbon|null $generated_at
 * @property string|null $generated_file_path
 */
class PreliminaryLayout extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_SUBMITTED = 'submitted';

    protected $primaryKey = 'preliminary_layout_id';

    // Only updated_at, as in the ERD; generated_at is set when it is saved.
    public const CREATED_AT = null;

    protected $fillable = [
        'service_request_id',
        'theme_id',
        'total_initial_cost',
        'layout_status',
        'generated_at',
        'generated_file_path',
    ];

    protected function casts(): array
    {
        return [
            'total_initial_cost' => 'decimal:2',
            'generated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<ServiceRequest, $this> */
    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class, 'service_request_id');
    }

    /** @return BelongsTo<DesignTheme, $this> */
    public function theme(): BelongsTo
    {
        return $this->belongsTo(DesignTheme::class, 'theme_id');
    }

    /** @return HasMany<PreliminaryLayoutItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(PreliminaryLayoutItem::class, 'preliminary_layout_id');
    }
}
