<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReviewImage extends Model
{
    /** The review_images table from jdm (1).sql has no timestamp columns. */
    public $timestamps = false;

    protected $fillable = [
        'review_id',
        'image_url'
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function review()
    {
        return $this->belongsTo(Review::class);
    }
}
