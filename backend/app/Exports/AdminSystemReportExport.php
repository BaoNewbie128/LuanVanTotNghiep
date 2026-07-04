<?php

namespace App\Exports;

use App\Models\Order;
use App\Models\Payment;
use App\Models\Products;
use App\Models\Returns;
use App\Models\User;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class AdminSystemReportExport implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize
{
    public function __construct(private string $type, private ?string $startDate = null, private ?string $endDate = null) {}

    public function collection(): Collection
    {
        $query = match ($this->type) {
            'returns' => Returns::with(['user', 'order']),
            'payments' => Payment::with('order.user'),
            'products' => Products::query()->withTrashed(),
            'customers' => User::where('role', 'customer'),
            default => Order::with('user'),
        };

        if ($this->startDate && in_array($this->type, ['orders', 'returns', 'customers'], true)) $query->whereDate('created_at', '>=', $this->startDate);
        if ($this->endDate && in_array($this->type, ['orders', 'returns', 'customers'], true)) $query->whereDate('created_at', '<=', $this->endDate);
        return $query->get();
    }

    public function headings(): array
    {
        return match ($this->type) {
            'returns' => ['Mã yêu cầu', 'Mã đơn', 'Khách hàng', 'Loại', 'Lý do', 'Trạng thái', 'Ghi chú xử lý', 'Ngày tạo'],
            'payments' => ['Mã thanh toán', 'Mã đơn', 'Khách hàng', 'Phương thức', 'Mã giao dịch', 'Số tiền', 'Trạng thái', 'Ngày thanh toán'],
            'products' => ['Mã SP', 'Hãng', 'Mẫu xe', 'Tỷ lệ', 'Màu', 'Giá', 'Tồn kho', 'Ngưỡng cảnh báo', 'Đang bán'],
            'customers' => ['Mã KH', 'Tên', 'Email', 'Số điện thoại', 'Địa chỉ', 'Hoạt động', 'Ngày đăng ký'],
            default => ['Mã đơn', 'Khách hàng', 'Email', 'Tạm tính', 'Phí ship', 'Giảm giá', 'Doanh thu', 'Trạng thái', 'Ngày tạo'],
        };
    }

    public function map($row): array
    {
        return match ($this->type) {
            'returns' => [$row->id, $row->order_id, $row->user?->username, $row->request_type, $row->reason, $row->status, $row->resolution_note, optional($row->created_at)->format('d/m/Y H:i')],
            'payments' => [$row->id, $row->order_id, $row->order?->user?->username, $row->payment_method, $row->transaction_code, $row->amount, $row->status, optional($row->paid_at)->format('d/m/Y H:i')],
            'products' => [$row->id, $row->brand, $row->model, $row->scale, $row->color, $row->price, $row->stock, $row->low_stock_threshold, $row->is_active ? 'Có' : 'Không'],
            'customers' => [$row->id, $row->username, $row->email, $row->phone, $row->address, $row->is_active ? 'Có' : 'Không', optional($row->created_at)->format('d/m/Y H:i')],
            default => [$row->id, $row->user?->username, $row->user?->email, $row->total, $row->shipping_fee, $row->discount, (float) $row->total - (float) $row->discount, $row->status, optional($row->created_at)->format('d/m/Y H:i')],
        };
    }
}
