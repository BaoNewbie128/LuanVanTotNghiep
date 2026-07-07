<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('blog_categories')) {
            Schema::create('blog_categories', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('blog_tags')) {
            Schema::create('blog_tags', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->string('slug')->unique();
                $table->timestamps();
            });
        }

        if (!Schema::hasColumn('posts', 'blog_category_id')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->unsignedBigInteger('blog_category_id')->nullable()->after('meta_description');
            });
        }

        if (!Schema::hasTable('blog_post_tag')) {
            Schema::create('blog_post_tag', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('post_id');
                $table->unsignedBigInteger('blog_tag_id');
                $table->unique(['post_id', 'blog_tag_id']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('blog_post_tag')) {
            Schema::dropIfExists('blog_post_tag');
        }

        if (Schema::hasColumn('posts', 'blog_category_id')) {
            Schema::table('posts', function (Blueprint $table) {
                $table->dropColumn('blog_category_id');
            });
        }

        Schema::dropIfExists('blog_tags');
        Schema::dropIfExists('blog_categories');
    }
};