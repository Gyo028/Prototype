<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A project sub-status (e.g. "Designing") and the phase it belongs to
 * (e.g. "planning"). The rows are inserted by the migration.
 *
 * @property int $status_id
 * @property string $status_name
 * @property string|null $description
 * @property string $phase planning | execution | closed
 * @property int $sequence_order
 * @property bool $is_terminal
 */
class ProjectStatus extends Model
{
    public const CONSULTATION = 'Consultation';

    public const BOOKED = 'Booked';

    public const SITE_ASSESSMENT = 'Site Assessment';

    public const DESIGNING = 'Designing';

    public const CONTRACT = 'Contract';

    public const FABRICATING = 'Fabricating';

    public const INSTALLING = 'Installing';

    public const COMPLETED = 'Completed';

    public const CANCELLED = 'Cancelled';

    public const PHASE_PLANNING = 'planning';

    public const PHASE_EXECUTION = 'execution';

    public const PHASE_CLOSED = 'closed';

    protected $primaryKey = 'status_id';

    public $timestamps = false;

    protected $fillable = ['status_name', 'description', 'phase', 'sequence_order', 'is_terminal'];

    protected function casts(): array
    {
        return [
            'sequence_order' => 'integer',
            'is_terminal' => 'boolean',
        ];
    }

    /** The status_id for a status name, e.g. ProjectStatus::idFor(ProjectStatus::BOOKED). */
    public static function idFor(string $name): int
    {
        return (int) static::query()->where('status_name', $name)->value('status_id');
    }

    /** "Planning", "Execution" or "Closed". */
    public function phaseLabel(): string
    {
        return ucfirst($this->phase);
    }

    /** @return HasMany<Project, $this> */
    public function projects(): HasMany
    {
        return $this->hasMany(Project::class, 'current_status_id');
    }
}
