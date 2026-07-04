<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockImport extends Model
{
    protected $table = 'stock_imports';
    const UPDATED_AT = null;
    public $timestamps = true;

    protected $fillable = [
        'staff_id',
        'note'
    ];

    protected $casts = [
        'created_at' => 'datetime'
    ];

    public function staff()
    {
        return $this->belongsTo(User::class, 'staff_id');
    }

    public function items()
    {
        return $this->hasMany(StockImportItem::class, 'import_id');
    }
}
