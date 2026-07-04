<?php

namespace App\Http\Controllers;

use App\Models\Coupon;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function getNotifications(Request $request)
    {
        $user = $request->user();
        $this->syncPromotionNotifications($user);

        $query = Notification::query()
            ->where('user_id', $user->id)
            ->latest('created_at');

        if ($request->get('read_status') === 'read') {
            $query->where('is_read', true);
        } elseif ($request->get('read_status') === 'unread') {
            $query->where('is_read', false);
        }

        $type = $request->get('type');
        if (in_array($type, ['order', 'voucher', 'flash_sale'], true)) {
            $query->where(function ($typeQuery) use ($type) {
                $patterns = match ($type) {
                    'order' => ['%đơn hàng%', '%order%', '%thanh toán%'],
                    'voucher' => ['%voucher%', '%mã giảm%', '%ưu đãi%'],
                    'flash_sale' => ['%flash sale%', '%flash%', '%sale%'],
                };

                foreach ($patterns as $index => $pattern) {
                    $method = $index === 0 ? 'where' : 'orWhere';
                    $typeQuery->{$method}(function ($textQuery) use ($pattern) {
                        $textQuery->where('title', 'like', $pattern)->orWhere('content', 'like', $pattern);
                    });
                }
            });
        }

        $notifications = $query->paginate(min(max((int) $request->get('per_page', 20), 1), 50));

        return response()->json([
            'success' => true,
            'data' => collect($notifications->items())->map(fn ($item) => $this->formatNotification($item))->values(),
            'pagination' => [
                'total' => $notifications->total(),
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
            ],
            'unread_count' => Notification::where('user_id', $user->id)->where('is_read', false)->count(),
        ]);
    }

    public function markAsRead(Request $request, $id)
    {
        $notification = Notification::whereKey($id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $notification->update(['is_read' => true]);

        return response()->json([
            'success' => true,
            'data' => $this->formatNotification($notification->fresh()),
            'unread_count' => Notification::where('user_id', $request->user()->id)->where('is_read', false)->count(),
        ]);
    }

    public function markAllAsRead(Request $request)
    {
        Notification::where('user_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['success' => true, 'message' => 'Đã đọc tất cả thông báo.', 'unread_count' => 0]);
    }

    public function destroy(Request $request, $id)
    {
        $deleted = Notification::whereKey($id)->where('user_id', $request->user()->id)->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Không tìm thấy thông báo.'], 404);
        }

        return response()->json(['success' => true, 'message' => 'Đã xóa thông báo.']);
    }

    public function deleteAll(Request $request)
    {
        Notification::where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true, 'message' => 'Đã xóa tất cả thông báo.']);
    }

    public function unreadCount(Request $request)
    {
        $this->syncPromotionNotifications($request->user());
        $count = Notification::where('user_id', $request->user()->id)->where('is_read', false)->count();

        return response()->json(['success' => true, 'count' => $count, 'unread_count' => $count]);
    }

    private function formatNotification(Notification $notification): array
    {
        $type = $this->resolveType($notification->title . ' ' . $notification->content);

        return [
            'id' => $notification->id,
            'type' => $type,
            'title' => $notification->title ?: 'Thông báo',
            'message' => $notification->content ?: '',
            'content' => $notification->content ?: '',
            'action_url' => match ($type) {
                'order' => '/orders',
                'support' => '/faq',
                'return' => '/orders',
                'voucher', 'flash_sale' => '/products',
                default => null,
            },
            'is_read' => (bool) $notification->is_read,
            'created_at' => $notification->created_at,
        ];
    }

    private function resolveType(string $text): string
    {
        $text = mb_strtolower($text);

        return match (true) {
            str_contains($text, 'hỗ trợ'), str_contains($text, 'ticket') => 'support',
            str_contains($text, 'hoàn tiền'), str_contains($text, 'đổi hàng'), str_contains($text, 'trả hàng') => 'return',
            str_contains($text, 'flash'), str_contains($text, 'flash sale') => 'flash_sale',
            str_contains($text, 'voucher'), str_contains($text, 'mã giảm'), str_contains($text, 'ưu đãi') => 'voucher',
            str_contains($text, 'đơn hàng'), str_contains($text, 'order'), str_contains($text, 'thanh toán') => 'order',
            default => 'system',
        };
    }

    /** Create one customer notification for each currently valid coupon. */
    private function syncPromotionNotifications(User $user): void
    {
        if ($user->role !== 'customer') return;

        Coupon::query()
            ->where(function ($query) {
                $query->whereNull('expiry_date')->orWhereDate('expiry_date', '>=', now()->toDateString());
            })
            ->get()
            ->each(function (Coupon $coupon) use ($user) {
                $isFlashSale = $coupon->type === 'percent'
                    || str_contains(strtoupper($coupon->code), 'SALE')
                    || str_contains(strtoupper($coupon->code), 'FLASH');

                $title = $isFlashSale
                    ? "Flash Sale - Mã {$coupon->code}"
                    : "Voucher dành cho bạn - {$coupon->code}";

                $discount = $coupon->type === 'percent'
                    ? rtrim(rtrim((string) $coupon->discount, '0'), '.') . '%'
                    : number_format((float) $coupon->discount, 0, ',', '.') . '₫';

                Notification::firstOrCreate(
                    ['user_id' => $user->id, 'title' => $title],
                    [
                        'content' => "Nhập mã {$coupon->code} để được giảm {$discount}. Hạn dùng: " . ($coupon->expiry_date?->format('d/m/Y') ?? 'không giới hạn') . '.',
                        'is_read' => false,
                        'created_at' => now(),
                    ]
                );
            });
    }
}
