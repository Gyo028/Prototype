<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $event_type_id
 * @property string $event_type_name
 * @property string|null $description
 * @property string $status active | inactive
 */
class EventType extends Model
{
    protected $primaryKey = 'event_type_id';

    public $timestamps = false;

    protected $fillable = ['event_type_name', 'description', 'status'];

    /** @return HasMany<DesignTheme, $this> */
    public function designThemes(): HasMany
    {
        return $this->hasMany(DesignTheme::class, 'event_type_id');
    }
}