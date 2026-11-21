<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $outcome_file_id
 * @property int $outcome_id
 * @property string $file_type report | photo | attachment
 * @property string $file_name
 * @property string $file_path
 */
class AppointmentOutcomeFile extends Model
{
    public const TYPE_REPORT = 'report';

    public const TYPE_PHOTO = 'photo';

    public const TYPE_ATTACHMENT = 'attachment';

    /** Extensions the browser can show inline; others are downloaded. */
    public const VIEWABLE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

    protected $primaryKey = 'outcome_file_id';

    public $timestamps = false;

    protected $fillable = ['outcome_id', 'file_type', 'file_name', 'file_path'];

    protected function casts(): array
    {
        return ['uploaded_at' => 'datetime'];
    }

    /** @return BelongsTo<AppointmentOutcome, $this> */
    public function outcome(): BelongsTo
    {
        return $this->belongsTo(AppointmentOutcome::class, 'outcome_id');
    }

    public function extension(): string
    {
        return strtolower(pathinfo($this->file_name, PATHINFO_EXTENSION));
    }

    public function isViewable(): bool
    {
        return in_array($this->extension(), self::VIEWABLE_EXTENSIONS, true);
    }
}
