<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatRooms extends Model
{
    public $timestamps = false;

    protected $fillable = ['customer_id', 'staff_id'];

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_id');
    }

    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id');
    }
}
