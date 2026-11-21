<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * @property int $schedule_id
 * @property int $project_id
 * @property string $schedule_type event | consultation | ocular_visit | fabrication | installation
 * @property \Illuminate\Support\Carbon $start_datetime
 * @property \Illuminate\Support\Carbon $end_datetime
 * @property string $schedule_status pending | tentative | confirmed | completed | cancelled
 * @property \Carbon\CarbonInterface|null $completed_at when the work was finished (fabrication, installation)
 * @property string|null $meeting_mode online | face_to_face (appointments only)
 * @property string|null $venue_ownership own_property | third_party (ocular visits only)
 * @property string|null $remarks
 * @property int|null $changed_by user who rescheduled or cancelled it
 */
class ProjectSchedule extends Model
{
    public const TYPE_EVENT = 'event';

    public const TYPE_CONSULTATION = 'consultation';

    public const TYPE_OCULAR_VISIT = 'ocular_visit';

    public const TYPE_FABRICATION = 'fabrication';

    public const TYPE_INSTALLATION = 'installation';

    public const STATUS_PENDING = 'pending';

    public const STATUS_TENTATIVE = 'tentative';

    public const STATUS_CONFIRMED = 'confirmed';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_CANCELLED = 'cancelled';

    /** Statuses that hold a time slot (cancelled and completed ones don't). */
    public const ACTIVE_STATUSES = [self::STATUS_PENDING, self::STATUS_TENTATIVE, self::STATUS_CONFIRMED];

    public const MODE_ONLINE = 'online';

    public const MODE_FACE_TO_FACE = 'face_to_face';

    /** Ocular visit at the customer's own property: no site access documents needed. */
    public const VENUE_OWN_PROPERTY = 'own_property';

    /** Ocular visit at a rented or third-party venue: needs approved site access documents. */
    public const VENUE_THIRD_PARTY = 'third_party';

    protected $primaryKey = 'schedule_id';

    public $timestamps = false;

    protected $fillable = [
        'project_id',
        'schedule_type',
        'start_datetime',
        'end_datetime',
        'schedule_status',
        'completed_at',
        'meeting_mode',
        'venue_ownership',
        'remarks',
        'changed_by',
    ];

    protected function casts(): array
    {
        return [
            'start_datetime' => 'datetime',
            'end_datetime' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    /** Who rescheduled or cancelled it. @return BelongsTo<User, $this> */
    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    /** What came out of a held consultation or ocular visit. @return HasOne<AppointmentOutcome, $this> */
    public function outcome(): HasOne
    {
        return $this->hasOne(AppointmentOutcome::class, 'schedule_id');
    }
}
