<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PasswordReset extends Model
{
    protected $table = 'password_resets';
    protected $fillable = ['email', 'otp', 'expires_at', 'attempts', 'last_sent_at', 'request_ip'];
    public $timestamps = false;
}
