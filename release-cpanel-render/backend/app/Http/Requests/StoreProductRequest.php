<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
class StoreProductRequest extends FormRequest
{
    public function authorize()
    {
        return Auth::check() && Auth::user()->role === 'admin';
    }

    public function rules()
    {
        return [
            'brand' => 'required|string|max:50',
            'model' => 'required|string|max:100',
            'scale' => 'required|regex:/^1:\d+$/',
            'price' => 'required|numeric|min:100000|max:10000000',
            'color' => 'required|string|max:100',
            'stock' => 'required|integer|min:0',
            'image' => 'required|image|mimes:jpeg,png,jpg|max:2048',
            'description' => 'required|string|min:10|max:5000',
        ];
    }

    public function messages()
    {
        return [
            'brand.required' => 'Hãng xe là bắt buộc',
            'model.required' => 'Tên mẫu xe là bắt buộc',
            'scale.required' => 'Tỷ lệ là bắt buộc',
            'scale.regex' => 'Tỷ lệ phải có định dạng 1:XX (ví dụ: 1:18, 1:32)',
            'price.required' => 'Giá là bắt buộc',
            'price.numeric' => 'Giá phải là số',
            'price.min' => 'Giá tối thiểu là 100,000 VND',
            'price.max' => 'Giá tối đa là 10,000,000 VND',
            'color.required' => 'Màu sắc là bắt buộc',
            'stock.required' => 'Tồn kho là bắt buộc',
            'stock.integer' => 'Tồn kho phải là số nguyên',
            'stock.min' => 'Tồn kho không được âm',
            'image.required' => 'Ảnh sản phẩm là bắt buộc',
            'image.image' => 'File phải là ảnh',
            'image.mimes' => 'Ảnh phải có định dạng JPEG, PNG hoặc JPG',
            'image.max' => 'Kích thước ảnh không được vượt quá 2MB',
            'description.required' => 'Mô tả sản phẩm là bắt buộc',
            'description.min' => 'Mô tả phải có ít nhất 10 ký tự',
            'description.max' => 'Mô tả không được vượt quá 5000 ký tự',
        ];
    }
}
