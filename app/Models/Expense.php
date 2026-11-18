<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Expense extends Model
{
    protected $fillable = [
        'date', 'description', 'project', 'category', 'receipt', 'amount',
    ];

    protected $casts = [
        'date'    => 'date:Y-m-d', // sends "2027-02-18" to React, which your formatDate() expects
        'receipt' => 'boolean',
        'amount'  => 'float',      // otherwise decimal arrives in React as a string
    ];
}