<?php

return [
    'required' => ':attribute là bắt buộc.',
    'string' => ':attribute phải là chuỗi ký tự.',
    'email' => ':attribute phải là địa chỉ email hợp lệ.',
    'unique' => ':attribute đã được sử dụng.',
    'regex' => ':attribute không đúng định dạng.',
    'confirmed' => 'Giá trị xác nhận của :attribute không khớp.',
    'integer' => ':attribute phải là số nguyên.',
    'numeric' => ':attribute phải là số.',
    'array' => ':attribute phải là một danh sách.',
    'image' => ':attribute phải là hình ảnh.',
    'in' => ':attribute đã chọn không hợp lệ.',
    'max' => [
        'numeric' => ':attribute không được lớn hơn :max.',
        'file' => ':attribute không được lớn hơn :max KB.',
        'string' => ':attribute không được vượt quá :max ký tự.',
        'array' => ':attribute không được có nhiều hơn :max phần tử.',
    ],
    'min' => [
        'numeric' => ':attribute phải từ :min trở lên.',
        'file' => ':attribute phải có dung lượng tối thiểu :min KB.',
        'string' => ':attribute phải có ít nhất :min ký tự.',
        'array' => ':attribute phải có ít nhất :min phần tử.',
    ],
    'mimes' => ':attribute phải có định dạng: :values.',
    'attributes' => [
        'username' => 'Tên người dùng',
        'email' => 'Email',
        'phone' => 'Số điện thoại',
        'password' => 'Mật khẩu',
        'address' => 'Địa chỉ',
    ],
];

