import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../styles/AuthPages.css';

function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: Enter email, 2: Enter OTP, 3: Reset password
  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    password: '',
    password_confirmation: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(0);
  const navigate = useNavigate();

  // Timer countdown
  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!formData.otp) {
      newErrors.otp = 'OTP is required';
    } else if (formData.otp.length !== 6) {
      newErrors.otp = 'OTP must be 6 digits';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors = {};
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (!formData.password_confirmation) {
      newErrors.password_confirmation = 'Please confirm password';
    } else if (formData.password !== formData.password_confirmation) {
      newErrors.password_confirmation = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Step 1: Request OTP
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!validateStep1()) return;

    setLoading(true);
    try {
      await axios.post('/api/auth/forgot-password', {
        email: formData.email
      });
      
      setMessage('OTP sent to your email!');
      setStep(2);
      setTimer(60); // 1 minute cooldown
      
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Failed to send OTP';
      if (error.response?.data?.requires_verification) {
        setMessage('Your email is not verified. Please verify your email first.');
      } else {
        setMessage(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP (2FA Layer 1: Email must be verified, Layer 2: OTP verification)
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    try {
      const response = await axios.post('/api/auth/verify-otp', {
        email: formData.email,
        otp: formData.otp
      });
      
      if (response.data.verified) {
        setMessage('OTP verified successfully!');
        setStep(3);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setLoading(true);
    try {
      await axios.post('/api/auth/reset-password', {
        email: formData.email,
        otp: formData.otp,
        password: formData.password,
        password_confirmation: formData.password_confirmation
      });
      
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (timer > 0) return;
    
    setLoading(true);
    try {
      await axios.post('/api/auth/resend-otp', {
        email: formData.email,
        purpose: 'password_reset'
      });
      
      setMessage('New OTP sent to your email!');
      setTimer(60);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Forgot Password</h1>
        <p className="auth-subtitle">Password recovery with 2FA verification</p>
        
        {message && (
          <div className={`message ${message.includes('success') || message.includes('sent') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        {/* Step 1: Enter Email */}
        {step === 1 && (
          <form onSubmit={handleRequestOTP}>
            <div className="step-indicator">Step 1 of 3: Enter your email</div>
            
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'input-error' : ''}
                placeholder="Enter your registered email"
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="info-box">
              <p><strong>2FA Layer 1:</strong> Your email must be verified before resetting password.</p>
              <p><strong>2FA Layer 2:</strong> OTP will be sent to your email for verification.</p>
            </div>

            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {/* Step 2: Enter OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP}>
            <div className="step-indicator">Step 2 of 3: Verify OTP (2FA Layer 2)</div>
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled
              />
            </div>

            <div className="form-group">
              <label htmlFor="otp">Enter 6-digit OTP</label>
              <input
                type="text"
                id="otp"
                name="otp"
                value={formData.otp}
                onChange={handleChange}
                className={errors.otp ? 'input-error' : ''}
                placeholder="Enter OTP from email"
                maxLength={6}
              />
              {errors.otp && <span className="error-text">{errors.otp}</span>}
            </div>

            <div className="timer-box">
              {timer > 0 ? (
                <span>Resend available in {timer}s</span>
              ) : (
                <button type="button" onClick={handleResendOTP} className="btn-link" disabled={loading}>
                  Resend OTP
                </button>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {/* Step 3: Reset Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword}>
            <div className="step-indicator">Step 3 of 3: Set new password</div>
            
            <div className="form-group">
              <label htmlFor="password">New Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                minLength={8}
                required
                className={errors.password ? 'input-error' : ''}
                placeholder="Enter new password (min 8 characters)"
              />
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password_confirmation">Confirm New Password</label>
              <input
                type="password"
                id="password_confirmation"
                name="password_confirmation"
                value={formData.password_confirmation}
                onChange={handleChange}
                minLength={8}
                required
                className={errors.password_confirmation ? 'input-error' : ''}
                placeholder="Confirm new password"
              />
              {errors.password_confirmation && <span className="error-text">{errors.password_confirmation}</span>}
            </div>

            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="auth-links">
          <Link to="/login">Back to Login</Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
