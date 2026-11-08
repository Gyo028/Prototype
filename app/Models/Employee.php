<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $employee_id
 * @property int|null $user_id
 * @property int $position_id
 * @property string $first_name
 * @property string $last_name
 * @property string $contact_number
 * @property string $email
 * @property string $employee_status
 */
class Employee extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    protected $primaryKey = 'employee_id';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'position_id',
        'first_name',
        'last_name',
        'contact_number',
        'email',
        'employee_status',
    ];

    /** The login account, if this employee has one (field personnel don't). */
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<EmployeePosition, $this> */
    public function position(): BelongsTo
    {
        return $this->belongsTo(EmployeePosition::class, 'position_id');
    }

    public function getFullNameAttribute(): string
    {
        return $this->first_name.' '.$this->last_name;
    }
}