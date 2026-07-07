<?php

namespace App\Http\Controllers;

use App\Models\Products;
use App\Models\SearchHistories;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SearchController extends Controller
{
    // Basic search with filters
    public function search(Request $request)
    {
        try {
            $keyword = $request->query('keyword', '');
            $brand = $request->query('brand');
            $model = $request->query('model');
            $color = $request->query('color');
            $minPrice = $request->query('min_price');
            $maxPrice = $request->query('max_price');
            $page = $request->query('page', 1);

            $query = Products::where('is_active', 1)
                ->whereNull('deleted_at');

            // Keyword search
            if ($keyword) {
                $query->where(function ($q) use ($keyword) {
                    $q->where('model', 'like', "%{$keyword}%")
                        ->orWhere('brand', 'like', "%{$keyword}%")
                        ->orWhere('description', 'like', "%{$keyword}%")
                        ->orWhere('color', 'like', "%{$keyword}%");
                });

                // Save search history
                if (Auth::check()) {
                    SearchHistories::create([
                        'user_id' => Auth::id(),
                        'keyword' => $keyword
                    ]);
                }
            }

            // Filter by brand
            if ($brand) {
                $query->where('brand', $brand);
            }

            // Filter by model
            if ($model) {
                $query->where('model', 'like', "%{$model}%");
            }

            // Filter by color
            if ($color) {
                $query->where('color', 'like', "%{$color}%");
            }

            // Filter by price range
            if ($minPrice) {
                $query->where('price', '>=', $minPrice);
            }
            if ($maxPrice) {
                $query->where('price', '<=', $maxPrice);
            }

            $products = $query->orderBy('created_at', 'desc')
                ->paginate(20);

            return response()->json($products, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Semantic search - search by description
    public function semanticSearch(Request $request)
    {
        try {
            $description = $request->query('description', '');

            if (!$description) {
                return response()->json(['message' => 'Description is required'], 400);
            }

            // Map common JDM descriptions to products
            $keywords = $this->extractKeywords($description);

            $query = Products::where('is_active', 1)
                ->whereNull('deleted_at');

            // Search using extracted keywords
            foreach ($keywords as $keyword) {
                $query->orWhere('model', 'like', "%{$keyword}%")
                    ->orWhere('brand', 'like', "%{$keyword}%")
                    ->orWhere('description', 'like', "%{$keyword}%");
            }

            $products = $query->distinct()
                ->orderBy('created_at', 'desc')
                ->paginate(20);

            // Save search history
            if (Auth::check()) {
                SearchHistories::create([
                    'user_id' => Auth::id(),
                    'keyword' => $description
                ]);
            }

            return response()->json($products, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Visual search - search by image
    public function visualSearch(Request $request)
    {
        try {
            $request->validate([
                'image' => 'required|image|mimes:jpeg,png,jpg|max:5120'
            ]);

            // In a real implementation, you would use an ML model to extract features
            // For now, we'll return a placeholder response
            // You can integrate with services like Google Vision API or TensorFlow

            $products = Products::where('is_active', 1)
                ->whereNull('deleted_at')
                ->orderBy('sold_count', 'desc')
                ->limit(20)
                ->get();

            return response()->json([
                'message' => 'Visual search results (placeholder)',
                'products' => $products
            ], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get search suggestions
    public function suggestions(Request $request)
    {
        try {
            $keyword = $request->query('keyword', '');

            if (strlen($keyword) < 2) {
                return response()->json([], 200);
            }

            $suggestions = Products::where('is_active', 1)
                ->whereNull('deleted_at')
                ->where(function ($q) use ($keyword) {
                    $q->where('model', 'like', "%{$keyword}%")
                        ->orWhere('brand', 'like', "%{$keyword}%");
                })
                ->select('model', 'brand')
                ->distinct()
                ->limit(10)
                ->get();

            return response()->json($suggestions, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Get search history
    public function getSearchHistory(Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            $history = SearchHistories::where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->limit(20)
                ->get();

            return response()->json($history, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Clear search history
    public function clearSearchHistory(Request $request)
    {
        try {
            $user = Auth::user();
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            SearchHistories::where('user_id', $user->id)->delete();

            return response()->json(['message' => 'Search history cleared'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }

    // Extract keywords from description
    private function extractKeywords($description)
    {
        $keywords = [];

        // JDM-specific keywords mapping
        $jdmKeywords = [
            'toyota' => ['supra', 'ae86', 'trueno', 'levin', 'gt86', 'mr2', 'celica', 'soarer', 'altezza'],
            'nissan' => ['skyline', 'silvia', 'gtr', 'r32', 'r33', 'r34', '350z', '180sx', 'sileighty', 'stagea'],
            'mazda' => ['rx7', 'rx-7', 'fd', 'fc'],
            'honda' => ['nsx', 's2000', 'civic', 'eg6', 'ek9', 'type r'],
            'mitsubishi' => ['lancer', 'evo', 'eclipse'],
            'subaru' => ['impreza', 'wrx', 'sti']
        ];

        $descLower = strtolower($description);

        // Extract brand and model
        foreach ($jdmKeywords as $brand => $models) {
            if (strpos($descLower, $brand) !== false) {
                $keywords[] = $brand;
                foreach ($models as $model) {
                    if (strpos($descLower, $model) !== false) {
                        $keywords[] = $model;
                    }
                }
            }
        }

        // Extract engine keywords
        $engineKeywords = ['2jz', 'rb26', 'rb26dett', '4a-ge', 'sr20', 'sr20det', '4g63', 'rotary', 'v6', 'v8'];
        foreach ($engineKeywords as $engine) {
            if (strpos($descLower, $engine) !== false) {
                $keywords[] = $engine;
            }
        }

        // Extract feature keywords
        $featureKeywords = ['drift', 'turbo', 'pop-up', 'widebody', 'racing', 'drift king'];
        foreach ($featureKeywords as $feature) {
            if (strpos($descLower, $feature) !== false) {
                $keywords[] = $feature;
            }
        }

        return array_unique($keywords);
    }

    // Get trending searches
    public function trendingSearches(Request $request)
    {
        try {
            $trending = SearchHistories::select('keyword', DB::raw('count(*) as count'))
                ->where('created_at', '>=', now()->subDays(7))
                ->groupBy('keyword')
                ->orderBy('count', 'desc')
                ->limit(10)
                ->get();

            return response()->json($trending, 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Error: ' . $e->getMessage()], 500);
        }
    }
}
