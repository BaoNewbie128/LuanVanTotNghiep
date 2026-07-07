<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreReviewRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'product_id' => 'required|integer|exists:products,id',
            'order_id' => 'required|integer|exists:orders,id',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
            'images' => 'nullable|array|max:5',
            'images.*' => 'image|mimes:jpeg,png,jpg|max:2048',
        ];
    }

    public function messages()
    {
        return [
            'product_id.required' => 'ID sản phẩm là bắt buộc',
            'product_id.exists' => 'Sản phẩm không tồn tại',
            'order_id.required' => 'ID đơn hàng là bắt buộc',
            'order_id.exists' => 'Đơn hàng không tồn tại',
            'rating.required' => 'Đánh giá sao là bắt buộc',
            'rating.min' => 'Đánh giá phải từ 1 sao trở lên',
            'rating.max' => 'Đánh giá tối đa là 5 sao',
            'comment.max' => 'Bình luận không được vượt quá 1000 ký tự',
            'images.max' => 'Tối đa 5 ảnh',
            'images.*.image' => 'File phải là ảnh',
            'images.*.mimes' => 'Ảnh phải là định dạng jpeg, png hoặc jpg',
            'images.*.max' => 'Kích thước ảnh không được vượt quá 2MB',
        ];
    }
}
