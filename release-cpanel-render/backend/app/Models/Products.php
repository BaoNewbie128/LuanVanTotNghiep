<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Products extends Model
{
    use SoftDeletes;

    const UPDATED_AT = null;

    protected $table = 'products';
    
    protected $fillable = [
        'brand',
        'model',
        'scale',
        'price',
        'color',
        'stock',
        'image',
        'description',
        'sold_count',
        'low_stock_threshold',
        'is_active',
        'deleted_at',
        'embedding'
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'stock' => 'integer',
        'low_stock_threshold' => 'integer',
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class, 'product_id');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class, 'product_id');
    }

    public function wishlists()
    {
        return $this->hasMany(Wishlist::class, 'product_id');
    }

    public function cartItems()
    {
        return $this->hasMany(CartItems::class, 'product_id');
    }

    public function images()
    {
        return $this->hasMany(ProductImages::class, 'product_id');
    }

}
