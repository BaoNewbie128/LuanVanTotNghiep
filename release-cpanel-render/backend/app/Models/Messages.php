<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Messages extends Model
{
    public $timestamps = false;

    protected $fillable = ['room_id', 'sender_id', 'message'];
}
