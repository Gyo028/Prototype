<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property int $role_id
 * @property Role|null $role
 * @property string $account_status
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_DISABLED = 'disabled';

    /** Always load the role, since every request checks it. */
    protected $with = ['userRole'];

    protected static function booted(): void
    {
        // New accounts (e.g. from the registration page) are customers unless a role is given.
        static::creating(function (User $user) {
            $user->role_id ??= UserRole::where('name', Role::Customer->value)->value('id');
        });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<UserRole, $this> */
    public function userRole(): BelongsTo
    {
        return $this->belongsTo(UserRole::class, 'role_id');
    }

    /**
     * $user->role returns the Role enum (read from the roles table), and
     * $user->role = Role::Owner sets role_id, so the rest of the code
     * (route middleware, dashboard redirect) works with the enum as before.
     */
    protected function role(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->userRole ? Role::tryFrom($this->userRole->name) : null,
            set: function (Role|string $role) {
                $this->unsetRelation('userRole');

                return ['role_id' => UserRole::where('name', $role instanceof Role ? $role->value : $role)->value('id')];
            },
        );
    }

    public function isActive(): bool
    {
        // A model created in this request may not have the database default loaded yet.
        return ($this->account_status ?? self::STATUS_ACTIVE) === self::STATUS_ACTIVE;
    }
}