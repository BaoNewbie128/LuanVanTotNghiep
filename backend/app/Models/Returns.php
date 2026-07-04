<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Returns extends Model
{
    const UPDATED_AT = null;

    protected $table = 'returns';
    
    protected $fillable = [
        'order_id',
        'user_id',
        'request_type',
        'reason',
        'resolution_note',
        'image',
        'status'
    ];

    protected $appends = [
        'image_url',
    ];

    public function getImageUrlAttribute(): ?string
    {
        return $this->image ? '/storage/' . ltrim($this->image, '/') : null;
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
