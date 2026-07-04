import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import './FAQSupportPage.css';

const initialFormState = {
  name: '',
  email: '',
  subject: 'Đơn hàng',
  message: '',
};

const subjectOptions = [
  'Đơn hàng',
  'Sản phẩm',
  'Vận chuyển',
  'Đổi trả / bảo hành',
  'Góp ý khác',
];

function FAQSupportPage() {
  const [faqs, setFaqs] = useState([]);
  const [openFaqId, setOpenFaqId] = useState(null);
  const [loadingFaqs, setLoadingFaqs] = useState(true);
  const [faqError, setFaqError] = useState('');

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, type: 'success', message: '' });
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const fetchMyTickets = useCallback(async () => {
    if (!localStorage.getItem('token')) return;
    try {
      setLoadingTickets(true);
      const response = await api.get('/support-tickets/mine');
      setMyTickets(response.data?.data || []);
    } catch (error) {
      console.error('Không thể tải ticket của khách hàng:', error);
    } finally { setLoadingTickets(false); }
  }, []);

  useEffect(() => {
    const fetchFaqs = async () => {
      setLoadingFaqs(true);
      setFaqError('');

      try {
        const response = await api.get('/faqs');
        const faqItems = response.data?.data || [];
        setFaqs(faqItems);
        setOpenFaqId(faqItems[0]?.id ?? null);
      } catch (error) {
        setFaqError(error.response?.data?.message || 'Không thể tải danh sách câu hỏi thường gặp.');
      } finally {
        setLoadingFaqs(false);
      }
    };

    fetchFaqs();
    fetchMyTickets();
  }, [fetchMyTickets]);

  useEffect(() => {
    if (!toast.show) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 3000);

    return () => clearTimeout(timeout);
  }, [toast.show]);

  const faqCountLabel = useMemo(() => `${faqs.length} câu hỏi phổ biến`, [faqs.length]);

  const validateForm = () => {
    const nextErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = 'Vui lòng nhập họ và tên.';
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Vui lòng nhập email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Email không đúng định dạng.';
    }

    if (!formData.subject.trim()) {
      nextErrors.subject = 'Vui lòng chọn chủ đề hỗ trợ.';
    }

    if (!formData.message.trim()) {
      nextErrors.message = 'Vui lòng nhập nội dung cần hỗ trợ.';
    } else if (formData.message.trim().length < 10) {
      nextErrors.message = 'Nội dung cần ít nhất 10 ký tự để đội ngũ hỗ trợ xử lý tốt hơn.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      setToast({
        show: true,
        type: 'danger',
        message: 'Vui lòng kiểm tra lại thông tin trước khi gửi yêu cầu.',
      });
      return;
    }

    setSubmitting(true);

    try {
      await api.post('/support', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject,
        message: formData.message.trim(),
      });

      await fetchMyTickets();

      setFormData(initialFormState);
      setErrors({});
      setToast({
        show: true,
        type: 'success',
        message: 'Yêu cầu hỗ trợ đã được gửi thành công. Chúng tôi sẽ phản hồi sớm nhất.',
      });
    } catch (error) {
      const apiErrors = error.response?.data?.errors;

      if (apiErrors) {
        const formattedErrors = Object.fromEntries(
          Object.entries(apiErrors).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
        );
        setErrors(formattedErrors);
      }

      setToast({
        show: true,
        type: 'danger',
        message: error.response?.data?.message || 'Không thể gửi yêu cầu hỗ trợ lúc này. Vui lòng thử lại sau.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="faq-support-page">
      {toast.show && (
        <div className={`faq-toast alert alert-${toast.type}`} role="alert">
          {toast.message}
        </div>
      )}

      <section className="faq-support-hero">
        <div className="faq-support-container">
          <span className="faq-support-badge">Hỗ trợ khách hàng</span>
          <h1 className="faq-support-title">FAQ & Hỗ Trợ khách hàng</h1>
          <p className="faq-support-subtitle">
            Tìm nhanh câu trả lời cho những thắc mắc thường gặp về mô hình xe JDM, vận chuyển,
            thanh toán và gửi yêu cầu hỗ trợ trực tiếp cho đội ngũ chăm sóc khách hàng.
          </p>
        </div>
      </section>

      <section className="faq-support-section">
        <div className="faq-support-container faq-grid">
          <div className="faq-card">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">FAQ</p>
                <h2>Câu hỏi thường gặp</h2>
              </div>
              <span className="faq-counter">{faqCountLabel}</span>
            </div>

            {loadingFaqs ? (
              <div className="faq-state">Đang tải FAQ...</div>
            ) : faqError ? (
              <div className="faq-state faq-error">{faqError}</div>
            ) : faqs.length === 0 ? (
              <div className="faq-state">Hiện chưa có câu hỏi nào được hiển thị.</div>
            ) : (
              <div className="faq-accordion">
                {faqs.map((faq) => {
                  const isOpen = openFaqId === faq.id;

                  return (
                    <div key={faq.id} className={`faq-item ${isOpen ? 'open' : ''}`}>
                      <button
                        type="button"
                        className="faq-question"
                        onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                      >
                        <span>{faq.question}</span>
                        <span className="faq-icon">{isOpen ? '−' : '+'}</span>
                      </button>

                      {isOpen && (
                        <div className="faq-answer">
                          <p>{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="support-card">
            <div className="section-heading">
              <div>
                <p className="section-eyebrow">Biểu mẫu liên hệ</p>
                <h2>Gửi yêu cầu hỗ trợ</h2>
              </div>
            </div>

            <p className="support-description">
              Nếu bạn cần hỗ trợ về đơn hàng, tư vấn mẫu xe, tình trạng vận chuyển hoặc đổi trả,
              hãy để lại thông tin chi tiết. Đội ngũ JDM World sẽ phản hồi sớm nhất có thể.
            </p>

            <form className="support-form" onSubmit={handleSubmit} noValidate>
              <div className="support-form-group">
                <label htmlFor="name">Tên của bạn</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Nhập họ và tên"
                  className={errors.name ? 'input-error' : ''}
                />
                {errors.name && <span className="field-error">{errors.name}</span>}
              </div>

              <div className="support-form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  className={errors.email ? 'input-error' : ''}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              <div className="support-form-group">
                <label htmlFor="subject">Chủ đề</label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className={errors.subject ? 'input-error' : ''}
                >
                  {subjectOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {errors.subject && <span className="field-error">{errors.subject}</span>}
              </div>

              <div className="support-form-group">
                <label htmlFor="message">Nội dung tin nhắn</label>
                <textarea
                  id="message"
                  name="message"
                  rows="6"
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="Mô tả vấn đề bạn đang gặp phải hoặc thông tin bạn cần được hỗ trợ..."
                  className={errors.message ? 'input-error' : ''}
                />
                {errors.message && <span className="field-error">{errors.message}</span>}
              </div>

              <button type="submit" className="support-submit-btn" disabled={submitting}>
                {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu hỗ trợ'}
              </button>
            </form>
          </div>
        </div>

        {localStorage.getItem('token') && (
          <section className="my-support-tickets">
            <div className="section-heading"><div><p className="section-eyebrow">My Requests</p><h2>Yêu cầu hỗ trợ của tôi</h2></div><span>{myTickets.length} ticket</span></div>
            <p className="support-description">Phản hồi của JDM World sẽ xuất hiện tại đây và đồng thời được gửi đến email bạn đã cung cấp.</p>
            {loadingTickets ? <div className="faq-state">Đang tải yêu cầu...</div> : myTickets.length === 0 ? <div className="faq-state">Bạn chưa gửi yêu cầu hỗ trợ nào.</div> : (
              <div className="customer-ticket-list">{myTickets.map((ticket) => (
                <article className={`customer-ticket status-${ticket.status}`} key={ticket.id}>
                  <header><div><span>Yêu cầu #{ticket.id}</span><h3>{ticket.subject}</h3></div><b>{ticket.status === 'resolved' ? 'Đã phản hồi' : ticket.status === 'in_progress' ? 'Đang xử lý' : ticket.status === 'closed' ? 'Đã đóng' : 'Chờ xử lý'}</b></header>
                  <div className="customer-ticket-question"><small>NỘI DUNG ĐÃ GỬI</small><p>{ticket.message}</p></div>
                  {ticket.reply_message ? <div className="customer-ticket-reply"><small>PHẢN HỒI TỪ JDM WORLD</small><p>{ticket.reply_message}</p><time>{ticket.replied_at ? new Date(ticket.replied_at).toLocaleString('vi-VN') : ''}</time></div> : <div className="customer-ticket-waiting">Đội ngũ hỗ trợ đang xem xét yêu cầu này.</div>}
                </article>
              ))}</div>
            )}
          </section>
        )}
      </section>
    </div>
  );
}

export default FAQSupportPage;
