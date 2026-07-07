<?php

namespace App\Mail;

use App\Models\SupportTicket;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class SupportTicketReply extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public SupportTicket $ticket,
        public string $replyMessage,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "JDM World phản hồi yêu cầu hỗ trợ #{$this->ticket->id}");
    }

    public function content(): Content
    {
        return new Content(view: 'emails.support_reply');
    }
}
