<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Wishlist extends Model
{
    /**
     * The database dump/migration for wishlists only contains created_at.
     * Disable Eloquent's automatic updated_at writes to prevent SQL errors
     * when adding/removing wishlist items.
     */
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'product_id'
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function product()
    {
        return $this->belongsTo(Products::class);
    }
}
