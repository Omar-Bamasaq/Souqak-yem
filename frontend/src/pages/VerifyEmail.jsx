import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";
import { useApi } from "../api/axios.js";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const api = useApi();
  const email = location.state?.email || "";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpTimer, setOtpTimer] = useState(600); // 10 minutes
  const [resendTimer, setResendTimer] = useState(60); // 1 minute
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  
  const [successMsg, setSuccessMsg] = useState("");
  
  const inputRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ];

  useEffect(() => {
    if (!email) {
      navigate("/register");
    }
  }, [email, navigate]);

  useEffect(() => {
    let interval = null;
    if (otpTimer > 0 && !successMsg) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer, successMsg]);

  useEffect(() => {
    let interval = null;
    if (resendTimer > 0 && !successMsg) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer, successMsg]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      inputRefs[index + 1].current.focus();
    }

    // Auto submit if full
    if (newOtp.every(digit => digit !== "")) {
      verifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").slice(0, 6).split("");
    if (pasteData.every(char => /^\d$/.test(char))) {
      const newOtp = [...otp];
      pasteData.forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      if (newOtp.every(digit => digit !== "")) {
        verifyOtp(newOtp.join(""));
      } else if (pasteData.length < 6) {
        inputRefs[pasteData.length].current.focus();
      }
    }
  };

  const verifyOtp = async (code) => {
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-email", {
        email,
        code
      });
      if (res.data.token) {
        setSuccessMsg(res.data.message || "تم تفعيل حسابك بنجاح، مرحبًا بك في سوقك.");
        localStorage.setItem("isNewUserRegistration", "true");
        setTimeout(() => {
          login(res.data.token, res.data.user);
          navigate("/");
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || "الرمز غير صحيح أو منتهي الصلاحية.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs[0].current.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setError("");
    try {
      await api.post("/auth/resend-otp", { email });
      setOtpTimer(600); // Reset OTP validity timer
      setResendTimer(60); // Reset resend button delay timer
      setOtp(["", "", "", "", "", ""]);
      inputRefs[0].current.focus();
    } catch (err) {
      setError(err.response?.data?.error || "فشل إعادة إرسال الرمز.");
    } finally {
      setResendLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[2rem] border border-gray-100 p-8 lg:p-10 shadow-xl shadow-gray-200/50 text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">التحقق من البريد الإلكتروني</h1>
        
        {successMsg ? (
          <div className="my-8 p-6 bg-green-50 border border-green-200 rounded-3xl animate-in fade-in zoom-in duration-500">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-800 font-bold text-lg">{successMsg}</p>
            <p className="text-green-600 text-sm mt-2">جاري تحويلك للصفحة الرئيسية...</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              لقد أرسلنا رمز التحقق إلى بريدك الإلكتروني:<br/>
              <span className="font-semibold text-gray-800">{email}</span>
            </p>

            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-center gap-2 mb-10" dir="ltr">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                  disabled={loading}
                />
              ))}
            </div>

            <div className="mb-10">
              <div className="text-sm text-gray-400 mb-6">
                {otpTimer > 0 ? (
                  <>
                    الوقت المتبقي لصلاحية الرمز:
                    <span className="block text-lg font-mono font-bold text-blue-600 mt-1">
                      {formatTime(otpTimer)}
                    </span>
                  </>
                ) : (
                  <span className="text-red-500 font-semibold">انتهت صلاحية الرمز. يرجى طلب رمز جديد.</span>
                )}
              </div>

              <div className="space-y-3">
                {resendTimer > 0 ? (
                  <p className="text-sm text-gray-400">
                    يمكنك إعادة إرسال الرمز خلال: 
                    <span className="text-blue-600 font-bold mx-1">{formatTime(resendTimer)}</span>
                  </p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="text-blue-600 font-semibold hover:text-blue-700 transition-colors disabled:opacity-50"
                  >
                    {resendLoading ? "جاري الإرسال..." : "إعادة إرسال الرمز"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-3 pt-6 border-t border-gray-50">
          <Link
            to="/register"
            className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
          >
            العودة لصفحة التسجيل
          </Link>
        </div>
      </div>
    </div>
  );
}
