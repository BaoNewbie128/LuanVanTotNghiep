<?php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function index(Request $request)
    {
        try {
            $search = trim((string) $request->input('search', ''));
            $sort = $request->input('sort', 'latest');

            $query = Post::where('status', 'published');

            if ($search !== '') {
                $query->where(function ($builder) use ($search) {
                    $builder
                        ->where('title', 'like', "%{$search}%")
                        ->orWhere('slug', 'like', "%{$search}%")
                        ->orWhere('meta_title', 'like', "%{$search}%")
                        ->orWhere('meta_description', 'like', "%{$search}%")
                        ->orWhere('content', 'like', "%{$search}%");
                });
            }

            if ($sort === 'oldest') {
                $query->orderBy('created_at');
            } else {
                $query->orderByDesc('created_at');
            }

            $posts = $query->paginate(min((int) $request->input('per_page', 12), 50));

            return response()->json([
                'success' => true,
                'data' => $posts,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch blog posts: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function showBySlug(string $identifier)
    {
        try {
            $post = Post::where('status', 'published')
                ->where(function ($query) use ($identifier) {
                    $query->where('slug', $identifier);

                    if (is_numeric($identifier)) {
                        $query->orWhere('id', (int) $identifier);
                    }
                })
                ->firstOrFail();

            $relatedPosts = Post::where('status', 'published')
                ->where('id', '!=', $post->id)
                ->where(function ($query) use ($post) {
                    $query
                        ->where('title', 'like', '%' . $post->title . '%')
                        ->orWhere('meta_title', 'like', '%' . ($post->meta_title ?: $post->title) . '%');
                })
                ->orderByDesc('created_at')
                ->limit(3)
                ->get();

            if ($relatedPosts->count() < 3) {
                $fallbackPosts = Post::where('status', 'published')
                    ->where('id', '!=', $post->id)
                    ->whereNotIn('id', $relatedPosts->pluck('id'))
                    ->orderByDesc('created_at')
                    ->limit(3 - $relatedPosts->count())
                    ->get();

                $relatedPosts = $relatedPosts->concat($fallbackPosts)->values();
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'post' => $post,
                    'related_posts' => $relatedPosts,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Blog post not found.',
            ], 404);
        }
    }
}