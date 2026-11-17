<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A quotation line of a design proposal version.
 *
 * @property int $item_id
 * @property int $design_proposal_id
 * @property string $item_name
 * @property string|null $description
 * @property int $quantity
 * @property string|null $unit
 * @property string $unit_price
 * @property string $subtotal
 * @property int $sort_order
 */
class DesignProposalItem extends Model
{
    protected $primaryKey = 'item_id';

    public $timestamps = false;

    protected $fillable = ['design_proposal_id', 'item_name', 'description', 'quantity', 'unit', 'unit_price', 'subtotal', 'sort_order'];

    protected function casts(): array
    {
        return ['quantity' => 'integer', 'sort_order' => 'integer'];
    }

    /** @return BelongsTo<DesignProposal, $this> */
    public function proposal(): BelongsTo
    {
        return $this->belongsTo(DesignProposal::class, 'design_proposal_id');
    }
}
