<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One asset on a preliminary layout: a library asset, or the customer's own
 * "Other" item (no asset, no price yet).
 *
 * @property int $layout_item_id
 * @property int $preliminary_layout_id
 * @property int|null $asset_id
 * @property bool $is_default the theme's default asset for its slot
 * @property int $quantity
 * @property string|null $custom_item_category
 * @property string|null $custom_item_name
 * @property string|null $custom_item_description
 * @property string|null $unit_price decimal; null = to be priced
 * @property string|null $subtotal decimal; null = to be priced
 */
class PreliminaryLayoutItem extends Model
{
    protected $primaryKey = 'layout_item_id';

    public $timestamps = false;

    protected $fillable = [
        'preliminary_layout_id',
        'asset_id',
        'is_default',
        'quantity',
        'custom_item_category',
        'custom_item_name',
        'custom_item_description',
        'unit_price',
        'subtotal',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
            'subtotal' => 'decimal:2',
        ];
    }

    public function isCustom(): bool
    {
        return $this->asset_id === null;
    }

    /** @return BelongsTo<LayoutAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(LayoutAsset::class, 'asset_id');
    }
}
