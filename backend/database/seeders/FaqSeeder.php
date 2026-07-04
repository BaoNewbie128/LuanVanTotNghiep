<?php

namespace Database\Seeders;

use App\Models\Faq;
use Illuminate\Database\Seeder;

class FaqSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $faqs = [
            [
                'question' => 'Mô hình xe có được bọc chống sốc không?',
                'answer' => 'Có. Tất cả mô hình JDM trước khi giao đều được bọc nhiều lớp chống sốc và đóng hộp cẩn thận để hạn chế trầy xước hoặc móp hộp trong quá trình vận chuyển.',
                'is_active' => true,
            ],
            [
                'question' => 'Thời gian giao hàng là bao lâu?',
                'answer' => 'Đơn hàng nội thành thường mất 1-2 ngày làm việc. Các tỉnh thành khác thường từ 3-5 ngày làm việc tùy khu vực và đơn vị vận chuyển.',
                'is_active' => true,
            ],
            [
                'question' => 'Tôi có thể kiểm tra hàng trước khi thanh toán không?',
                'answer' => 'Bạn có thể kiểm tra tình trạng bên ngoài của gói hàng khi nhận. Với các đơn COD, vui lòng quay video mở hộp để được hỗ trợ nhanh hơn nếu có vấn đề phát sinh.',
                'is_active' => true,
            ],
            [
                'question' => 'Nếu mô hình bị lỗi hoặc thiếu phụ kiện thì phải làm sao?',
                'answer' => 'Hãy gửi yêu cầu qua form hỗ trợ kèm thông tin đơn hàng và mô tả lỗi. Đội ngũ CSKH sẽ phản hồi để hỗ trợ đổi trả hoặc xử lý trong thời gian sớm nhất.',
                'is_active' => true,
            ],
        ];

        foreach ($faqs as $faq) {
            Faq::updateOrCreate(
                ['question' => $faq['question']],
                $faq
            );
        }
    }
}