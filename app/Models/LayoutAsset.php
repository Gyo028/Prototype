<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $asset_id
 * @property string $asset_name
 * @property string $asset_category
 * @property string|null $description
 * @property string|null $isometric_icon_path
 * @property string|null $placement_zone floor | wall | ceiling
 * @property string|null $price decimal, e.g. "350.00"; null = not priced yet
 * @property string $pricing_type fixed | per_guest
 * @property int|null $guests_per_unit per_guest only: 1 = one per guest, 10 = one per 10 guests
 * @property string $status active | inactive
 */
class LayoutAsset extends Model
{
    public const CATEGORIES = ['Furniture', 'Structures', 'Decors', 'Lighting'];

    public const PRICING_FIXED = 'fixed';

    public const PRICING_PER_GUEST = 'per_guest';

    protected $primaryKey = 'asset_id';

    public $timestamps = false;

    protected $fillable = [
        'asset_name',
        'asset_category',
        'description',
        'isometric_icon_path',
        'placement_zone',
        'price',
        'pricing_type',
        'guests_per_unit',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'guests_per_unit' => 'integer',
        ];
    }

    /**
     * What customers can pick: switched on and priced.
     *
     * @param  Builder<LayoutAsset>  $query
     */
    public function scopeOffered(Builder $query): void
    {
        $query->where('status', 'active')->whereNotNull('price');
    }

    public function isPerGuest(): bool
    {
        return $this->pricing_type === self::PRICING_PER_GUEST;
    }

    /**
     * How many go on the layout: one for a fixed asset; for a per-guest asset,
     * the guests divided by guests_per_unit, rounded up (150 guests, one table
     * per 10 → 15 tables).
     */
    public function quantityFor(int $guests): int
    {
        if (! $this->isPerGuest()) {
            return 1;
        }

        return max(1, (int) ceil(max(1, $guests) / max(1, (int) $this->guests_per_unit)));
    }
}
