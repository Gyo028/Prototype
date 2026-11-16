<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * The official project record, created when the Project Manager approves a
 * service request. Its request details (type, dates, venue, budget...) stay
 * on the service request.
 *
 * @property int $project_id
 * @property int $service_request_id
 * @property int $project_manager_id employee_id
 * @property int|null $design_specialist_id employee_id
 * @property int $current_status_id
 * @property \Illuminate\Support\Carbon|null $design_assigned_at
 * @property string|null $customer_proceed_decision proceed | hold | cancelled
 * @property bool|null $ocular_visit_required null until the consultation is recorded
 * @property int|null $customer_rating
 * @property string|null $customer_review_text
 * @property \Illuminate\Support\Carbon|null $customer_reviewed_at
 * @property bool $featured_on_website
 */
class Project extends Model
{
    public const DECISION_PROCEED = 'proceed';

    public const DECISION_HOLD = 'hold';

    public const DECISION_CANCELLED = 'cancelled';

    protected $primaryKey = 'project_id';

    protected $fillable = [
        'service_request_id',
        'project_manager_id',
        'design_specialist_id',
        'current_status_id',
        'design_assigned_at',
        'customer_proceed_decision',
        'ocular_visit_required',
        'customer_rating',
        'customer_review_text',
        'customer_reviewed_at',
        'featured_on_website',
    ];

    protected function casts(): array
    {
        return [
            'design_assigned_at' => 'datetime',
            'ocular_visit_required' => 'boolean',
            'customer_rating' => 'integer',
            'customer_reviewed_at' => 'datetime',
            'featured_on_website' => 'boolean',
        ];
    }

    /** "On Hold" is shown as a label on the current status, not as a status. */
    public function isOnHold(): bool
    {
        return $this->customer_proceed_decision === self::DECISION_HOLD;
    }

    /** @return BelongsTo<ServiceRequest, $this> */
    public function serviceRequest(): BelongsTo
    {
        return $this->belongsTo(ServiceRequest::class, 'service_request_id');
    }

    /** @return BelongsTo<Employee, $this> */
    public function projectManager(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'project_manager_id', 'employee_id');
    }

    /** @return BelongsTo<Employee, $this> */
    public function designSpecialist(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'design_specialist_id', 'employee_id');
    }

    /** @return BelongsTo<ProjectStatus, $this> */
    public function status(): BelongsTo
    {
        return $this->belongsTo(ProjectStatus::class, 'current_status_id', 'status_id');
    }

    /** @return HasMany<ProjectSchedule, $this> */
    public function schedules(): HasMany
    {
        return $this->hasMany(ProjectSchedule::class, 'project_id');
    }

    /** The event date (or the custom project's date range). @return HasOne<ProjectSchedule, $this> */
    public function eventSchedule(): HasOne
    {
        return $this->hasOne(ProjectSchedule::class, 'project_id')
            ->where('schedule_type', ProjectSchedule::TYPE_EVENT);
    }
}
