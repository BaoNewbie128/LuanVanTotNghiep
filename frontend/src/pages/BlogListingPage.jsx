import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

function BlogListingPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('latest');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    from: 0,
    to: 0,
    total: 0,
  });

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/posts', {
          params: {
            per_page: 12,
            search,
            sort,
            page: pagination.currentPage,
          },
        });

        const payload = response.data?.data;
        setPosts(payload?.data || []);
        setPagination({
          currentPage: payload?.current_page || 1,
          lastPage: payload?.last_page || 1,
          from: payload?.from || 0,
          to: payload?.to || 0,
          total: payload?.total || 0,
        });
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Không thể tải danh sách blog.');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [search, sort, pagination.currentPage]);

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const handleSortChange = (event) => {
    setSort(event.target.value);
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  };

  const goToPage = (page) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  return (
    <section className="blog-page">
      <div className="blog-page__header">
        <h1>Blog JDM</h1>
        <p>Tổng hợp bài viết lịch sử xe JDM, mẹo sưu tầm và tin tức cộng đồng mô hình diecast.</p>
      </div>

      <div className="blog-page__toolbar">
        <input
          type="search"
          className="blog-page__search"
          placeholder="Tìm bài viết theo tiêu đề, slug hoặc nội dung..."
          value={search}
          onChange={handleSearchChange}
        />

        <select className="blog-page__sort" value={sort} onChange={handleSortChange}>
          <option value="latest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
        </select>
      </div>

      {loading && <div className="blog-page__empty">Đang tải bài viết...</div>}
      {!loading && error && <div className="blog-page__error">{error}</div>}
      {!loading && !error && posts.length === 0 && <div className="blog-page__empty">Chưa có bài viết nào.</div>}

      {!loading && !error && posts.length > 0 && (
        <>
          <div className="blog-grid">
            {posts.map((post) => (
              <article key={post.id} className="blog-card">
                <div className="blog-card__media">
                  {post.thumbnail ? (
                    <img
                      src={getBlogImagePath(post.thumbnail)}
                      alt={post.title}
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <div className="blog-card__placeholder">JDM BLOG</div>
                  )}
                </div>
                <div className="blog-card__content">
                  <h2>{post.title}</h2>
                  <p>{String(post.meta_description || post.content || '').replace(/<[^>]*>/g, '').slice(0, 160)}...</p>
                  <Link to={`/blog/${post.slug || post.id}`} className="blog-card__link">Đọc bài viết</Link>
                </div>
              </article>
            ))}
          </div>

          <div className="blog-page__pagination">
            <span>
              Hiển thị {pagination.from} - {pagination.to} / {pagination.total} bài viết
            </span>

            <div className="blog-page__pagination-buttons">
              <button
                type="button"
                onClick={() => goToPage(pagination.currentPage - 1)}
                disabled={pagination.currentPage <= 1}
              >
                Trang trước
              </button>
              <button
                type="button"
                onClick={() => goToPage(pagination.currentPage + 1)}
                disabled={pagination.currentPage >= pagination.lastPage}
              >
                Trang sau
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default BlogListingPage;