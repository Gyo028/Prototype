<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An authorization letter or venue permit for an ocular visit at a
 * third-party venue.
 *
 * @property int $document_id
 * @property int $project_id
 * @property string $document_type authorization_letter | venue_permit
 * @property string $file_name
 * @property string $file_path
 * @property string $status submitted | approved | rejected
 * @property string|null $remarks the reason, when rejected
 * @property int|null $uploaded_by
 * @property \Carbon\CarbonInterface $uploaded_at
 * @property int|null $reviewed_by
 * @property \Carbon\CarbonInterface|null $reviewed_at
 * @property \Carbon\CarbonInterface|null $replaced_at null = the current file
 */
class SiteAccessDocument extends Model
{
    public const TYPE_AUTHORIZATION_LETTER = 'authorization_letter';

    public const TYPE_VENUE_PERMIT = 'venue_permit';

    /** In the order they are shown, with their labels. */
    public const TYPES = [
        self::TYPE_AUTHORIZATION_LETTER => 'Authorization letter',
        self::TYPE_VENUE_PERMIT => 'Venue permit',
    ];

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const MAX_MB = 5;

    public const MIMES = ['pdf', 'jpg', 'jpeg', 'png'];

    protected $primaryKey = 'document_id';

    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'document_type',
        'file_name',
        'file_path',
        'status',
        'remarks',
        'uploaded_by',
        'uploaded_at',
        'reviewed_by',
        'reviewed_at',
        'replaced_at',
    ];

    protected function casts(): array
    {
        return [
            'uploaded_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'replaced_at' => 'datetime',
        ];
    }

    /** The current file of each type (not replaced). */
    public function scopeCurrent(Builder $query): void
    {
        $query->whereNull('replaced_at');
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function label(): string
    {
        return self::TYPES[$this->document_type] ?? 'Document';
    }

    public function isViewable(): bool
    {
        return in_array(strtolower(pathinfo($this->file_name, PATHINFO_EXTENSION)), ['pdf', 'jpg', 'jpeg', 'png'], true);
    }
}
