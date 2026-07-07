<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AddToCartRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'product_id' => 'required|integer|exists:products,id',
            'quantity' => 'required|integer|min:1|max:100',
        ];
    }

    public function messages()
    {
        return [
            'product_id.required' => 'ID sản phẩm là bắt buộc',
            'product_id.integer' => 'ID sản phẩm phải là số nguyên',
            'product_id.exists' => 'Sản phẩm không tồn tại',
            'quantity.required' => 'Số lượng là bắt buộc',
            'quantity.integer' => 'Số lượng phải là số nguyên',
            'quantity.min' => 'Số lượng tối thiểu là 1',
            'quantity.max' => 'Số lượng tối đa là 100',
        ];
    }
}
