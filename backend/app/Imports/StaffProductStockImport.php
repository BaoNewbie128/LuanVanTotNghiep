<?php

namespace App\Imports;

use App\Models\Products;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class StaffProductStockImport implements ToCollection, WithHeadingRow
{
    private function getRowValue(Collection $row, array $keys, $default = null)
    {
        foreach ($keys as $key) {
            if ($row->has($key) && $row[$key] !== null && $row[$key] !== '') {
                return $row[$key];
            }
        }

        return $default;
    }

    public function collection(Collection $rows): void
    {
        DB::transaction(function () use ($rows) {
            foreach ($rows as $row) {
                $productId = (int) $this->getRowValue($row, ['product_id', 'ma_san_pham'], 0);
                $quantity = (int) $this->getRowValue($row, ['quantity', 'so_luong'], 0);

                if ($productId <= 0 || $quantity <= 0) {
                    continue;
                }

                $product = Products::find($productId);

                if (!$product) {
                    continue;
                }

                $product->increment('stock', $quantity);

                $thresholdValue = $this->getRowValue($row, ['low_stock_threshold', 'nguong_canh_bao', 'nguong_canh_bao_ton_kho']);

                if ($thresholdValue !== null && $thresholdValue !== '') {
                    $threshold = (int) $thresholdValue;

                    if ($threshold > 0) {
                        $product->update([
                            'low_stock_threshold' => $threshold,
                        ]);
                    }
                }
            }
        });
    }
}