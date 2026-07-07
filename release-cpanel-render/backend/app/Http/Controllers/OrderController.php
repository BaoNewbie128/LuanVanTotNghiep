<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\CartItems;
use App\Models\Product;
use App\Models\Coupon;
use App\Models\Products;
use App\Services\ValidationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\Review;
use App\Models\Notification;

class OrderController extends Controller
{
    /**
     * Create order from cart
     */
    public function createOrder(Request $request)
    {
        try {
            $user = $request->user();
            $couponCode = $request->input('coupon_code');
            $paymentMethod = $request->input('payment_method', 'cod'); // cod, momo, vnpay
            $recipientName = trim((string) ($request->input('recipient_name') ?: $user->username));
            $shippingPhone = trim((string) $request->input('phone'));
            $shippingAddress = trim((string) $request->input('address'));

            if ($shippingPhone === '' || $shippingAddress === '') {
                return response()->json([
                    'success' => false,
                    'message' => 'Vui lòng nhập đầy đủ số điện thoại và địa chỉ nhận hàng.',
                ], 422);
            }

            if (mb_strlen($shippingPhone) > 20 || mb_strlen($shippingAddress) < 5 || mb_strlen($shippingAddress) > 500) {
                return response()->json([
                    'success' => false,
                    'message' => 'Số điện thoại hoặc địa chỉ nhận hàng không hợp lệ.',
                ], 422);
            }

            // Get user's cart
            $cart = Cart::where('user_id', $user->id)->first();
            if (!$cart) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cart is empty'
                ], 422);
            }

            $cartItems = CartItems::where('cart_id', $cart->id)->with('product')->get();
            if ($cartItems->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cart is empty'
                ], 422);
            }

            // Use database transaction to ensure stock consistency
            return DB::transaction(function () use ($user, $cartItems, $couponCode, $paymentMethod, $cart, $recipientName, $shippingPhone, $shippingAddress) {
                $total = 0;
                $discount = 0;

                // Calculate total and validate stock
                foreach ($cartItems as $cartItem) {
                    $product = $cartItem->product;

                    // Lock product row for update
                    $lockedProduct = Products::lockForUpdate()->find($product->id);

                    // Check if stock is still available
                    if ($lockedProduct->stock < $cartItem->quantity) {
                        throw new \Exception("Product '{$product->model}' is out of stock. Available: {$lockedProduct->stock}, Requested: {$cartItem->quantity}");
                    }

                    $total += $cartItem->quantity * $product->price;
                }

                // Validate and apply coupon if provided
                if ($couponCode) {
                    $coupon = Coupon::where('code', $couponCode)->first();
                    
                    if (!$coupon) {
                        throw new \Exception('Invalid coupon code');
                    }

                    // Check coupon expiry
                    if ($coupon->expiry_date && $coupon->expiry_date < now()) {
                        throw new \Exception('Coupon has expired');
                    }

                    // Check if it's a student coupon
                    if (strpos($couponCode, '81') !== false) {
                        $studentValidation = ValidationService::validateStudentCoupon($couponCode);
                        if (!$studentValidation['valid']) {
                            throw new \Exception($studentValidation['message']);
                        }
                    }

                    // Calculate discount
                    if ($coupon->type === 'fixed') {
                        $discount = $coupon->discount;
                    } else if ($coupon->type === 'percent') {
                        $discount = ($total * $coupon->discount) / 100;
                    }
                }

                // Create order
                $order = Order::create([
                    'user_id' => $user->id,
                    'recipient_name' => $recipientName,
                    'shipping_phone' => $shippingPhone,
                    'shipping_address' => $shippingAddress,
                    'total' => $total,
                    'discount' => $discount,
                    'shipping_fee' => 0,
                    'status' => $paymentMethod === 'cod' ? 'cod_pending' : 'pending_payment'
                ]);

                Notification::create([
                    'user_id' => $user->id,
                    'title' => "Đơn hàng #{$order->id} đã được tạo",
                    'content' => $paymentMethod === 'cod'
                        ? 'Đơn hàng đang chờ cửa hàng xác nhận và chuẩn bị giao.'
                        : 'Đơn hàng đang chờ hoàn tất thanh toán.',
                    'is_read' => false,
                ]);

                // Create order items and update stock
                foreach ($cartItems as $cartItem) {
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $cartItem->product_id,
                        'quantity' => $cartItem->quantity,
                        'price' => $cartItem->product->price
                    ]);

                    // Deduct from stock
                    Products::where('id', $cartItem->product_id)
                        ->decrement('stock', $cartItem->quantity);
                }

                // Clear cart
                CartItems::where('cart_id', $cart->id)->delete();

                return response()->json([
                    'success' => true,
                    'message' => 'Order created successfully',
                    'data' => [
                        'order_id' => $order->id,
                        'total' => $order->total,
                        'discount' => $order->discount,
                        'final_total' => $order->total - $order->discount,
                        'status' => $order->status,
                        'payment_method' => $paymentMethod
                    ]
                ]);
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 422);
        }
    }

    /**
     * Get user's orders
     */
    public function getOrders(Request $request)
    {
        try {
            $user = $request->user();
            $status = $request->input('status');

            $query = Order::where('user_id', $user->id);

            if ($status) {
                $query->where('status', $status);
            }

            $orders = $query->orderBy('created_at', 'desc')
                ->with(['items.product', 'shipment', 'returnRequests'])
                ->paginate(min((int) $request->input('per_page', 50), 100));

            $reviewsByProduct = Review::where('user_id', $user->id)
                ->whereIn('product_id', $orders->getCollection()
                    ->flatMap(fn ($order) => $order->items->pluck('product_id'))
                    ->unique())
                ->with('images')
                ->get()
                ->keyBy('product_id');

            $orders->getCollection()->each(function ($order) use ($reviewsByProduct) {
                $order->setAttribute('can_return', $order->status === 'completed' && $order->returnRequests->isEmpty());
                $order->items->each(function ($item) use ($order, $reviewsByProduct) {
                    $review = $reviewsByProduct->get($item->product_id);
                    $item->setAttribute('can_review', $order->status === 'completed' && !$review);
                    $item->setRelation('review', $review);
                });
            });

            return response()->json([
                'success' => true,
                'data' => $orders
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch orders: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get order detail
     */
    public function getOrderDetail(Request $request, $orderId)
    {
        try {
            $user = $request->user();

            $order = Order::where('id', $orderId)
                ->where('user_id', $user->id)
                ->with([
                    'items.product',
                    'user:id,username,phone,address',
                ])
                ->first();

            if (!$order) {
                return response()->json([
                    'success' => false,
                    'message' => 'Order not found'
                ], 404);
            }

            return response()->json([
                'success' => true,
                'data' => $order
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch order: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Cancel order
     */
    public function cancelOrder(Request $request, $orderId)
    {
        try {
            $user = $request->user();

            return DB::transaction(function () use ($user, $orderId) {
                $order = Order::where('id', $orderId)
                    ->where('user_id', $user->id)
                    ->lockForUpdate()
                    ->first();

                if (!$order) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Order not found'
                    ], 404);
                }

                if (!in_array($order->status, ['pending', 'cod_pending', 'pending_payment'])) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Cannot cancel order with status: ' . $order->status
                    ], 422);
                }

                $orderItems = OrderItem::where('order_id', $order->id)->get();

                foreach ($orderItems as $item) {
                    $product = Products::where('id', $item->product_id)
                        ->lockForUpdate()
                        ->first();

                    if ($product) {
                        $product->increment('stock', $item->quantity);
                    }
                }

                $order->update(['status' => 'cancelled']);

                return response()->json([
                    'success' => true,
                    'message' => 'Order cancelled successfully'
                ]);
            });
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to cancel order: ' . $e->getMessage()
            ], 500);
        }
    }
}
