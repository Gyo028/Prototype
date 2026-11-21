<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One version of a project's design proposal and quotation.
 *
 * @property int $design_proposal_id
 * @property int $project_id
 * @property int|null $design_specialist_id
 * @property int $version_number
 * @property string $quotation_amount
 * @property string $status draft | submitted
 * @property \Carbon\CarbonInterface|null $submitted_at
 * @property string|null $external_link
 * @property string $pm_review_decision pending | approved | revision_requested
 * @property string|null $pm_remarks
 * @property \Carbon\CarbonInterface|null $pm_reviewed_at
 * @property string $owner_review_decision pending | approved | revision_requested
 * @property string|null $owner_remarks
 * @property \Carbon\CarbonInterface|null $owner_reviewed_at
 * @property string $customer_decision pending | approved | revision_requested
 * @property string|null $customer_remarks
 * @property \Carbon\CarbonInterface|null $decision_date
 */
class DesignProposal extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_SUBMITTED = 'submitted';

    public const PENDING = 'pending';

    public const APPROVED = 'approved';

    public const REVISION_REQUESTED = 'revision_requested';

    protected $primaryKey = 'design_proposal_id';

    protected $fillable = [
        'project_id',
        'design_specialist_id',
        'version_number',
        'quotation_amount',
        'status',
        'submitted_at',
        'external_link',
        'pm_review_decision',
        'pm_remarks',
        'pm_reviewed_at',
        'owner_review_decision',
        'owner_remarks',
        'owner_reviewed_at',
        'customer_decision',
        'customer_remarks',
        'decision_date',
    ];

    protected function casts(): array
    {
        return [
            'version_number' => 'integer',
            'submitted_at' => 'datetime',
            'pm_reviewed_at' => 'datetime',
            'owner_reviewed_at' => 'datetime',
            'decision_date' => 'datetime',
        ];
    }

    /** Versions the customer can see: submitted and approved by the Project Manager and the Owner. */
    public function scopeVisibleToCustomer(Builder $query): void
    {
        $query->where('status', self::STATUS_SUBMITTED)
            ->where('pm_review_decision', self::APPROVED)
            ->where('owner_review_decision', self::APPROVED);
    }

    public function isVisibleToCustomer(): bool
    {
        return $this->status === self::STATUS_SUBMITTED
            && $this->pm_review_decision === self::APPROVED
            && $this->owner_review_decision === self::APPROVED;
    }

    /** @return BelongsTo<Project, $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    /** @return BelongsTo<Employee, $this> */
    public function designSpecialist(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'design_specialist_id', 'employee_id');
    }

    /** @return HasMany<DesignProposalFile, $this> */
    public function files(): HasMany
    {
        return $this->hasMany(DesignProposalFile::class, 'design_proposal_id')->orderBy('proposal_file_id');
    }

    /** @return HasMany<DesignProposalItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(DesignProposalItem::class, 'design_proposal_id')->orderBy('sort_order')->orderBy('item_id');
    }
}
