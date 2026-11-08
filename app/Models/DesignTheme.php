<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $theme_id
 * @property string $theme_name
 * @property string|null $description
 * @property int $event_type_id
 * @property int|null $min_guests
 * @property int $max_guests
 * @property string $venue indoor | outdoor
 * @property string $style
 * @property string|null $background_image_path
 * @property array<string, mixed>|null $grid_config
 * @property string $status active | inactive
 */
class DesignTheme extends Model
{
    public const VENUE_INDOOR = 'indoor';

    public const VENUE_OUTDOOR = 'outdoor';

    public const STYLES = ['Modern', 'Rustic', 'Futuristic', 'Classic', 'Bohemian'];

    protected $primaryKey = 'theme_id';

    protected $fillable = [
        'theme_name',
        'description',
        'event_type_id',
        'min_guests',
        'max_guests',
        'venue',
        'style',
        'background_image_path',
        'grid_config',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'min_guests' => 'integer',
            'max_guests' => 'integer',
            'grid_config' => 'array',
        ];
    }

    /** @return BelongsTo<EventType, $this> */
    public function eventType(): BelongsTo
    {
        return $this->belongsTo(EventType::class, 'event_type_id');
    }
}