<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use Illuminate\Http\Request;

class SupportTicketController extends Controller
{
    /** Tickets belonging to the signed-in customer, including replies. */
    public function mine(Request $request)
    {
        $user = $request->user();

        $tickets = SupportTicket::query()
            ->where(function ($query) use ($user) {
                $query->where('user_id', $user->id)->orWhere('email', $user->email);
            })
            ->latest('created_at')
            ->get();

        SupportTicket::whereNull('user_id')->where('email', $user->email)->update(['user_id' => $user->id]);
        SupportTicket::where('user_id', $user->id)->whereNotNull('reply_message')->whereNull('customer_read_at')->update(['customer_read_at' => now()]);

        return response()->json(['success' => true, 'data' => $tickets]);
    }
}
