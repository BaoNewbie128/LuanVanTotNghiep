<?php

namespace App\Http\Controllers;

use App\Models\ChatRooms;
use App\Models\Messages;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ChatController extends Controller
{
    public function getRooms(Request $request)
    {
        $user = $request->user();
        $query = ChatRooms::query()->orderByDesc('created_at');

        if (in_array($user->role, ['staff', 'admin'], true)) {
            return response()->json($query->with('customer')->paginate(20));
        }

        return response()->json($query->where('customer_id', $user->id)->get());
    }

    public function createRoom(Request $request)
    {
        $user = $request->user();
        $customerId = in_array($user->role, ['staff', 'admin'], true)
            ? $request->validate(['customer_id' => 'required|integer|exists:users,id'])['customer_id']
            : $user->id;

        $room = ChatRooms::firstOrCreate(['customer_id' => $customerId], ['staff_id' => null]);

        return response()->json($room, $room->wasRecentlyCreated ? 201 : 200);
    }

    // Get or create chat room
    public function getChatRoom($customerId)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $room = ChatRooms::where('customer_id', $customerId)->first();

            if (!$room) {
                $room = ChatRooms::create([
                    'customer_id' => $customerId,
                    'staff_id' => null
                ]);
            }

            return response()->json($room, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get messages in room
    public function getMessages($roomId, Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $room = ChatRooms::findOrFail($roomId);

            // Verify user has access to this room
            if ($user->id !== $room->customer_id && $user->id !== $room->staff_id && $user->role !== 'admin') {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $messages = Messages::where('room_id', $roomId)
                ->orderBy('created_at', 'asc')
                ->paginate(50);

            return response()->json($messages, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Send message
    public function sendMessage(Request $request, $roomId = null)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $validated = $request->validate([
                'room_id' => $roomId ? 'nullable' : 'required|integer|exists:chat_rooms,id',
                'message' => 'required|string'
            ]);

            $roomId = $roomId ?: $validated['room_id'];

            $room = ChatRooms::findOrFail($roomId);

            // Verify user has access to this room
            if ($user->id !== $room->customer_id && $user->id !== $room->staff_id && $user->role !== 'admin') {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $message = Messages::create([
                'room_id' => $roomId,
                'sender_id' => $user->id,
                'message' => $validated['message']
            ]);

            return response()->json([
                'message' => 'Message sent',
                'data' => $message
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get all chat rooms (Staff/Admin)
    public function getAllChatRooms(Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user || ($user->role !== 'staff' && $user->role !== 'admin')) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $rooms = ChatRooms::with('customer')
                ->orderBy('created_at', 'desc')
                ->paginate(20);

            return response()->json($rooms, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Assign staff to chat room
    public function assignStaff(Request $request, $roomId)
    {
        try {
            $user = Auth::user();
            if (!$user || ($user->role !== 'staff' && $user->role !== 'admin')) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $room = ChatRooms::findOrFail($roomId);
            $room->update(['staff_id' => $user->id]);

            return response()->json([
                'message' => 'Staff assigned to chat room',
                'room' => $room
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Close chat room
    public function closeChatRoom($roomId)
    {
        try {
            $user = Auth::user();
            if (!$user || ($user->role !== 'staff' && $user->role !== 'admin')) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $room = ChatRooms::findOrFail($roomId);
            $room->delete();

            return response()->json(['message' => 'Chat room closed'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }
}
