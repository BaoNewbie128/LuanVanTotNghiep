<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Post extends Model
{
    protected $table = 'posts';
    const UPDATED_AT = null;
    public $timestamps = true;

    protected $fillable = [
        'title',
        'slug',
        'content',
        'thumbnail',
        'meta_title',
        'meta_description',
        'blog_category_id',
        'status'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime'
    ];

    protected static function booted(): void
    {
        static::creating(function (Post $post) {
            $post->slug = static::generateUniqueSlug($post->slug, $post->title);
        });

        static::updating(function (Post $post) {
            if (!$post->slug || $post->isDirty('slug') || $post->isDirty('title')) {
                $post->slug = static::generateUniqueSlug($post->slug, $post->title, $post->id);
            }
        });
    }

    public static function generateUniqueSlug(?string $slug, string $title, ?int $ignoreId = null): string
    {
        $baseSlug = Str::slug($slug ?: $title);
        $baseSlug = $baseSlug !== '' ? $baseSlug : 'post';
        $candidate = $baseSlug;
        $counter = 1;

        while (static::query()
            ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
            ->where('slug', $candidate)
            ->exists()) {
            $candidate = $baseSlug . '-' . $counter;
            $counter++;
        }

        return $candidate;
    }

    public function category()
    {
        return $this->belongsTo(BlogCategory::class, 'blog_category_id');
    }

    public function tags()
    {
        return $this->belongsToMany(BlogTag::class, 'blog_post_tag', 'post_id', 'blog_tag_id');
    }
}
