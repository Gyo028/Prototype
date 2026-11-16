<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $customer_id
 * @property int $user_id
 * @property string $first_name
 * @property string $last_name
 * @property string $contact_number
 * @property string|null $address
 */
class Customer extends Model
{
    protected $table = 'customer';

    protected $primaryKey = 'customer_id';

    protected $fillable = [
        'user_id',
        'first_name',
        'last_name',
        'contact_number',
        'address',
    ];

    /** The login account this profile belongs to. */
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<ServiceRequest, $this> */
    public function serviceRequests(): HasMany
    {
        return $this->hasMany(ServiceRequest::class, 'customer_id');
    }

    public function getFullNameAttribute(): string
    {
        return $this->first_name.' '.$this->last_name;
    }
}