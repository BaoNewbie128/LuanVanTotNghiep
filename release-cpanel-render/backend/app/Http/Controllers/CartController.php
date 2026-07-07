<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\CartItems;
use App\Models\Product;
use App\Models\Products;
use App\Services\ValidationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;

class CartController extends Controller
{
    /**
     * Get user's cart with items
     */
    public function getCart(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                    'debug_user_id' => null
                ], 401);
            }
            
            $cart = Cart::where('user_id', $user->id)->first();

            // Debug: return user_id
            \Illuminate\Support\Facades\Log::info('getCart', ['user_id' => $user->id, 'cart_id' => $cart ? $cart->id : null]);

            if (!$cart) {
                return response()->json([
                    'success' => true,
                    'data' => [
                        'id' => null,
                        'items' => [],
                        'total' => 0,
                        'itemCount' => 0
                    ]
                ]);
            }

            $items = CartItems::where('cart_id', $cart->id)
                ->with('product')
                ->get()
                ->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'product_id' => $item->product_id,
                        'product' => [
                            'id' => $item->product->id,
                            'model' => $item->product->model,
                            'brand' => $item->product->brand,
                            'price' => $item->product->price,
                            'image' => $item->product->image,
                            'stock' => $item->product->stock,
                        ],
                        'quantity' => $item->quantity,
                        'subtotal' => $item->quantity * $item->product->price
                    ];
                });

            $total = $items->sum('subtotal');

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $cart->id,
                    'items' => $items,
                    'total' => $total,
                    'itemCount' => $items->count()
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch cart: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add item to cart (for Guest users - stores in session)
     */
    public function addToCartGuest(Request $request)
    {
        try {
            $productId = $request->input('product_id');
            $quantity = $request->input('quantity', 1);

            // Validate quantity
            $quantityValidation = ValidationService::validateNumeric($quantity, 1, null, false);
            if (!$quantityValidation['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => $quantityValidation['message']
                ], 422);
            }

            // Get product
            $product = Products::find($productId);
            if (!$product) {
                return response()->json([
                    'success' => false,
                    'message' => 'Product not found'
                ], 404);
            }

            // Validate stock availability
            $stockValidation = ValidationService::validateCartQuantity($quantity, $product->stock);
            if (!$stockValidation['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => $stockValidation['message']
                ], 422);
            }

            // Get or create guest cart from session
            $guestCart = Session::get('guest_cart', []);
            
            // Check if item already in cart
            $existingIndex = null;
            foreach ($guestCart as $index => $item) {
                if ($item['product_id'] == $productId) {
                    $existingIndex = $index;
                    break;
                }
            }

            if ($existingIndex !== null) {
                $newQuantity = $guestCart[$existingIndex]['quantity'] + $quantity;
                
                // Validate new quantity doesn't exceed stock
                $stockValidation = ValidationService::validateCartQuantity($newQuantity, $product->stock);
                if (!$stockValidation['valid']) {
                    return response()->json([
                        'success' => false,
                        'message' => $stockValidation['message']
                    ], 422);
                }

                $guestCart[$existingIndex]['quantity'] = $newQuantity;
            } else {
                $guestCart[] = [
                    'product_id' => $productId,
                    'quantity' => $quantity,
                    'added_at' => now()->toDateTimeString()
                ];
            }

            Session::put('guest_cart', $guestCart);

            return response()->json([
                'success' => true,
                'message' => 'Product added to cart. Please login to continue.',
                'redirect' => '/login',
                'require_login' => true
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to add to cart: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Merge guest cart to user cart after login
     */
    public function mergeGuestCart(Request $request)
    {
        try {
            $user = $request->user();
            
            // Support both session (for same-origin) and request body (for cross-origin)
            $guestCart = $request->input('guest_cart', Session::get('guest_cart', []));

            if (empty($guestCart)) {
                return response()->json([
                    'success' => true,
                    'message' => 'No guest cart to merge'
                ]);
            }

            // Get or create user cart
            $cart = Cart::firstOrCreate(['user_id' => $user->id]);

            foreach ($guestCart as $guestItem) {
                $productId = $guestItem['product_id'];
                $quantity = $guestItem['quantity'];

                // Get product
                $product = Products::find($productId);
                if (!$product) {
                    continue;
                }

                // Check if item already in cart
                $cartItem = CartItems::where('cart_id', $cart->id)
                    ->where('product_id', $productId)
                    ->first();

                if ($cartItem) {
                    $newQuantity = $cartItem->quantity + $quantity;
                    
                    // Validate new quantity doesn't exceed stock
                    $stockValidation = ValidationService::validateCartQuantity($newQuantity, $product->stock);
                    if ($stockValidation['valid']) {
                        $cartItem->update(['quantity' => $newQuantity]);
                    }
                } else {
                    // Validate stock before adding
                    $stockValidation = ValidationService::validateCartQuantity($quantity, $product->stock);
                    if ($stockValidation['valid']) {
                        CartItems::create([
                            'cart_id' => $cart->id,
                            'product_id' => $productId,
                            'quantity' => $quantity
                        ]);
                    }
                }
            }

            // Clear guest cart from session
            Session::forget('guest_cart');

            return response()->json([
                'success' => true,
                'message' => 'Cart merged successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to merge cart: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add item to cart (for authenticated users)
     */
    public function addToCart(Request $request)
    {
        try {
            $user = $request->user();
            
            if (!$user || !$user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated'
                ], 401);
            }
            
            $productId = $request->input('product_id');
            $quantity = $request->input('quantity', 1);

            // Validate quantity
            $quantityValidation = ValidationService::validateNumeric($quantity, 1, null, false);
            if (!$quantityValidation['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => $quantityValidation['message']
                ], 422);
            }

            // Get product
            $product = Products::find($productId);
            if (!$product) {
                return response()->json([
                    'success' => false,
                    'message' => 'Product not found'
                ], 404);
            }

            // Validate stock availability
            $stockValidation = ValidationService::validateCartQuantity($quantity, $product->stock);
            if (!$stockValidation['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => $stockValidation['message']
                ], 422);
            }

            // Use transaction to ensure data integrity
            DB::beginTransaction();
            
            try {
                // Get or create cart
                $cart = Cart::firstOrCreate(
                    ['user_id' => $user->id],
                    ['user_id' => $user->id]
                );
                
                // Refresh to get latest data
                $cart->refresh();
                
                // Check if item already in cart
                $cartItem = CartItems::where('cart_id', $cart->id)
                    ->where('product_id', $productId)
                    ->first();

                if ($cartItem) {
                    $newQuantity = $cartItem->quantity + $quantity;
                    
                    // Validate new quantity doesn't exceed stock
                    $stockValidation = ValidationService::validateCartQuantity($newQuantity, $product->stock);
                    if (!$stockValidation['valid']) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => $stockValidation['message']
                        ], 422);
                    }

                    $cartItem->update(['quantity' => $newQuantity]);
                } else {
                    CartItems::create([
                        'cart_id' => $cart->id,
                        'product_id' => $productId,
                        'quantity' => $quantity
                    ]);
                }
                
                DB::commit();
                
                return response()->json([
                    'success' => true,
                    'message' => 'Product added to cart successfully'
                ]);
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to add to cart: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update cart item quantity
     */
    public function updateCartItem(Request $request, $itemId)
    {
        try {
            $user = $request->user();
            $quantity = $request->input('quantity');

            // Validate quantity
            $quantityValidation = ValidationService::validateNumeric($quantity, 1, null, false);
            if (!$quantityValidation['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => $quantityValidation['message']
                ], 422);
            }

            // Get cart item
            $cartItem = CartItems::find($itemId);
            if (!$cartItem) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cart item not found'
                ], 404);
            }

            // Verify ownership
            $cart = Cart::find($cartItem->cart_id);
            if ($cart->user_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            // Get product and validate stock
            $product = Products::find($cartItem->product_id);
            $stockValidation = ValidationService::validateCartQuantity($quantity, $product->stock);
            if (!$stockValidation['valid']) {
                return response()->json([
                    'success' => false,
                    'message' => $stockValidation['message']
                ], 422);
            }

            $cartItem->update(['quantity' => $quantity]);

            return response()->json([
                'success' => true,
                'message' => 'Cart item updated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to update cart item: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove item from cart
     */
    public function removeFromCart(Request $request, $itemId)
    {
        try {
            $user = $request->user();

            $cartItem = CartItems::find($itemId);
            if (!$cartItem) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cart item not found'
                ], 404);
            }

            // Verify ownership
            $cart = Cart::find($cartItem->cart_id);
            if ($cart->user_id !== $user->id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }

            $cartItem->delete();

            return response()->json([
                'success' => true,
                'message' => 'Item removed from cart'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to remove item: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Clear entire cart
     */
    public function clearCart(Request $request)
    {
        try {
            $user = $request->user();
            $cart = Cart::where('user_id', $user->id)->first();

            if ($cart) {
                CartItems::where('cart_id', $cart->id)->delete();
            }

            return response()->json([
                'success' => true,
                'message' => 'Cart cleared successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to clear cart: ' . $e->getMessage()
            ], 500);
        }
    }
}
