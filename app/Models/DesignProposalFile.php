<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $proposal_file_id
 * @property int $design_proposal_id
 * @property string $file_category design_2d | visualization_3d | other
 * @property string $file_name
 * @property string $file_path
 * @property bool $is_current
 */
class DesignProposalFile extends Model
{
    public const CATEGORY_2D = 'design_2d';

    public const CATEGORY_3D = 'visualization_3d';

    public const CATEGORY_OTHER = 'other';

    /** Extensions the browser can show inline; others are downloaded. */
    public const VIEWABLE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

    protected $primaryKey = 'proposal_file_id';

    public $timestamps = false;

    protected $fillable = ['design_proposal_id', 'file_category', 'file_name', 'file_path', 'is_current'];

    protected function casts(): array
    {
        return ['uploaded_at' => 'datetime', 'is_current' => 'boolean'];
    }

    /** @return BelongsTo<DesignProposal, $this> */
    public function proposal(): BelongsTo
    {
        return $this->belongsTo(DesignProposal::class, 'design_proposal_id');
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
