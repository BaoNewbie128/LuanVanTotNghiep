<?php

namespace App\Console\Commands;

use App\Models\Post;
use Illuminate\Console\Command;

class GeneratePostSlugs extends Command
{
    protected $signature = 'blog:generate-slugs';

    protected $description = 'Generate SEO slugs for posts that do not have a slug yet';

    public function handle(): int
    {
        $posts = Post::whereNull('slug')
            ->orWhere('slug', '')
            ->get();

        if ($posts->isEmpty()) {
            $this->info('Không có bài viết nào cần cập nhật slug.');
            return self::SUCCESS;
        }

        foreach ($posts as $post) {
            $post->slug = Post::generateUniqueSlug(null, $post->title, $post->id);
            $post->save();
        }

        $this->info('Đã cập nhật slug thành công!');
        $this->info('Số bài viết đã backfill: ' . $posts->count());

        return self::SUCCESS;
    }
}