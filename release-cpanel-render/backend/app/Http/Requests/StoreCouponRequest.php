<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCouponRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'code' => 'required|string|min:3|max:20|regex:/^[A-Z0-9]+$/|unique:coupons,code',
            'type' => 'required|in:fixed,percent',
            'discount' => 'required|numeric|min:0',
            'expiry_date' => 'required|date|after:today',
        ];
    }

    public function messages()
    {
        return [
            'code.required' => 'Mã giảm giá là bắt buộc',
            'code.min' => 'Mã giảm giá phải có ít nhất 3 ký tự',
            'code.max' => 'Mã giảm giá không được vượt quá 20 ký tự',
            'code.regex' => 'Mã giảm giá chỉ chứa chữ hoa và số',
            'code.unique' => 'Mã giảm giá đã tồn tại',
            'type.required' => 'Loại giảm giá là bắt buộc',
            'type.in' => 'Loại giảm giá phải là fixed hoặc percent',
            'discount.required' => 'Giá trị giảm giá là bắt buộc',
            'discount.numeric' => 'Giá trị giảm giá phải là số',
            'discount.min' => 'Giá trị giảm giá không được âm',
            'expiry_date.required' => 'Ngày hết hạn là bắt buộc',
            'expiry_date.date' => 'Ngày hết hạn phải là ngày hợp lệ',
            'expiry_date.after' => 'Ngày hết hạn phải là ngày trong tương lai',
        ];
    }
}
