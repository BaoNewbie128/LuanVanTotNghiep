<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Coupon extends Model
{
    protected $table = 'coupons';

    const UPDATED_AT = null;

    protected $fillable = [
        'code',
        'type',
        'discount',
        'expiry_date'
    ];

    protected $casts = [
        'discount' => 'decimal:2',
        'expiry_date' => 'date',
        'created_at' => 'datetime',
    ];
}
