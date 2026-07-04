import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import '../../styles/StaffReturnsPage.css';

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN || '';

const returnFilters = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Đã từ chối' },
  { key: 'completed', label: 'Hoàn tất' },
];

const statusLabels = {
  pending: 'Chờ xử lý',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
  completed: 'Hoàn tất',
};

const allowedTransitions = {
  pending: ['approved', 'rejected'],
  approved: ['completed'],
  rejected: [],
  completed: [],
};

const transitionLabels = {
  approved: 'Duyệt yêu cầu',
  rejected: 'Từ chối yêu cầu',
  completed: 'Đánh dấu hoàn tất',
};

const requestTypeLabels = { refund: 'Hoàn tiền', return: 'Trả hàng', exchange: 'Đổi hàng' };

const formatDate = (value) => {
  if (!value) {
    return 'Không có';
  }

  return new Date(value).toLocaleString('vi-VN');
};

const getEvidenceImageUrl = (item) => {
  const image = item?.image_url || item?.image;

  if (!image || typeof image !== 'string') {
    return '';
  }

  const normalized = image.trim();

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }

  if (normalized.startsWith('/storage/')) {
    return `${BACKEND_ORIGIN}${normalized}`;
  }

  if (normalized.startsWith('storage/')) {
    return `${BACKEND_ORIGIN}/${normalized}`;
  }

  return `${BACKEND_ORIGIN}/storage/${normalized.replace(/^\/+/, '')}`;
};

function StaffReturnsPage() {
  const [returns, setReturns] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    from: 0,
    to: 0,
    total: 0,
  });
  const [activeFilter, setActiveFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [evidenceLoadError, setEvidenceLoadError] = useState(false);

  useEffect(() => {
    const fetchReturns = async () => {
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const params = { page: pagination.currentPage };

        if (activeFilter !== 'all') {
          params.status = activeFilter;
        }

        const response = await axios.get('/api/staff/returns', {
          params,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = response.data?.data;

        setReturns(payload?.data || []);
        setPagination({
          currentPage: payload?.current_page || 1,
          lastPage: payload?.last_page || 1,
          from: payload?.from || 0,
          to: payload?.to || 0,
          total: payload?.total || 0,
        });
      } catch (requestError) {
        setError(requestError.response?.data?.message || 'Không thể tải danh sách đổi trả.');
      } finally {
        setLoading(false);
      }
    };

    fetchReturns();
  }, [activeFilter, pagination.currentPage]);

  const summary = useMemo(() => ({
    total: returns.length,
    pending: returns.filter((item) => item.status === 'pending').length,
    approved: returns.filter((item) => item.status === 'approved').length,
    rejected: returns.filter((item) => item.status === 'rejected').length,
    completed: returns.filter((item) => item.status === 'completed').length,
  }), [returns]);

  const updateReturnStatus = async (returnId, nextStatus) => {
    const token = localStorage.getItem('token');

    if (!token) {
      setError('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
      return;
    }

    setActionLoadingId(returnId);
    setError('');

    try {
      await axios.put(
        `/api/staff/returns/${returnId}/status`,
        { status: nextStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setReturns((prevReturns) =>
        prevReturns.map((item) =>
          item.id === returnId
            ? { ...item, status: nextStatus }
            : item
        )
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Không thể cập nhật trạng thái đổi trả.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const goToPage = (page) => {
    setPagination((prev) => ({ ...prev, currentPage: page }));
  };

  const openEvidence = (item) => {
    setEvidenceLoadError(false);
    setSelectedEvidence({
      url: getEvidenceImageUrl(item),
      returnId: item.id,
      orderId: item.order_id,
    });
  };

  const closeEvidence = () => {
    setSelectedEvidence(null);
    setEvidenceLoadError(false);
  };

  return (
    <section className="staff-returns-page">
      <div className="staff-returns-page__intro">
        <div>
          <h2>Xử lý đổi trả hàng</h2>
          <p>
            Nhân viên có thể tiếp nhận yêu cầu đổi trả, xem ảnh minh chứng và cập nhật trạng thái
            duyệt / từ chối / hoàn tất trực tiếp trong cổng nhân viên.
          </p>
        </div>
        <div className="staff-returns-page__meta">Giai đoạn 1.4</div>
      </div>

      <div className="staff-returns-summary">
        <article className="staff-returns-summary__card">
          <span>Tổng hiển thị</span>
          <strong>{summary.total}</strong>
        </article>
        <article className="staff-returns-summary__card">
          <span>Chờ xử lý</span>
          <strong>{summary.pending}</strong>
        </article>
        <article className="staff-returns-summary__card">
          <span>Đã duyệt</span>
          <strong>{summary.approved}</strong>
        </article>
        <article className="staff-returns-summary__card">
          <span>Đã từ chối</span>
          <strong>{summary.rejected}</strong>
        </article>
        <article className="staff-returns-summary__card">
          <span>Hoàn tất</span>
          <strong>{summary.completed}</strong>
        </article>
      </div>

      <div className="staff-returns-filters">
        {returnFilters.map((filter) => (
          <button
            key={filter.key}
            type="button"
            className={`staff-returns-filter${activeFilter === filter.key ? ' staff-returns-filter--active' : ''}`}
            onClick={() => {
              setActiveFilter(filter.key);
              setPagination((prev) => ({ ...prev, currentPage: 1 }));
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading && <div className="staff-returns-empty">Đang tải yêu cầu đổi trả...</div>}
      {!loading && error && <div className="staff-returns-feedback">{error}</div>}
      {!loading && !error && returns.length === 0 && (
        <div className="staff-returns-empty">Không có yêu cầu đổi trả phù hợp.</div>
      )}

      {!loading && !error && returns.length > 0 && (
        <>
          <div className="staff-returns-list">
            {returns.map((item) => (
              <article key={item.id} className="staff-return-card">
                <div className="staff-return-card__header">
                  <div>
                    <h3>{requestTypeLabels[item.request_type] || 'Đổi trả'} #{item.id} · Đơn #{item.order_id}</h3>
                    <p>Tạo lúc: {formatDate(item.created_at)}</p>
                  </div>

                  <span className={`staff-return-status staff-return-status--${item.status}`}>
                    {statusLabels[item.status] || item.status}
                  </span>
                </div>

                <div className="staff-return-card__body">
                  <div>
                    <h4>Khách hàng</h4>
                    <p>{item.user?.username || 'Không có'}</p>
                    <p>{item.user?.email || 'Không có'}</p>
                  </div>

                  <div>
                    <h4>Lý do đổi trả</h4>
                    <p className="staff-return-card__reason">{item.reason || 'Không có mô tả.'}</p>
                  </div>

                  <div>
                    <h4>Ảnh minh chứng</h4>
                    {item.image ? (
                      <button
                        type="button"
                        className="staff-return-card__image-link"
                        onClick={() => openEvidence(item)}
                      >
                        Xem ảnh đính kèm
                      </button>
                    ) : (
                      <p>Khách hàng chưa gửi ảnh.</p>
                    )}
                  </div>
                </div>

                <div className="staff-return-card__footer">
                  <div className="staff-return-card__actions">
                    {(allowedTransitions[item.status] || []).map((nextStatus) => (
                      <button
                        key={nextStatus}
                        type="button"
                        className={`staff-return-action-btn staff-return-action-btn--${nextStatus}`}
                        disabled={actionLoadingId === item.id}
                        onClick={() => updateReturnStatus(item.id, nextStatus)}
                      >
                        {actionLoadingId === item.id ? 'Đang cập nhật...' : transitionLabels[nextStatus]}
                      </button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="staff-returns-pagination">
            <span>
              Hiển thị {pagination.from} - {pagination.to} / {pagination.total} yêu cầu
            </span>

            <div className="staff-returns-pagination__buttons">
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

      {selectedEvidence && (
        <div className="staff-return-evidence-modal" role="presentation" onMouseDown={closeEvidence}>
          <section
            className="staff-return-evidence-modal__content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-return-evidence-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="staff-return-evidence-modal__header">
              <div>
                <h3 id="staff-return-evidence-title">Ảnh minh chứng đổi trả #{selectedEvidence.returnId}</h3>
                <p>Đơn hàng #{selectedEvidence.orderId}</p>
              </div>
              <button type="button" onClick={closeEvidence} aria-label="Đóng ảnh">×</button>
            </div>

            {evidenceLoadError ? (
              <div className="staff-return-evidence-modal__error">
                Không thể tải ảnh. Hãy kiểm tra Laravel đang chạy và liên kết <code>public/storage</code> đã được tạo.
              </div>
            ) : (
              <img
                src={selectedEvidence.url}
                alt={`Ảnh minh chứng của yêu cầu đổi trả #${selectedEvidence.returnId}`}
                onError={() => setEvidenceLoadError(true)}
              />
            )}

            {!evidenceLoadError && (
              <a href={selectedEvidence.url} target="_blank" rel="noreferrer">
                Mở ảnh trong tab mới
              </a>
            )}
          </section>
        </div>
      )}
    </section>
  );
}

export default StaffReturnsPage;
