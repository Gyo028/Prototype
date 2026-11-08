<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $content_id
 * @property string $section homepage | gallery | faq | services
 * @property string|null $block_key identifies a fixed block, e.g. 'hero', 'about', 'contact'
 * @property string $title
 * @property string|null $content
 * @property int $sort_order
 * @property int|null $updated_by
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class WebsiteContent extends Model
{
    public const SECTION_HOMEPAGE = 'homepage';

    public const SECTION_GALLERY = 'gallery';

    public const SECTION_FAQ = 'faq';

    public const SECTION_SERVICES = 'services';

    protected $primaryKey = 'content_id';

    /** The ERD has updated_at only, no created_at. */
    public const CREATED_AT = null;

    protected $fillable = [
        'section',
        'block_key',
        'title',
        'content',
        'sort_order',
        'updated_by',
    ];

    /** @return HasMany<WebsiteContentImage, $this> */
    public function images(): HasMany
    {
        return $this->hasMany(WebsiteContentImage::class, 'content_id')->orderBy('sort_order');
    }

    /** The user who last changed this content. */
    /** @return BelongsTo<User, $this> */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}