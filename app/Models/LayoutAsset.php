<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $asset_id
 * @property string $asset_name
 * @property string $asset_category
 * @property string|null $description
 * @property string|null $isometric_icon_path
 * @property string|null $placement_zone floor | wall | ceiling
 * @property string $status active | inactive
 */
class LayoutAsset extends Model
{
    public const CATEGORIES = ['Furniture', 'Structures', 'Decors', 'Lighting'];

    protected $primaryKey = 'asset_id';

    public $timestamps = false;

    protected $fillable = [
        'asset_name',
        'asset_category',
        'description',
        'isometric_icon_path',
        'placement_zone',
        'status',
    ];

    /** @return HasMany<AssetVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(AssetVariant::class, 'asset_id');
    }
}