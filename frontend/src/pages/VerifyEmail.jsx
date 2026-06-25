import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { useApi } from "../api/axios";

// Simple SVG Icons to avoid external dependency issues
const Icons = {
  Loader: () => (
    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
  ShieldCheck: () => (
    <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  Mail: () => (
    <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Refresh: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Alert: () => (
    <svg className="w-5 h-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
};

const VerifyEmail = () => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const [otpTimer, setOtpTimer] = useState(600); // 10 minutes OTP validity

  const inputRefs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const api = useApi();
  const email = location.state?.email;

  useEffect(() => {
    if (!email) {
      navigate("/register");
    } else {
      // Focus first input when page loads
      setTimeout(() => {
        if (inputRefs[0].current) {
          inputRefs[0].current.focus();
        }
      }, 100);
    }
  }, [email, navigate]);

  useEffect(() => {
    let timer;
    if (resendTimer > 0) {
      timer = setInterval(() => setResendTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendTimer]);

  useEffect(() => {
    let timer;
    if (otpTimer > 0) {
      timer = setInterval(() => setOtpTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [otpTimer]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    
    // If user types multiple digits (paste or autocorrect), fill from current index
    if (value.length > 1) {
      for (let i = 0; i < value.length && index + i < 6; i++) {
        newOtp[index + i] = value[i];
      }
    } else {
      // Single digit - place at current index
      newOtp[index] = value.slice(-1);
    }
    
    setOtp(newOtp);

    // Move focus to next empty slot or last slot
    if (value) {
      let nextIndex = index;
      while (nextIndex < 5 && newOtp[nextIndex] !== "") {
        nextIndex++;
      }
      if (nextIndex <= 5 && inputRefs[nextIndex].current) {
        inputRefs[nextIndex].current.focus();
      }
    }

    if (newOtp.every((digit) => digit !== "")) {
      verifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace") {
      const newOtp = [...otp];
      if (newOtp[index] !== "") {
        // Clear current cell
        newOtp[index] = "";
        setOtp(newOtp);
      } else if (index > 0) {
        // Move to previous cell and clear it
        inputRefs[index - 1].current.focus();
        newOtp[index - 1] = "";
        setOtp(newOtp);
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs[index - 1].current.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs[index + 1].current.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").slice(0, 6).replace(/\D/g, ""); // Only keep digits
    if (/^\d+$/.test(pasteData)) {
      const newOtp = [...otp];
      let startIndex = newOtp.findIndex(d => d === ""); // Find first empty slot
      if (startIndex === -1) startIndex = 0; // If all full, start from beginning
      
      pasteData.split("").forEach((char, i) => {
        if (startIndex + i < 6) newOtp[startIndex + i] = char;
      });
      setOtp(newOtp);
      
      if (newOtp.every((digit) => digit !== "")) {
        verifyOtp(newOtp.join(""));
      } else {
        // Focus next empty slot after paste
        const nextEmpty = newOtp.findIndex(d => d === "");
        if (nextEmpty !== -1 && inputRefs[nextEmpty].current) {
          inputRefs[nextEmpty].current.focus();
        } else if (inputRefs[5].current) {
          inputRefs[5].current.focus();
        }
      }
    }
  };

  const verifyOtp = async (code) => {
    if (!code || code.length < 6) {
      setError("يرجى إدخال الرمز كاملاً.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      console.log(`[Auth] Verifying email for: ${email}`);
      const res = await api.post("auth/verify-email", {
        email,
        code
      });
      
      console.log("[Auth] Verification response:", res.data);
      
      if (res.data.token) {
        setSuccessMsg(res.data.message || "تم تفعيل حسابك بنجاح، مرحبًا بك في سوقك.");
        localStorage.setItem("token", res.data.token);
        setTimeout(() => {
          login(res.data.token, res.data.user);
          navigate("/", { replace: true });
        }, 2000);
      } else {
        throw new Error("لم يتم استلام توكن المصادقة.");
      }
    } catch (err) {
      console.error("[Auth] Verification error:", err);
      const serverError = err.response?.data?.error;
      setError(serverError || "الرمز غير صحيح أو منتهي الصلاحية.");
      setOtp(["", "", "", "", "", ""]);
      if (inputRefs[0].current) inputRefs[0].current.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setError("");
    try {
      console.log(`[Auth] Resending OTP to: ${email}`);
      await api.post("auth/resend-otp", { email });
      setOtpTimer(600);
      setResendTimer(60);
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
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (successMsg) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icons.ShieldCheck />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">تم التفعيل بنجاح!</h2>
          <p className="text-gray-600 mb-6">{successMsg}</p>
          <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
            <Icons.Loader />
            <span>جاري توجيهك للصفحة الرئيسية...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12 font-cairo">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-blue-600 px-8 py-10 text-center text-white">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Icons.Mail />
          </div>
          <h1 className="text-2xl font-bold mb-2">تفعيل الحساب</h1>
          <p className="text-blue-100 opacity-90">
            أدخل رمز التحقق المكون من 6 أرقام المرسل إلى:
            <br />
            <span className="font-semibold text-white mt-1 block dir-ltr">{email}</span>
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-r-4 border-red-500 rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
              <Icons.Alert />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div dir="ltr" className="flex gap-2 mb-8 justify-center" onPaste={handlePaste} style={{ direction: 'ltr', textAlign: 'center' }}>
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
                disabled={loading}
                dir="ltr"
                style={{ direction: 'ltr', textAlign: 'center' }}
                className={`w-12 h-14 text-center text-xl font-bold border-2 rounded-xl transition-all duration-200 focus:ring-4 focus:ring-blue-100 outline-none
                  ${digit ? "border-blue-600 bg-blue-50/30" : "border-gray-200 hover:border-gray-300"}
                  ${error ? "border-red-300 focus:border-red-500 focus:ring-red-100" : "focus:border-blue-600"}
                  disabled:bg-gray-50 disabled:cursor-not-allowed`}
              />
            ))}
          </div>

          <div className="space-y-4">
            <button
              onClick={() => verifyOtp(otp.join(""))}
              disabled={loading || otp.some((d) => !d)}
              className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:bg-blue-600 disabled:active:scale-100 flex items-center justify-center gap-3 shadow-lg shadow-blue-200"
            >
              {loading ? (
                <>
                  <Icons.Loader />
                  <span>جاري التحقق...</span>
                </>
              ) : (
                <span>تأكيد الرمز</span>
              )}
            </button>

            <div className="flex flex-col items-center gap-3 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>تنتهي صلاحية الرمز خلال:</span>
                <span className={`font-bold ${otpTimer < 60 ? "text-red-500" : "text-gray-700"}`}>
                  {formatTime(otpTimer)}
                </span>
              </div>

              <button
                onClick={handleResend}
                disabled={resendLoading || resendTimer > 0}
                className="flex items-center gap-2 text-blue-600 font-bold hover:text-blue-700 disabled:text-gray-400 transition-colors group"
              >
                {resendLoading ? (
                  <Icons.Loader />
                ) : (
                  <Icons.Refresh />
                )}
                <span>
                  إعادة إرسال الرمز {resendTimer > 0 ? `(${resendTimer})` : ""}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
