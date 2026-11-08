<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $asset_variant_id
 * @property int $asset_id
 * @property string $variant_name
 * @property string|null $description
 * @property string $price decimal, e.g. "150.00"
 * @property string $status active | inactive
 */
class AssetVariant extends Model
{
    protected $primaryKey = 'asset_variant_id';

    public $timestamps = false;

    protected $fillable = ['asset_id', 'variant_name', 'description', 'price', 'status'];

    protected function casts(): array
    {
        return ['price' => 'decimal:2'];
    }

    /** @return BelongsTo<LayoutAsset, $this> */
    public function asset(): BelongsTo
    {
        return $this->belongsTo(LayoutAsset::class, 'asset_id');
    }
}