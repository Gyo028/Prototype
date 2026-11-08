<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $position_id
 * @property string $position_name
 * @property string|null $description
 */
class EmployeePosition extends Model
{
    protected $primaryKey = 'position_id';

    public $timestamps = false;

    protected $fillable = ['position_name', 'description'];

    /** @return HasMany<Employee, $this> */
    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'position_id');
    }
}