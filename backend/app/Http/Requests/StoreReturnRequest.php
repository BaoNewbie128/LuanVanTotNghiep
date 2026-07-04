<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreReturnRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'order_id' => 'required|integer|exists:orders,id',
            'reason' => 'required|string|min:10|max:500',
            'image' => 'nullable|image|mimes:jpeg,png,jpg|max:2048',
        ];
    }

    public function messages()
    {
        return [
            'order_id.required' => 'ID đơn hàng là bắt buộc',
            'order_id.exists' => 'Đơn hàng không tồn tại',
            'reason.required' => 'Lý do hoàn/đổi hàng là bắt buộc',
            'reason.min' => 'Lý do phải có ít nhất 10 ký tự',
            'reason.max' => 'Lý do không được vượt quá 500 ký tự',
            'image.image' => 'File phải là ảnh',
            'image.mimes' => 'Ảnh phải là định dạng jpeg, png hoặc jpg',
            'image.max' => 'Kích thước ảnh không được vượt quá 2MB',
        ];
    }
}
