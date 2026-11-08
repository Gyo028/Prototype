<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * @property int $service_id
 * @property string $service_name
 * @property string $service_category
 * @property string|null $description
 * @property string $pricing_type fixed | per_unit
 * @property string|null $unit_type e.g. pax, hour, sqm (per_unit services only)
 * @property string $price decimal, e.g. "650.00"
 * @property string $status active | inactive
 */
class Service extends Model
{
    public const PRICING_FIXED = 'fixed';

    public const PRICING_PER_UNIT = 'per_unit';

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    /**
     * The flat fee included with every Event Styling request. Only its
     * description and price can change; it is never renamed or switched off.
     */
    public const BASE_FEE_NAME = 'Event Styling';

    public const BASE_FEE_CATEGORY = 'Styling';

    /** Categories for add-on services (the base fee's "Styling" is reserved). */
    public const CATEGORIES = ['Entertainment', 'Photo & Video', 'Catering', 'Host'];

    public const UNIT_TYPES = ['sqm', 'pc', 'set', 'hour', 'day', 'pax'];

    protected $primaryKey = 'service_id';

    public $timestamps = false;

    protected $fillable = [
        'service_name',
        'service_category',
        'description',
        'pricing_type',
        'unit_type',
        'price',
        'status',
    ];

    protected function casts(): array
    {
        return ['price' => 'decimal:2'];
    }

    public function isBaseFee(): bool
    {
        return $this->service_name === self::BASE_FEE_NAME;
    }

    public function isActive(): bool
    {
        return $this->status === self::STATUS_ACTIVE;
    }
}