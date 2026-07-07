<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CheckoutRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'payment_method' => 'required|in:cod,momo,vnpay',
            'coupon_code' => 'nullable|string|exists:coupons,code',
            'shipping_address' => 'required|string|min:5|max:255',
        ];
    }

    public function messages()
    {
        return [
            'payment_method.required' => 'Phương thức thanh toán là bắt buộc',
            'payment_method.in' => 'Phương thức thanh toán không hợp lệ',
            'coupon_code.exists' => 'Mã giảm giá không tồn tại',
            'shipping_address.required' => 'Địa chỉ giao hàng là bắt buộc',
            'shipping_address.min' => 'Địa chỉ giao hàng phải có ít nhất 5 ký tự',
            'shipping_address.max' => 'Địa chỉ giao hàng không được vượt quá 255 ký tự',
        ];
    }
}
