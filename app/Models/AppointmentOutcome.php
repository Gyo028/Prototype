<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * What came out of a held consultation or ocular visit.
 *
 * @property int $outcome_id
 * @property int $schedule_id
 * @property string|null $notes
 * @property int|null $recorded_by
 * @property \Carbon\CarbonInterface $recorded_at
 */
class AppointmentOutcome extends Model
{
    protected $primaryKey = 'outcome_id';

    protected $fillable = ['schedule_id', 'notes', 'recorded_by', 'recorded_at'];

    protected function casts(): array
    {
        return ['recorded_at' => 'datetime'];
    }

    /** @return BelongsTo<ProjectSchedule, $this> */
    public function schedule(): BelongsTo
    {
        return $this->belongsTo(ProjectSchedule::class, 'schedule_id');
    }

    /** @return HasMany<AppointmentOutcomeFile, $this> */
    public function files(): HasMany
    {
        return $this->hasMany(AppointmentOutcomeFile::class, 'outcome_id')->orderBy('outcome_file_id');
    }

    /** @return BelongsTo<User, $this> */
    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
