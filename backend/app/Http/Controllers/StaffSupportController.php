<?php

namespace App\Http\Controllers;

use App\Mail\SupportTicketReply;
use App\Models\Notification;
use App\Models\SupportTicket;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class StaffSupportController extends Controller
{
    public function index(Request $request)
    {
        $query = SupportTicket::query()->with('responder:id,username')->latest('created_at');

        if ($request->filled('status') && $request->status !== 'all') $query->where('status', $request->status);
        if ($request->filled('search')) {
            $keyword = $request->search;
            $query->where(fn ($q) => $q->where('name', 'like', "%{$keyword}%")
                ->orWhere('email', 'like', "%{$keyword}%")
                ->orWhere('subject', 'like', "%{$keyword}%"));
        }

        $tickets = $query->paginate(min(max((int) $request->get('per_page', 30), 1), 50));

        return response()->json([
            'success' => true,
            'data' => $tickets,
            'summary' => [
                'pending' => SupportTicket::where('status', 'pending')->count(),
                'in_progress' => SupportTicket::where('status', 'in_progress')->count(),
                'resolved' => SupportTicket::where('status', 'resolved')->count(),
                'closed' => SupportTicket::where('status', 'closed')->count(),
            ],
        ]);
    }

    public function reply(Request $request, int $id)
    {
        $validated = $request->validate([
            'reply_message' => ['required', 'string', 'min:5', 'max:5000'],
        ], ['reply_message.required' => 'Vui lòng nhập nội dung phản hồi.']);

        $ticket = SupportTicket::findOrFail($id);
        $customer = $ticket->user_id ? User::find($ticket->user_id) : User::where('email', $ticket->email)->first();

        $ticket->update([
            'user_id' => $customer?->id,
            'reply_message' => trim($validated['reply_message']),
            'replied_by' => $request->user()->id,
            'replied_at' => now(),
            'customer_read_at' => null,
            'status' => 'resolved',
        ]);

        if ($customer) {
            Notification::create([
                'user_id' => $customer->id,
                'title' => "Yêu cầu hỗ trợ #{$ticket->id} đã được phản hồi",
                'content' => "JDM World đã trả lời yêu cầu “{$ticket->subject}”. Mở trang Hỗ trợ để xem nội dung.",
                'is_read' => false,
            ]);
        }

        $mailSent = false;
        $mailError = null;

        try {
            Mail::to($ticket->email)->send(new SupportTicketReply($ticket->fresh(), $ticket->reply_message));
            $ticket->update(['mail_sent_at' => now()]);
            $mailSent = true;
        } catch (\Throwable $exception) {
            report($exception);
            $mailError = config('app.debug') ? $exception->getMessage() : null;
        }

        return response()->json([
            'success' => true,
            'message' => $mailSent
                ? 'Đã lưu phản hồi và gửi email cho khách hàng.'
                : 'Đã lưu phản hồi trên website; email chưa gửi được.',
            'mail_sent' => $mailSent,
            'mail_error' => $mailError,
            'data' => $ticket->fresh()->load('responder:id,username'),
        ]);
    }

    public function updateStatus(Request $request, int $id)
    {
        $validated = $request->validate(['status' => ['required', 'in:pending,in_progress,resolved,closed']]);
        $ticket = SupportTicket::findOrFail($id);
        $ticket->update($validated);
        return response()->json(['success' => true, 'data' => $ticket]);
    }
}
