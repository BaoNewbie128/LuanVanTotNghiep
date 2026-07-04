import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import './BlogPages.css';

const getBlogImagePath = (thumbnail) => {
  if (!thumbnail) {
    return null;
  }

  if (thumbnail.startsWith('/')) {
    return thumbnail;
  }

  if (thumbnail.startsWith('http://') || thumbnail.startsWith('https://')) {
    return thumbnail;
  }

  return `/images/${thumbnail}`;
};

function BlogDetailPage() {
  const { identifier } = useParams();
  const [post, setPost] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchPost = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/posts/slug/${identifier}`);
        setPost(response.data?.data?.post || null);
        setRelatedPosts(response.data?.data?.related_posts || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Không thể tải chi tiết bài viết.');
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [identifier]);

  return (
    <section className="blog-page">
      {loading && <div className="blog-page__empty">Đang tải chi tiết bài viết...</div>}
      {!loading && error && <div className="blog-page__error">{error}</div>}

      {!loading && !error && post && (
        <article className="blog-detail">
          <Link to="/blog" className="blog-detail__back">← Quay lại Blog</Link>
          <h1>{post.title}</h1>
          <p className="blog-detail__meta">
            {post.created_at ? new Date(post.created_at).toLocaleDateString('vi-VN') : 'N/A'} · Slug: {post.slug}
          </p>
          {post?.thumbnail && (
            <div className="blog-detail__thumbnail">
              <img
                src={getBlogImagePath(post.thumbnail)}
                alt={post.title || 'Blog Thumbnail'}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
          {post.meta_title && <p className="blog-detail__seo"><strong>Meta title:</strong> {post.meta_title}</p>}
          {post.meta_description && <p className="blog-detail__seo"><strong>Meta description:</strong> {post.meta_description}</p>}
          <div className="blog-detail__content" dangerouslySetInnerHTML={{ __html: post.content }} />

          {relatedPosts.length > 0 && (
            <section className="blog-detail__related">
              <h2>Bài viết liên quan</h2>
              <div className="blog-grid">
                {relatedPosts.map((relatedPost) => (
                  <article key={relatedPost.id} className="blog-card">
                    <div className="blog-card__media">
                      {relatedPost.thumbnail ? (
                        <img
                          src={getBlogImagePath(relatedPost.thumbnail)}
                          alt={relatedPost.title}
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="blog-card__placeholder">JDM BLOG</div>
                      )}
                    </div>
                    <div className="blog-card__content">
                      <h3>{relatedPost.title}</h3>
                      <p>
                        {String(relatedPost.meta_description || relatedPost.content || '')
                          .replace(/<[^>]*>/g, '')
                          .slice(0, 140)}
                        ...
                      </p>
                      <Link to={`/blog/${relatedPost.slug || relatedPost.id}`} className="blog-card__link">Xem bài viết</Link>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </article>
      )}
    </section>
  );
}

export default BlogDetailPage;