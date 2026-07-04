<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Model;

class SupportTicket extends Model
{
    protected $table = 'support_tickets';

    protected $fillable = [
        'name',
        'user_id',
        'email',
        'subject',
        'message',
        'reply_message',
        'replied_by',
        'replied_at',
        'mail_sent_at',
        'customer_read_at',
        'status',
    ];

    protected $casts = [
        'replied_at' => 'datetime',
        'mail_sent_at' => 'datetime',
        'customer_read_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'replied_by');
    }
}
