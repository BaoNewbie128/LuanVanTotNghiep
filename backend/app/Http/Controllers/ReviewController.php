<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ReviewController extends Controller
{
    /**
     * Store a verified-purchase review.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        if ($user->role !== 'customer') {
            return response()->json(['message' => 'Chỉ khách hàng mới có thể đánh giá sản phẩm.'], 403);
        }

        $validated = $request->validate([
            'order_id' => ['required', 'integer'],
            'product_id' => ['required', 'integer'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['required', 'string', 'min:3', 'max:2000'],
            'images' => ['nullable', 'array', 'max:5'],
            'images.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ], [
            'rating.between' => 'Số sao phải từ 1 đến 5.',
            'comment.required' => 'Vui lòng nhập nội dung đánh giá.',
            'comment.min' => 'Nội dung đánh giá phải có ít nhất 3 ký tự.',
            'images.max' => 'Bạn chỉ có thể tải tối đa 5 ảnh.',
            'images.*.image' => 'Tệp tải lên phải là hình ảnh.',
            'images.*.max' => 'Mỗi ảnh không được vượt quá 4 MB.',
        ]);

        $order = Order::query()
            ->whereKey($validated['order_id'])
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->whereHas('items', fn ($query) => $query->where('product_id', $validated['product_id']))
            ->first();

        if (!$order) {
            return response()->json([
                'message' => 'Bạn chỉ có thể đánh giá sản phẩm trong đơn hàng đã hoàn thành.',
            ], 403);
        }

        if (Review::where('user_id', $user->id)->where('product_id', $validated['product_id'])->exists()) {
            return response()->json(['message' => 'Bạn đã đánh giá sản phẩm này.'], 422);
        }

        $storedPaths = [];

        try {
            $review = DB::transaction(function () use ($request, $validated, $user, &$storedPaths) {
                $review = Review::create([
                    'user_id' => $user->id,
                    'product_id' => $validated['product_id'],
                    'order_id' => $validated['order_id'],
                    'rating' => $validated['rating'],
                    'comment' => trim($validated['comment']),
                ]);

                foreach ($request->file('images', []) as $image) {
                    $path = $image->store('reviews', 'public');

                    if (!$path) {
                        throw new \RuntimeException('Không thể lưu tệp ảnh lên bộ nhớ.');
                    }

                    $storedPaths[] = $path;
                    $review->images()->create(['image_url' => $path]);
                }

                return $review->load(['images', 'user:id,username']);
            });

            return response()->json([
                'success' => true,
                'message' => 'Cảm ơn bạn đã đánh giá sản phẩm.',
                'data' => $review,
            ], 201);
        } catch (\Throwable $exception) {
            foreach ($storedPaths as $path) {
                Storage::disk('public')->delete($path);
            }

            report($exception);

            return response()->json([
                'message' => config('app.debug')
                    ? 'Không thể lưu đánh giá: ' . $exception->getMessage()
                    : 'Không thể lưu đánh giá. Vui lòng thử lại.',
            ], 500);
        }
    }

    public function getProductReviews($productId)
    {
        $reviews = Review::where('product_id', $productId)
            ->with(['user:id,username,avatar', 'images'])
            ->latest('created_at')
            ->paginate(10);

        return response()->json(['success' => true, 'data' => $reviews]);
    }

    public function update(Request $request, $id)
    {
        $review = Review::whereKey($id)->where('user_id', $request->user()->id)->firstOrFail();
        $validated = $request->validate([
            'rating' => ['sometimes', 'integer', 'between:1,5'],
            'comment' => ['sometimes', 'string', 'min:3', 'max:2000'],
        ]);

        $review->update($validated);

        return response()->json(['success' => true, 'message' => 'Đã cập nhật đánh giá.', 'data' => $review]);
    }

    public function destroy(Request $request, $id)
    {
        $review = Review::with('images')->findOrFail($id);
        $user = $request->user();

        if ($review->user_id !== $user->id && $user->role !== 'admin') {
            return response()->json(['message' => 'Bạn không có quyền xóa đánh giá này.'], 403);
        }

        DB::transaction(function () use ($review) {
            foreach ($review->images as $image) {
                Storage::disk('public')->delete($image->image_url);
            }
            $review->images()->delete();
            $review->delete();
        });

        return response()->json(['success' => true, 'message' => 'Đã xóa đánh giá.']);
    }
}
