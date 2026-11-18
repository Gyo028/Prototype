<?php

namespace App\Models;

use App\Models\Concerns\HasYearlyCode;
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
 * @property string|null $project_code e.g. "PRJ-26-0001" (year created + number, restarting every year); set right after it is created
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
    use HasYearlyCode;

    public const CODE_PREFIX = 'PRJ';

    public const CODE_COLUMN = 'project_code';

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

    /** @return HasMany<Billing, $this> */
    public function billings(): HasMany
    {
        return $this->hasMany(Billing::class, 'project_id');
    }

    /** The reservation fee bill, once issued. @return HasOne<Billing, $this> */
    public function reservationFee(): HasOne
    {
        return $this->hasOne(Billing::class, 'project_id')
            ->ofMany(['billing_id' => 'max'], fn ($q) => $q->where('billing_type', Billing::TYPE_RESERVATION_FEE));
    }

    /** The event date (or the custom project's date range). @return HasOne<ProjectSchedule, $this> */
    public function eventSchedule(): HasOne
    {
        return $this->hasOne(ProjectSchedule::class, 'project_id')
            ->where('schedule_type', ProjectSchedule::TYPE_EVENT);
    }

    /** Authorization letters and venue permits, including replaced ones. @return HasMany<SiteAccessDocument, $this> */
    public function siteAccessDocuments(): HasMany
    {
        return $this->hasMany(SiteAccessDocument::class, 'project_id')->orderByDesc('document_id');
    }

    /** Contract versions, oldest first. @return HasMany<Contract, $this> */
    public function contracts(): HasMany
    {
        return $this->hasMany(Contract::class, 'project_id')->orderBy('version_number');
    }

    /** The 50% down payment bill, once the contract is verified. @return HasOne<Billing, $this> */
    public function downPayment(): HasOne
    {
        return $this->hasOne(Billing::class, 'project_id')
            ->ofMany(['billing_id' => 'min'], fn ($q) => $q->where('billing_type', Billing::TYPE_FINAL_BILLING));
    }

    /** The remaining balance bill (the second final billing). @return HasOne<Billing, $this> */
    public function balanceBill(): HasOne
    {
        return $this->hasOne(Billing::class, 'project_id')
            ->ofMany(['billing_id' => 'max'], fn ($q) => $q->where('billing_type', Billing::TYPE_FINAL_BILLING));
    }

    /** Design proposal versions, oldest first. @return HasMany<DesignProposal, $this> */
    public function designProposals(): HasMany
    {
        return $this->hasMany(DesignProposal::class, 'project_id')->orderBy('version_number');
    }
}
