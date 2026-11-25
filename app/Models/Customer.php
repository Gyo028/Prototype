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
 * @property string|null $company_name
 * @property string|null $contact_number  null until the customer completes My Profile
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
        'company_name',
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

    /**
     * Mobile numbers are saved as 09XXXXXXXXX: "+63 917-123-4567" becomes "09171234567".
     * Returns the input unchanged when it is not a string.
     */
    public static function normalizeMobile(mixed $number): mixed
    {
        if (! is_string($number)) {
            return $number;
        }

        return preg_replace('/^\+63/', '0', preg_replace('/[\s\-().]/', '', trim($number)));
    }

    /**
     * Registration asks only for the name, email and password. A customer can
     * send a service request once My Profile has a contact number.
     */
    public function isComplete(): bool
    {
        return filled($this->contact_number);
    }

    public function getFullNameAttribute(): string
    {
        return $this->first_name.' '.$this->last_name;
    }
}