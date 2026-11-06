<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A row of the `roles` table. Named UserRole so it doesn't clash with the
 * App\Enums\Role enum, which the code uses for role checks and redirects.
 *
 * @property int $id
 * @property string $name
 * @property string $label
 * @property string|null $description
 */
class UserRole extends Model
{
    protected $table = 'roles';

    protected $fillable = ['name', 'label', 'description'];

    /** @return HasMany<User, $this> */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id');
    }
}