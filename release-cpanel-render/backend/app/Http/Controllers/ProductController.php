<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\Products;
use App\Models\Review;
use App\Models\Wishlist;
use App\Services\ValidationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
class ProductController extends Controller
{
    protected $validationService;

    public function __construct(ValidationService $validationService)
    {
        $this->validationService = $validationService;
    }

    private function currentUser(Request $request)
    {
        if ($request->user()) {
            return $request->user();
        }

        $token = $request->bearerToken();
        if ($token) {
            $accessToken = PersonalAccessToken::findToken($token);
            return $accessToken?->tokenable;
        }

        return null;
    }

    private function attachWishlistFlag($products, Request $request)
    {
        $user = $this->currentUser($request);
        $wishedIds = collect();

        if ($user) {
            $wishedIds = Wishlist::where('user_id', $user->id)->pluck('product_id');
        }

        return collect($products)->map(function ($product) use ($wishedIds) {
            $product->is_wished = $wishedIds->contains($product->id);
            return $product;
        })->values();
    }

    private function productListQuery(): Builder
    {
        return Products::query()
            ->where('is_active', 1)
            ->where('deleted_at', null)
            ->withAvg('reviews', 'rating')
            ->withCount('reviews');
    }

    /**
     * Get all products with filters
     */
    public function index(Request $request)
    {
        try {
            $query = $this->productListQuery();

            // Brand filter
            if ($request->has('brand')) {
                $query->where('brand', $request->brand);
            }

            // Flexible multi-keyword search across catalog fields, price and scale.
            $search = trim((string) $request->input('model', $request->input('search', '')));
            if ($search !== '') {
                $this->applyFlexibleSearch($query, $search);
            }

            // Color filter
            if ($request->has('color')) {
                $query->where('color', 'like', '%' . $request->color . '%');
            }

            // Price range filter
            if ($request->has('min_price')) {
                $validated = $this->validationService->validateNumeric($request->min_price, 'min_price', true);
                if (!$validated['valid']) {
                    return response()->json(['error' => $validated['errors']], 422);
                }
                $query->where('price', '>=', $request->min_price);
            }

            if ($request->has('max_price')) {
                $validated = $this->validationService->validateNumeric($request->max_price, 'max_price', true);
                if (!$validated['valid']) {
                    return response()->json(['error' => $validated['errors']], 422);
                }
                $query->where('price', '<=', $request->max_price);
            }

            // Sorting
           // Sorting
$sortBy = $request->get('sort_by', 'newest');

switch ($sortBy) {
    case 'price-low':
        $query->orderBy('price', 'asc');
        break;

    case 'price-high':
        $query->orderBy('price', 'desc');
        break;

    case 'popular':
        $query->orderBy('sold_count', 'desc');
        break;

    case 'newest':
    default:
        $query->orderBy('created_at', 'desc');
        break;
}

            // Pagination
            $perPage = $request->get('per_page', 12);
            $products = $query->paginate($perPage);

            return response()->json([
                'success' => true,
                'data' => $this->attachWishlistFlag($products->items(), $request),
                'pagination' => [
                    'total' => $products->total(),
                    'per_page' => $products->perPage(),
                    'current_page' => $products->currentPage(),
                    'last_page' => $products->lastPage()
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error fetching products: ' . $e->getMessage()], 500);
        }
    }

    private function applyFlexibleSearch(Builder $query, string $search): void
    {
        $normalized = (string) Str::of(Str::ascii(Str::lower($search)))
            ->replaceMatches('/[^a-z0-9:.,\/\-\s]/', ' ')
            ->squish();

        $rawTokens = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $ignoredWords = [
            'gia', 'vnd', 'vnđ', 'd',
            'ti', 'ty', 'le', 'scale', 'tyle',
            'xe', 'hang', 'model', 'mau', 'color',
        ];
        $thousandUnits = ['k', 'nghin'];
        $millionUnits = ['m', 'trieu'];
        $criteria = [];

        for ($index = 0; $index < count($rawTokens); $index++) {
            $token = trim($rawTokens[$index], '.,');
            if ($token === '' || in_array($token, $ignoredWords, true)) {
                continue;
            }

            $nextToken = $rawTokens[$index + 1] ?? null;
            if (preg_match('/^(\d+(?:[.,]\d+)?)(k|m)$/', $token, $matches)) {
                $multiplier = $matches[2] === 'm' ? 1_000_000 : 1_000;
                $criteria[] = ['type' => 'price', 'value' => (float) str_replace(',', '.', $matches[1]) * $multiplier];
                continue;
            }

            if (is_numeric(str_replace(',', '.', $token)) && $nextToken
                && (in_array($nextToken, $thousandUnits, true) || in_array($nextToken, $millionUnits, true))) {
                $multiplier = in_array($nextToken, $millionUnits, true) ? 1_000_000 : 1_000;
                $criteria[] = ['type' => 'price', 'value' => (float) str_replace(',', '.', $token) * $multiplier];
                $index++;
                continue;
            }

            if (preg_match('/^\d{1,3}(?:[.,]\d{3})+$/', $token)) {
                $criteria[] = ['type' => 'price', 'value' => (float) str_replace(['.', ','], '', $token)];
                continue;
            }

            if (ctype_digit($token) && (int) $token >= 1000) {
                $criteria[] = ['type' => 'number', 'value' => $token];
                continue;
            }

            $criteria[] = ['type' => 'text', 'value' => $token];
        }

        foreach ($criteria as $criterion) {
            if ($criterion['type'] === 'price') {
                $query->where('price', $criterion['value']);
                continue;
            }

            if ($criterion['type'] === 'number') {
                $number = $criterion['value'];
                $query->where(function (Builder $numberQuery) use ($number) {
                    $like = "%{$number}%";
                    $numberQuery->where('price', (float) $number)
                        ->orWhere('brand', 'like', $like)
                        ->orWhere('model', 'like', $like)
                        ->orWhere('scale', 'like', $like)
                        ->orWhere('description', 'like', $like);
                });
                continue;
            }

            $token = $criterion['value'];
            $scaleVariant = str_replace('/', ':', $token);
            $compactToken = str_replace(['-', ' ', '/', ':'], '', $token);

            $query->where(function (Builder $keywordQuery) use ($token, $scaleVariant, $compactToken) {
                $like = "%{$token}%";
                $keywordQuery
                    ->where('brand', 'like', $like)
                    ->orWhere('model', 'like', $like)
                    ->orWhere('color', 'like', $like)
                    ->orWhere('scale', 'like', "%{$scaleVariant}%")
                    ->orWhere('description', 'like', $like)
                    ->orWhereRaw('CAST(price AS CHAR) LIKE ?', [$like]);

                if ($compactToken !== '') {
                    foreach (['brand', 'model', 'color', 'scale'] as $field) {
                        $keywordQuery->orWhereRaw(
                            "LOWER(REPLACE(REPLACE(REPLACE({$field}, '-', ''), '/', ''), ':', '')) LIKE ?",
                            ["%{$compactToken}%"]
                        );
                    }
                }
            });
        }
    }

    /** Compatibility endpoint for clients using /products/search/filter. */
    public function filter(Request $request)
    {
        return $this->index($request);
    }

    /**
     * Get product details with reviews and recommendations
     */
    public function show(Request $request, $id)
    {
        try {
            $product = Products::with(['reviews' => function($q) {
                $q->with(['user', 'images'])->orderBy('created_at', 'desc');
            }])->find($id);

            if (!$product || $product->deleted_at !== null || !$product->is_active) {
                return response()->json(['error' => 'Product not found'], 404);
            }

            $user = $this->currentUser($request);
            $product->is_wished = $user
                ? Wishlist::where('user_id', $user->id)->where('product_id', $product->id)->exists()
                : false;

            // Get color variants (same brand, model, scale)
            $colorVariants = Products::where('brand', $product->brand)
                ->where('model', $product->model)
                ->where('scale', $product->scale)
                ->where('is_active', 1)
                ->where('deleted_at', null)
                ->select('id', 'color', 'price', 'stock', 'image')
                ->orderBy('color')
                ->get();

            // Get related products (same brand, different model)
            $relatedProducts = Products::where('brand', $product->brand)
                ->where('id', '!=', $id)
                ->where('is_active', 1)
                ->where('deleted_at', null)
                ->limit(5)
                ->get();

            // Get average rating
            $avgRating = Review::where('product_id', $id)->avg('rating') ?? 0;
            $reviewCount = Review::where('product_id', $id)->count();

            $recommendations = $this->buildRecommendations($product, 8);
            $this->logRecommendations($user?->id, $recommendations);

            return response()->json([
                'success' => true,
                'product' => $product,
                'color_variants' => $colorVariants,
                'avg_rating' => round($avgRating, 1),
                'review_count' => $reviewCount,
                'related_products' => $relatedProducts,
                'recommendations' => $recommendations,
                'recommendations_meta' => [
                    'strategy' => 'collaborative_with_catalog_fallback',
                    'title' => 'Khách hàng mua mô hình này cũng mua...',
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error fetching product: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Search products with autocomplete
     */
    public function search(Request $request)
    {
        try {
            $keyword = $request->get('keyword', '');

            if (empty($keyword) || strlen($keyword) < 2) {
                return response()->json(['data' => []]);
            }

            // Validate keyword
            $validated = $this->validationService->validateString($keyword, 'keyword', true);
            if (!$validated['valid']) {
                return response()->json(['error' => $validated['errors']], 422);
            }

            $results = $this->productListQuery()
                ->where(function ($query) use ($keyword) {
                    $query->where('model', 'like', '%' . $keyword . '%')
                        ->orWhere('brand', 'like', '%' . $keyword . '%')
                        ->orWhere('color', 'like', '%' . $keyword . '%')
                        ->orWhere('description', 'like', '%' . $keyword . '%');
                })
                ->select('id', 'brand', 'model', 'color', 'price', 'image')
                ->limit(10)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $results
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Search error: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get available filters for frontend
     */
    public function getFilters()
    {
        try {
            $brands = Products::where('is_active', 1)
                ->where('deleted_at', null)
                ->distinct()
                ->pluck('brand')
                ->values();

            $colors = Products::where('is_active', 1)
                ->where('deleted_at', null)
                ->distinct()
                ->pluck('color')
                ->values();

            $priceRange = Products::where('is_active', 1)
                ->where('deleted_at', null)
                ->selectRaw('MIN(price) as min_price, MAX(price) as max_price')
                ->first();

            return response()->json([
                'success' => true,
                'brands' => $brands,
                'colors' => $colors,
                'price_range' => $priceRange,
                'total_products' => Products::where('is_active', 1)->whereNull('deleted_at')->count(),
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error fetching filters: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get color variants for a product (same brand, model, scale)
     */
    public function getColorVariants(Request $request, $id)
    {
        try {
            // Get the base product
            $product = Products::find($id);
            
            if (!$product || $product->deleted_at !== null || !$product->is_active) {
                return response()->json(['error' => 'Product not found'], 404);
            }

            // Find all variants with same brand, model, and scale
            $variants = $this->productListQuery()
                ->where('brand', $product->brand)
                ->where('model', $product->model)
                ->where('scale', $product->scale)
                ->select('id', 'color', 'price', 'stock', 'image')
                ->orderBy('color')
                ->get();

            return response()->json([
                'success' => true,
                'base_product' => [
                    'id' => $product->id,
                    'brand' => $product->brand,
                    'model' => $product->model,
                    'scale' => $product->scale,
                    'price' => $product->price,
                    'color' => $product->color,
                    'image' => $product->image,
                    'stock' => $product->stock,
                ],
                'variants' => $variants
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error fetching variants: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Products purchased by customers who also purchased the current product.
     */
    public function getRecommendations(Request $request, $id)
    {
        $product = Products::query()
            ->whereKey($id)
            ->where('is_active', 1)
            ->whereNull('deleted_at')
            ->first();

        if (!$product) {
            return response()->json(['message' => 'Không tìm thấy sản phẩm.'], 404);
        }

        $recommendations = $this->buildRecommendations($product, 8);
        $this->logRecommendations($this->currentUser($request)?->id, $recommendations);

        return response()->json([
            'success' => true,
            'data' => $recommendations,
            'meta' => [
                'product_id' => $product->id,
                'strategy' => 'collaborative_with_catalog_fallback',
            ],
        ]);
    }

    private function buildRecommendations(Products $product, int $limit)
    {
        $validStatuses = ['paid', 'shipping', 'completed'];

        $buyerIds = DB::table('order_items as purchased_item')
            ->join('orders as purchased_order', 'purchased_order.id', '=', 'purchased_item.order_id')
            ->where('purchased_item.product_id', $product->id)
            ->whereIn('purchased_order.status', $validStatuses)
            ->distinct()
            ->pluck('purchased_order.user_id');

        $scores = collect();

        if ($buyerIds->isNotEmpty()) {
            $scores = DB::table('order_items as candidate_item')
                ->join('orders as candidate_order', 'candidate_order.id', '=', 'candidate_item.order_id')
                ->whereIn('candidate_order.user_id', $buyerIds)
                ->whereIn('candidate_order.status', $validStatuses)
                ->where('candidate_item.product_id', '!=', $product->id)
                ->selectRaw('candidate_item.product_id, COUNT(DISTINCT candidate_order.user_id) as buyer_count, COUNT(DISTINCT candidate_order.id) as order_count, SUM(candidate_item.quantity) as quantity_count')
                ->groupBy('candidate_item.product_id')
                ->orderByDesc('buyer_count')
                ->orderByDesc('order_count')
                ->orderByDesc('quantity_count')
                ->limit($limit)
                ->get();
        }

        $productsById = Products::query()
            ->whereIn('id', $scores->pluck('product_id'))
            ->where('is_active', 1)
            ->whereNull('deleted_at')
            ->withAvg('reviews', 'rating')
            ->withCount('reviews')
            ->get()
            ->keyBy('id');

        $results = $scores->map(function ($score) use ($productsById) {
            $item = $productsById->get($score->product_id);
            if (!$item) return null;

            $item->setAttribute('recommendation_score', (float) $score->buyer_count * 3 + (float) $score->order_count + (float) $score->quantity_count * .25);
            $item->setAttribute('recommendation_reason', 'Khách đã mua sản phẩm này cũng lựa chọn');
            $item->setAttribute('recommendation_source', 'customer_purchases');
            return $item;
        })->filter()->values();

        $excludedIds = $results->pluck('id')->push($product->id)->all();
        $remaining = $limit - $results->count();

        if ($remaining > 0) {
            $fallback = Products::query()
                ->where('is_active', 1)
                ->whereNull('deleted_at')
                ->whereNotIn('id', $excludedIds)
                ->where(function ($query) use ($product) {
                    $query->where('brand', $product->brand)
                        ->orWhere('scale', $product->scale);
                })
                ->withAvg('reviews', 'rating')
                ->withCount('reviews')
                ->orderByDesc('sold_count')
                ->orderByDesc('reviews_avg_rating')
                ->limit($remaining)
                ->get()
                ->each(function ($item) {
                    $item->setAttribute('recommendation_score', 1);
                    $item->setAttribute('recommendation_reason', 'Cùng hãng hoặc cùng tỷ lệ mô hình');
                    $item->setAttribute('recommendation_source', 'catalog_similarity');
                });

            $results = $results->concat($fallback)->values();
        }

        return $results;
    }

    private function logRecommendations(?int $userId, $recommendations): void
    {
        if (!$userId || $recommendations->isEmpty()) return;

        DB::table('recommendation_logs')->insert(
            $recommendations->map(fn ($item) => [
                'user_id' => $userId,
                'product_id' => $item->id,
                'score' => $item->recommendation_score ?? 0,
                'created_at' => now(),
            ])->all()
        );
    }

    public function getReviews($id)
    {
        try {
            $product = Products::query()
                ->where('id', $id)
                ->where('is_active', 1)
                ->where('deleted_at', null)
                ->first();

            if (!$product) {
                return response()->json(['error' => 'Product not found'], 404);
            }

            $reviews = Review::query()
                ->where('product_id', $id)
                ->with(['user:id,username', 'images'])
                ->orderByDesc('created_at')
                ->get()
                ->map(function ($review) {
                    return [
                        'id' => $review->id,
                        'rating' => $review->rating,
                        'comment' => $review->comment,
                        'created_at' => $review->created_at,
                        'images' => $review->images->map(fn ($image) => [
                            'id' => $image->id,
                            'image_url' => $image->image_url,
                        ]),
                        'user' => [
                            'id' => $review->user?->id,
                            'name' => $review->user?->username,
                        ],
                    ];
                })
                ->values();

            return response()->json([
                'success' => true,
                'data' => $reviews,
                'meta' => [
                    'reviews_count' => $reviews->count(),
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Error fetching reviews: ' . $e->getMessage()], 500);
        }
    }
}
