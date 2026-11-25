<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * A website photo. Either a fixed slot of a block (slot is set, e.g. the hero
 * banner or an About Us collage photo) or an Our Works library photo (slot is
 * empty; title, caption and category are set).
 *
 * @property int $image_id
 * @property int $content_id
 * @property string|null $slot hero | about_1..3 | intro_1 | intro_2
 * @property string $file_path "/images/..." = app file, otherwise a path on the website disk
 * @property string|null $thumb_path
 * @property string|null $alt_text
 * @property string|null $title
 * @property string|null $caption
 * @property string|null $category corporate_events | special_occasions | custom_projects
 * @property int|null $homepage_order 1-10 when on the homepage carousel
 * @property int|null $showcase_order 1-4 when in its service page showcase
 * @property int $sort_order
 * @property string $status active | inactive
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class WebsiteContentImage extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $primaryKey = 'image_id';

    public const CREATED_AT = null;

    protected $fillable = [
        'content_id',
        'slot',
        'file_path',
        'thumb_path',
        'alt_text',
        'title',
        'caption',
        'category',
        'homepage_order',
        'showcase_order',
        'sort_order',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'homepage_order' => 'integer',
            'showcase_order' => 'integer',
        ];
    }

    /** @return BelongsTo<WebsiteContent, $this> */
    public function content(): BelongsTo
    {
        return $this->belongsTo(WebsiteContent::class, 'content_id');
    }

    /** Our Works library photos (not the fixed slot photos). */
    public function scopeLibrary(Builder $query): void
    {
        $query->whereNull('slot')
            ->whereHas('content', fn (Builder $q) => $q->where('block_key', 'works'));
    }

    /** True for photos shipped with the app (public/images), which are never deleted from disk. */
    public function isAppFile(): bool
    {
        return str_starts_with($this->file_path, '/');
    }

    public function url(): string
    {
        return self::urlFor($this->file_path);
    }

    /** The small copy for admin lists, or the photo itself when there is none. */
    public function thumbUrl(): string
    {
        return self::urlFor($this->thumb_path ?: $this->file_path);
    }

    /** Is the photo in use on the carousel or a showcase? Then it cannot be hidden, deleted or moved to another category. */
    public function isInUse(): bool
    {
        return $this->homepage_order !== null || $this->showcase_order !== null;
    }

    public static function disk(): string
    {
        return (string) config('filesystems.website_disk', 'public');
    }

    public static function urlFor(string $path): string
    {
        return str_starts_with($path, '/') ? $path : Storage::disk(self::disk())->url($path);
    }
}
