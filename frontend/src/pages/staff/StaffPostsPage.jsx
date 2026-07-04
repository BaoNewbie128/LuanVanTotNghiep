import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../../styles/StaffPostsPage.css';

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || '';

const defaultPostForm = {
  title: '',
  slug: '',
  content: '',
  thumbnail: '',
  thumbnailFile: null,
  metaTitle: '',
  metaDescription: '',
  blogCategoryId: '',
  tags: '',
  status: 'draft',
};

const statusLabels = {
  published: 'Đã xuất bản',
  draft: 'Bản nháp',
};

const stripHtml = (value = '') => String(value).replace(/<[^>]*>/g, '');

const slugify = (value = '') => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const buildThumbnailSrc = (thumbnail) => {
  if (!thumbnail || typeof thumbnail !== 'string' || thumbnail.trim() === '') {
    return '';
  }

  const normalizedThumbnail = thumbnail.trim();

  if (normalizedThumbnail.startsWith('http://') || normalizedThumbnail.startsWith('https://')) {
    return normalizedThumbnail;
  }

  if (normalizedThumbnail.startsWith('/storage/') || normalizedThumbnail.startsWith('/images/')) {
    return `${BACKEND_ORIGIN}${normalizedThumbnail}`;
  }

  if (normalizedThumbnail.startsWith('storage/')) {
    return `${BACKEND_ORIGIN}/${normalizedThumbnail}`;
  }

  if (normalizedThumbnail.startsWith('images/')) {
    return `${BACKEND_ORIGIN}/${normalizedThumbnail}`;
  }

  if (normalizedThumbnail.includes('/')) {
    return `${BACKEND_ORIGIN}/storage/${normalizedThumbnail}`;
  }

  return `${BACKEND_ORIGIN}/images/${normalizedThumbnail}`;
};

const normalizeThumbnailInput = (thumbnail) => {
  if (!thumbnail || typeof thumbnail !== 'string') {
    return '';
  }

  const normalizedThumbnail = thumbnail.trim();

  if (normalizedThumbnail.startsWith(`${BACKEND_ORIGIN}/images/`)) {
    return normalizedThumbnail.replace(`${BACKEND_ORIGIN}/images/`, '');
  }

  if (normalizedThumbnail.startsWith(`${BACKEND_ORIGIN}/storage/`)) {
    return normalizedThumbnail.replace(`${BACKEND_ORIGIN}/`, '');
  }

  return normalizedThumbnail;
};

const FALLBACK_IMAGE = '/images/ryosuke.jpg';

function StaffPostsPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [postForm, setPostForm] = useState(defaultPostForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [categories, setCategories] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  const token = localStorage.getItem('token');
  const previewSrc = postForm.thumbnailFile instanceof File
    ? URL.createObjectURL(postForm.thumbnailFile)
    : buildThumbnailSrc(postForm.thumbnail);

  const fetchPosts = useCallback(async () => {
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/api/staff/posts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = response.data?.data;
      setPosts(payload?.data || payload || []);

      const taxonomyResponse = await axios.get('/api/staff/posts/taxonomy', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setCategories(taxonomyResponse.data?.data?.categories || []);
      setAvailableTags(taxonomyResponse.data?.data?.tags || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể tải danh sách bài viết.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const summary = useMemo(() => ({
    total: posts.length,
    published: posts.filter((post) => post.status === 'published').length,
    draft: posts.filter((post) => post.status === 'draft').length,
  }), [posts]);

  const seoPreview = useMemo(() => {
    const title = (postForm.metaTitle || postForm.title || 'Tiêu đề bài viết JDM').trim();
    const slug = (postForm.slug || slugify(postForm.title) || 'jdm-blog-post').trim();
    const descriptionSource = postForm.metaDescription || stripHtml(postForm.content);
    const description = descriptionSource.trim() || 'Mô tả SEO sẽ xuất hiện tại đây khi bạn nhập mô tả meta hoặc nội dung bài viết.';

    return {
      title: title.slice(0, 60),
      url: `https://jdmworld.vn/blog/${slug}`,
      description: description.slice(0, 160),
    };
  }, [postForm]);

  const resetForm = () => {
    setPostForm(defaultPostForm);
    setEditingId(null);
    setSlugTouched(false);
  };

  const handleTitleChange = (event) => {
    const nextTitle = event.target.value;

    setPostForm((prev) => ({
      ...prev,
      title: nextTitle,
      slug: slugTouched ? prev.slug : slugify(nextTitle),
    }));
  };

  const handleSlugChange = (event) => {
    setSlugTouched(true);
    setPostForm((prev) => ({
      ...prev,
      slug: slugify(event.target.value),
    }));
  };

  const handleThumbnailFileChange = (event) => {
    const file = event.target.files?.[0] || null;

    setPostForm((prev) => ({
      ...prev,
      thumbnailFile: file,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!token) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = new FormData();
      payload.append('title', postForm.title);
      payload.append('slug', postForm.slug || '');
      payload.append('content', postForm.content);
      payload.append('meta_title', postForm.metaTitle || '');
      payload.append('meta_description', postForm.metaDescription || '');
      payload.append('blog_category_id', postForm.blogCategoryId || '');
      payload.append('status', postForm.status);

      if (!(postForm.thumbnailFile instanceof File) && postForm.thumbnail) {
        payload.append('thumbnail', postForm.thumbnail);
      }

      postForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .forEach((tag, index) => payload.append(`tags[${index}]`, tag));

      if (postForm.thumbnailFile instanceof File) {
        payload.append('thumbnail', postForm.thumbnailFile);
      }

      if (editingId) {
        payload.append('_method', 'PUT');

        await axios.post(`/api/staff/posts/${editingId}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
      } else {
        await axios.post('/api/staff/posts', payload, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        });
      }

      resetForm();
      fetchPosts();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể lưu bài viết.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (post) => {
    const normalizedThumbnail = normalizeThumbnailInput(post.thumbnail || post.thumbnail_url || '');

    setEditingId(post.id);
    setPostForm({
      title: post.title || '',
      slug: post.slug || '',
      content: post.content || '',
      thumbnail: normalizedThumbnail || '',
      thumbnailFile: null,
      metaTitle: post.meta_title || '',
      metaDescription: post.meta_description || '',
      blogCategoryId: post.blog_category_id || '',
      tags: (post.tags || []).map((tag) => tag.name).join(', '),
      status: post.status || 'draft',
    });
    setSlugTouched(Boolean(post.slug));
  };

  const handleDelete = async (postId) => {
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    try {
      await axios.delete(`/api/staff/posts/${postId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (editingId === postId) {
        resetForm();
      }

      fetchPosts();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể xóa bài viết.');
    }
  };

  return (
    <section className="staff-posts-page">
      <div className="staff-posts-page__intro">
        <div>
          <h2>Quản lý bài viết / SEO</h2>
          <p>
            Nhân viên có thể tạo, chỉnh sửa, xuất bản hoặc lưu nháp bài viết về xe JDM, tin tức sưu tầm
            và nội dung SEO ngay trong cổng nhân viên.
          </p>
        </div>
        <div className="staff-posts-page__meta">Giai đoạn 3.2</div>
      </div>

      <div className="staff-posts-summary">
        <article className="staff-posts-summary__card">
          <span>Tổng bài viết</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="staff-posts-summary__card staff-posts-summary__card--published">
          <span>Đã xuất bản</span>
          <strong>{summary.published}</strong>
        </article>
        <article className="staff-posts-summary__card staff-posts-summary__card--draft">
          <span>Bản nháp</span>
          <strong>{summary.draft}</strong>
        </article>
      </div>

      <form className="staff-post-form" onSubmit={handleSubmit}>
        <div className="staff-post-form__header">
          <h3>{editingId ? `Chỉnh sửa bài viết #${editingId}` : 'Tạo bài viết mới'}</h3>
          {editingId && (
            <button type="button" className="staff-post-form__secondary" onClick={resetForm}>
              Hủy chỉnh sửa
            </button>
          )}
        </div>

        <div className="staff-post-form__grid">
          <label className="staff-post-form__full">
            <span>Tiêu đề</span>
            <input
              type="text"
              value={postForm.title}
              onChange={handleTitleChange}
              required
            />
          </label>

          <label>
            <span>Đường dẫn (slug) SEO</span>
            <input
              type="text"
              value={postForm.slug}
              onChange={handleSlugChange}
              placeholder="vd: lich-su-toyota-supra-jdm"
            />
          </label>

          <label>
            <span>Ảnh đại diện</span>
            <input
              type="text"
              value={postForm.thumbnail}
              onChange={(event) => setPostForm((prev) => ({ ...prev, thumbnail: event.target.value }))}
              placeholder="VD: skyline-r34.png hoặc storage/posts/skyline-r34.png"
            />
          </label>

          <div className="staff-post-form__file-field">
            <span>Tải ảnh đại diện từ thiết bị</span>
            <label className="staff-post-form__file-picker" htmlFor="staff-post-thumbnail-file">
              Chọn tệp ảnh
            </label>
            <input
              id="staff-post-thumbnail-file"
              className="staff-post-form__file-input"
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={handleThumbnailFileChange}
            />
            <small>{postForm.thumbnailFile?.name || 'Chưa chọn tệp ảnh'}</small>
          </div>

          <label>
            <span>Trạng thái</span>
            <select
              value={postForm.status}
              onChange={(event) => setPostForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="draft">Bản nháp</option>
              <option value="published">Đã xuất bản</option>
            </select>
          </label>

          <label>
            <span>Chuyên mục bài viết</span>
            <select
              value={postForm.blogCategoryId}
              onChange={(event) => setPostForm((prev) => ({ ...prev, blogCategoryId: event.target.value }))}
            >
              <option value="">Chưa phân loại</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>

          <label className="staff-post-form__full">
            <span>Thẻ bài viết (phân tách bằng dấu phẩy)</span>
            <input
              type="text"
              value={postForm.tags}
              onChange={(event) => setPostForm((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="supra, skyline, diecast, jdm history"
            />
            {availableTags.length > 0 && (
              <small className="staff-post-form__hint">
                Gợi ý thẻ hiện có: {availableTags.map((tag) => tag.name).join(', ')}
              </small>
            )}
          </label>

          <label>
            <span>Tiêu đề meta</span>
            <input
              type="text"
              value={postForm.metaTitle}
              onChange={(event) => setPostForm((prev) => ({ ...prev, metaTitle: event.target.value }))}
              placeholder="Tiêu đề SEO hiển thị trên Google"
            />
          </label>

          <label className="staff-post-form__full">
            <span>Mô tả meta</span>
            <textarea
              rows="3"
              value={postForm.metaDescription}
              onChange={(event) => setPostForm((prev) => ({ ...prev, metaDescription: event.target.value }))}
              placeholder="Mô tả ngắn chuẩn SEO, khoảng 150-160 ký tự"
            />
          </label>

          <label className="staff-post-form__full">
            <span>Nội dung</span>
            <textarea
              rows="10"
              value={postForm.content}
              onChange={(event) => setPostForm((prev) => ({ ...prev, content: event.target.value }))}
              required
            />
          </label>
        </div>

        <div className="staff-post-form__actions">
          <button type="submit" disabled={saving}>
            {saving ? 'Đang lưu...' : (editingId ? 'Cập nhật bài viết' : 'Tạo bài viết')}
          </button>
        </div>

        {previewSrc ? (
          <div className="staff-post-form__thumbnail-preview">
            <span>Xem trước ảnh đại diện</span>
            <img
              src={previewSrc}
              alt="Xem trước ảnh đại diện"
            />
          </div>
        ) : (
          <div className="staff-post-form__thumbnail-preview staff-post-form__thumbnail-preview--empty">
            <span>Xem trước ảnh đại diện</span>
            <em>Chưa có ảnh đại diện</em>
          </div>
        )}
      </form>

      <section className="staff-post-seo-preview">
        <div className="staff-post-seo-preview__header">
          <h3>Xem trước kết quả tìm kiếm SEO</h3>
          <p>Mô phỏng cách bài viết có thể hiển thị trên kết quả tìm kiếm.</p>
        </div>

        <div className="staff-post-seo-preview__card">
          <span className="staff-post-seo-preview__title">{seoPreview.title}</span>
          <span className="staff-post-seo-preview__url">{seoPreview.url}</span>
          <p className="staff-post-seo-preview__description">{seoPreview.description}</p>
        </div>
      </section>

      {loading && <div className="staff-posts-empty">Đang tải bài viết...</div>}
      {!loading && error && <div className="staff-posts-error">{error}</div>}
      {!loading && !error && posts.length === 0 && (
        <div className="staff-posts-empty">Chưa có bài viết nào trong hệ thống.</div>
      )}

      {!loading && !error && posts.length > 0 && (
        <div className="staff-posts-list">
          {posts.map((post) => (
            <article key={post.id} className="staff-post-card">
              <div className="staff-post-card__header">
                <div>
                  <h3>{post.title}</h3>
                  <p>{post.created_at ? new Date(post.created_at).toLocaleString('vi-VN') : 'Không có'}</p>
                </div>
                <span className={`staff-post-status staff-post-status--${post.status}`}>
                  {statusLabels[post.status] || post.status}
                </span>
              </div>

              <div className="staff-post-card__body">
                <p className="staff-post-card__slug">Slug: {post.slug || 'Tự sinh từ tiêu đề'}</p>
                <p className="staff-post-card__content-preview">
                  {String(post.content || '').replace(/<[^>]*>/g, '').slice(0, 220)}
                  {String(post.content || '').length > 220 ? '...' : ''}
                </p>
                {post?.thumbnail ? (
                  <div className="staff-post-card__thumbnail-block">
                    <p className="staff-post-card__thumbnail">Ảnh đại diện bài viết</p>
                    <img
                      src={post.thumbnail_url || buildThumbnailSrc(post.thumbnail)}
                      alt={post.title}
                      className="staff-post-card__thumbnail-image"
                      onError={(event) => {
                        if (event.currentTarget.src.endsWith(FALLBACK_IMAGE)) {
                          return;
                        }

                        event.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />
                  </div>
                ) : (
                  <p className="staff-post-card__thumbnail staff-post-card__thumbnail--empty">Chưa có ảnh</p>
                )}
                {post.meta_title && (
                  <p className="staff-post-card__thumbnail">Tiêu đề meta: {post.meta_title}</p>
                )}
                {post.meta_description && (
                  <p className="staff-post-card__thumbnail">Mô tả meta: {post.meta_description}</p>
                )}
                {post.category && (
                  <p className="staff-post-card__thumbnail">Chuyên mục: {post.category.name}</p>
                )}
                {post.tags?.length > 0 && (
                  <p className="staff-post-card__thumbnail">Thẻ: {post.tags.map((tag) => tag.name).join(', ')}</p>
                )}
              </div>

              <div className="staff-post-card__actions">
                <button type="button" onClick={() => handleEdit(post)}>Sửa</button>
                <button type="button" className="staff-post-card__delete" onClick={() => handleDelete(post.id)}>
                  Xóa
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default StaffPostsPage;
