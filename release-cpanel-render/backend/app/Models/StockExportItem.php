<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockExportItem extends Model
{
    protected $table = 'stock_export_items';
    public $timestamps = false;

    protected $fillable = [
        'export_id',
        'product_id',
        'quantity'
    ];

    public function export()
    {
        return $this->belongsTo(StockExport::class, 'export_id');
    }

    public function product()
    {
        return $this->belongsTo(Products::class, 'product_id');
    }
}