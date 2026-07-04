<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\ReturnRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ReturnController extends Controller
{
    public function createReturn(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'customer') return response()->json(['message' => 'Chỉ khách hàng mới có thể tạo yêu cầu đổi trả.'], 403);

        $validated = $request->validate([
            'order_id' => ['required', 'integer'],
            'request_type' => ['required', 'in:refund,return,exchange'],
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ], [
            'request_type.required' => 'Vui lòng chọn hình thức yêu cầu.',
            'reason.required' => 'Vui lòng mô tả lý do đổi trả/hoàn tiền.',
            'reason.min' => 'Lý do cần có ít nhất 10 ký tự.',
            'image.max' => 'Ảnh minh chứng không được vượt quá 4 MB.',
        ]);

        $order = Order::whereKey($validated['order_id'])
            ->where('user_id', $user->id)
            ->where('status', 'completed')
            ->first();

        if (!$order) return response()->json(['message' => 'Chỉ đơn hàng đã hoàn thành mới có thể yêu cầu hoàn tiền hoặc đổi trả.'], 422);

        if (ReturnRequest::where('order_id', $order->id)->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Đơn hàng này đã có yêu cầu hoàn tiền/đổi trả.'], 422);
        }

        $imagePath = $request->hasFile('image') ? $request->file('image')->store('returns', 'public') : null;

        try {
            $return = ReturnRequest::create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'request_type' => $validated['request_type'],
                'reason' => trim($validated['reason']),
                'image' => $imagePath,
                'status' => 'pending',
            ]);

            return response()->json(['success' => true, 'message' => 'Yêu cầu đã được gửi. JDM World sẽ kiểm tra và phản hồi sớm.', 'data' => $return], 201);
        } catch (\Throwable $exception) {
            if ($imagePath) Storage::disk('public')->delete($imagePath);
            report($exception);
            return response()->json(['message' => config('app.debug') ? $exception->getMessage() : 'Không thể tạo yêu cầu.'], 500);
        }
    }

    public function getReturns(Request $request)
    {
        $returns = ReturnRequest::where('user_id', $request->user()->id)->with('order.items.product')->latest('created_at')->paginate(20);
        return response()->json(['success' => true, 'data' => $returns]);
    }

    public function getReturnDetail(Request $request, $id)
    {
        $return = ReturnRequest::whereKey($id)->where('user_id', $request->user()->id)->with('order.items.product')->firstOrFail();
        return response()->json(['success' => true, 'data' => $return]);
    }
}
