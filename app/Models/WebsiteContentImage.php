<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $image_id
 * @property int $content_id
 * @property string $file_path
 * @property string|null $alt_text
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
        'file_path',
        'alt_text',
        'sort_order',
        'status',
    ];

    /** @return BelongsTo<WebsiteContent, $this> */
    public function content(): BelongsTo
    {
        return $this->belongsTo(WebsiteContent::class, 'content_id');
    }
}