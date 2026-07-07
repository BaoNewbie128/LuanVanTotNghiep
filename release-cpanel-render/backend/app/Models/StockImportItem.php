<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockImportItem extends Model
{
    protected $table = 'stock_import_items';
    public $timestamps = false;

    protected $fillable = [
        'import_id',
        'product_id',
        'quantity',
        'import_price'
    ];

    protected $casts = [
        'import_price' => 'decimal:2'
    ];

    public function import()
    {
        return $this->belongsTo(StockImport::class, 'import_id');
    }

    public function product()
    {
        return $this->belongsTo(Products::class);
    }
}
