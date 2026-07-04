<?php

namespace App\Http\Controllers;

use App\Models\Wishlist;
use App\Models\Products;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Session;
use Laravel\Sanctum\PersonalAccessToken;

class WishlistController extends Controller
{
    /**
     * Resolve authenticated user even when wishlist routes are public for guests.
     * Public routes are needed so guests can store wishlist in Session, while
     * Bearer token requests should still be treated as authenticated users.
     */
    private function currentUser(Request $request = null)
    {
        $request = $request ?: request();

        if ($request->user()) {
            return $request->user();
        }

        if (Auth::check()) {
            return Auth::user();
        }

        $token = $request->bearerToken();
        if ($token) {
            $accessToken = PersonalAccessToken::findToken($token);
            if ($accessToken && $accessToken->tokenable) {
                return $accessToken->tokenable;
            }
        }

        return null;
    }

    /**
     * Get user's wishlist
     */
    public function getWishlist(Request $request)
    {
        try {
            $user = $this->currentUser($request);

            if (!$user) {
                $guestWishlist = Session::get('guest_wishlist', []);
                $productIds = collect($guestWishlist)->pluck('product_id')->unique()->values();

                $products = Products::whereIn('id', $productIds)->get()->keyBy('id');
                $items = collect($guestWishlist)
                    ->unique('product_id')
                    ->map(function ($item) use ($products) {
                        $product = $products->get($item['product_id']);
                        if (!$product) {
                            return null;
                        }

                        return [
                            'id' => null,
                            'product_id' => $product->id,
                            'product' => $product,
                            'created_at' => $item['added_at'] ?? null,
                            'is_guest' => true,
                        ];
                    })
                    ->filter()
                    ->values();

                return response()->json([
                    'success' => true,
                    'data' => $items,
                    'count' => $items->count(),
                    'is_guest' => true,
                ]);
            }

            $perPage = $request->get('per_page', 12);

            $wishlist = Wishlist::where('user_id', $user->id)
                ->with('product')
                ->orderBy('created_at', 'desc')
                ->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $wishlist->items(),
                'count' => $wishlist->total(),
                'is_guest' => false,
                'pagination' => [
                    'total' => $wishlist->total(),
                    'per_page' => $wishlist->perPage(),
                    'current_page' => $wishlist->currentPage(),
                    'last_page' => $wishlist->lastPage()
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error fetching wishlist: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Add product to wishlist
     */
    public function addToWishlist(Request $request)
    {
        try {
            $user = $this->currentUser($request);

            $request->validate([
                'product_id' => 'required|integer',
            ]);

            $productId = (int) $request->input('product_id');

            // Check if product exists
            $product = Products::find($productId);
            if (!$product || !$product->is_active || $product->deleted_at !== null) {
                return response()->json(['error' => 'Product not found'], 404);
            }

            if (!$user) {
                $guestWishlist = Session::get('guest_wishlist', []);

                foreach ($guestWishlist as $item) {
                    if ((int) $item['product_id'] === $productId) {
                        return response()->json([
                            'success' => true,
                            'message' => 'Product already in guest wishlist',
                            'is_guest' => true,
                            'count' => count($guestWishlist),
                        ]);
                    }
                }

                $guestWishlist[] = [
                    'product_id' => $productId,
                    'added_at' => now()->toDateTimeString(),
                ];

                Session::put('guest_wishlist', $guestWishlist);

                return response()->json([
                    'success' => true,
                    'message' => 'Product added to guest wishlist',
                    'is_guest' => true,
                    'count' => count($guestWishlist),
                ], 201);
            }

            // Check if already in wishlist
            $existing = Wishlist::where('user_id', $user->id)
                ->where('product_id', $productId)
                ->first();

            if ($existing) {
                return response()->json([
                    'success' => true,
                    'message' => 'Product already in wishlist',
                    'data' => $existing,
                ]);
            }

            $wishlist = Wishlist::create([
                'user_id' => $user->id,
                'product_id' => $productId
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Product added to wishlist',
                'data' => $wishlist
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error adding to wishlist: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Remove product from wishlist
     */
    public function removeFromWishlist(Request $request, $productId)
    {
        try {
            $user = $this->currentUser($request);
            $productId = (int) $productId;

            if (!$user) {
                $guestWishlist = Session::get('guest_wishlist', []);
                $guestWishlist = array_values(array_filter($guestWishlist, function ($item) use ($productId) {
                    return (int) $item['product_id'] !== $productId;
                }));

                Session::put('guest_wishlist', $guestWishlist);

                return response()->json([
                    'success' => true,
                    'message' => 'Product removed from guest wishlist',
                    'is_guest' => true,
                    'count' => count($guestWishlist),
                ]);
            }

            $wishlist = Wishlist::where('user_id', $user->id)
                ->where('product_id', $productId)
                ->first();

            if (!$wishlist) {
                return response()->json(['error' => 'Wishlist item not found'], 404);
            }

            $wishlist->delete();

            return response()->json([
                'success' => true,
                'message' => 'Product removed from wishlist'
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error removing from wishlist: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Check if product is in wishlist
     */
    public function check(Request $request, $productId)
    {
        try {
            $user = $this->currentUser($request);

            if (!$user) {
                $guestWishlist = Session::get('guest_wishlist', []);
                $inWishlist = collect($guestWishlist)->contains(function ($item) use ($productId) {
                    return (int) $item['product_id'] === (int) $productId;
                });

                return response()->json([
                    'success' => true,
                    'in_wishlist' => $inWishlist,
                    'is_guest' => true,
                ]);
            }

            $inWishlist = Wishlist::where('user_id', $user->id)
                ->where('product_id', $productId)
                ->exists();

            return response()->json([
                'success' => true,
                'in_wishlist' => $inWishlist
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error checking wishlist: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get wishlist count
     */
    public function count(Request $request)
    {
        try {
            $user = $this->currentUser($request);

            if (!$user) {
                return response()->json([
                    'success' => true,
                    'count' => count(Session::get('guest_wishlist', [])),
                    'is_guest' => true,
                ]);
            }

            $count = Wishlist::where('user_id', $user->id)->count();

            return response()->json([
                'success' => true,
                'count' => $count
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error getting wishlist count: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Remove product from wishlist by product ID
     */
    public function removeByProductId($productId)
    {
        return $this->removeFromWishlist(request(), $productId);
    }

    /**
     * Merge guest wishlist to authenticated user's DB wishlist.
     */
    public function mergeGuestWishlist(Request $request)
    {
        try {
            $user = $this->currentUser($request);

            if (!$user) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            $guestWishlist = $request->input('guest_wishlist', Session::get('guest_wishlist', []));

            if (empty($guestWishlist)) {
                return response()->json([
                    'success' => true,
                    'message' => 'No guest wishlist to merge',
                    'merged_count' => 0,
                ]);
            }

            $mergedCount = $this->mergeGuestWishlistForUser($user, $guestWishlist);
            Session::forget('guest_wishlist');

            return response()->json([
                'success' => true,
                'message' => 'Wishlist merged successfully',
                'merged_count' => $mergedCount,
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error merging wishlist: ' . $e->getMessage()], 500);
        }
    }

    public static function mergeGuestWishlistForUser($user, array $guestWishlist): int
    {
        return DB::transaction(function () use ($user, $guestWishlist) {
            $mergedCount = 0;

            foreach ($guestWishlist as $guestItem) {
                $productId = (int) ($guestItem['product_id'] ?? 0);
                if ($productId <= 0 || !Products::where('id', $productId)->exists()) {
                    continue;
                }

                $wishlist = Wishlist::firstOrCreate([
                    'user_id' => $user->id,
                    'product_id' => $productId,
                ]);

                if ($wishlist->wasRecentlyCreated) {
                    $mergedCount++;
                }
            }

            return $mergedCount;
        });
    }
}
