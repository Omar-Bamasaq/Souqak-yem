import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import useApi from "../api/axios";
import { Loader2, ShieldCheck, Mail, RefreshCw, AlertCircle } from "lucide-react";

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
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs[index + 1].current.focus();
    }

    if (newOtp.every((digit) => digit !== "")) {
      verifyOtp(newOtp.join(""));
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs[index - 1].current.focus();
    }
  };

  const handlePaste = (e) => {
    const pasteData = e.clipboardData.getData("text").slice(0, 6);
    if (/^\d+$/.test(pasteData)) {
      const newOtp = [...otp];
      pasteData.split("").forEach((char, i) => {
        if (i < 6) newOtp[i] = char;
      });
      setOtp(newOtp);
      if (newOtp.every((digit) => digit !== "")) {
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
      console.log(`[Auth] Verifying email for: ${email}`);
      const res = await api.post("auth/verify-email", {
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
            <ShieldCheck className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">تم التفعيل بنجاح!</h2>
          <p className="text-gray-600 mb-6">{successMsg}</p>
          <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
            <Loader2 className="w-5 h-5 animate-spin" />
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
            <Mail className="w-8 h-8 text-white" />
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
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          <div className="flex gap-2 mb-8 dir-ltr justify-center" onPaste={handlePaste}>
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
                  <Loader2 className="w-5 h-5 animate-spin" />
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className={`w-4 h-4 ${resendTimer > 0 ? "" : "group-hover:rotate-180 transition-transform duration-500"}`} />
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
