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
 * @property array<string, mixed>|null $grid_config layout setup; "slots" holds the default set (see slots())
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

    /**
     * The theme's default set: one asset per slot, set by the developers in
     * grid_config, e.g. {"slots": [{"key": "backdrop", "label": "Backdrop",
     * "category": "Structures", "defaultAssetId": 3}]}. A customer can swap the
     * asset in a slot for another of the same category, but not leave it empty.
     * A theme without slots (e.g. one the Technical Admin just added) has none.
     *
     * @return list<array{key: string, label: string, category: string, defaultAssetId: int|null}>
     */
    public function slots(): array
    {
        $slots = $this->grid_config['slots'] ?? [];

        if (! is_array($slots)) {
            return [];
        }

        return collect($slots)
            ->filter(fn ($slot) => is_array($slot) && ! empty($slot['key']) && ! empty($slot['category']))
            ->map(fn (array $slot) => [
                'key' => (string) $slot['key'],
                'label' => (string) ($slot['label'] ?? $slot['key']),
                'category' => (string) $slot['category'],
                'defaultAssetId' => isset($slot['defaultAssetId']) ? (int) $slot['defaultAssetId'] : null,
            ])
            ->unique('key')
            ->values()
            ->all();
    }
}
