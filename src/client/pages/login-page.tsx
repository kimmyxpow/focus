import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { modelenceMutation } from '@modelence/react-query';
import toast from 'react-hot-toast';
import Page from '@/client/components/page';

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

type Step = 'method' | 'email' | 'otp';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('_redirect') || '/';
  
  const [step, setStep] = useState<Step>('method');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const sendOTPMutation = useMutation({
    ...modelenceMutation('auth.sendOTP'),
    onSuccess: (data) => {
      const result = data as { cooldown?: number };
      setStep('otp');
      setResendCooldown(result.cooldown || 60);
      toast.success('Code sent! Check your email.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send code');
    },
  });

  const verifyOTPMutation = useMutation({
    ...modelenceMutation('auth.verifyOTP'),
    onSuccess: (data) => {
      const result = data as { isNewUser: boolean };
      if (result.isNewUser) {
        toast.success('Welcome to Focus!');
      } else {
        toast.success('Welcome back!');
      }
      window.location.href = redirect;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Invalid code');
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    },
  });

  const handleGoogleSignIn = () => {
    const redirectParam = redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : '';
    window.location.href = `/api/_internal/auth/google${redirectParam}`;
  };

  const handleGitHubSignIn = () => {
    const redirectParam = redirect !== '/' ? `?redirect=${encodeURIComponent(redirect)}` : '';
    window.location.href = `/api/_internal/auth/github${redirectParam}`;
  };

  const handleEmailSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    
    sendOTPMutation.mutate({ email: email.trim() });
  }, [email, sendOTPMutation]);

  const handleOTPChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (digit && index === 5) {
      const fullCode = newOtp.join('');
      if (fullCode.length === 6) {
        verifyOTPMutation.mutate({ email: email.trim(), code: fullCode });
      }
    }
  }, [otp, email, verifyOTPMutation]);

  const handleOTPKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  }, [otp]);

  const handleOTPPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('');
      setOtp(newOtp);
      verifyOTPMutation.mutate({ email: email.trim(), code: pastedData });
    }
  }, [email, verifyOTPMutation]);

  const handleResendCode = useCallback(() => {
    sendOTPMutation.mutate({ email: email.trim() });
  }, [email, sendOTPMutation]);

  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  return (
    <Page variant="dark">
      <div className="container-xs flex items-center justify-center min-h-[70vh]">
        <div className="py-8 w-full fade-in">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center mx-auto mb-5">
              <span className="text-2xl font-bold text-stone-900">F</span>
            </div>
            <h1 className="text-display-sm text-white mb-2">
              {step === 'otp' ? 'Enter your code' : 'Welcome to Focus'}
            </h1>
            <p className="text-white/50 text-sm">
              {step === 'otp' 
                ? `We sent a 6-digit code to ${email}`
                : 'Sign in to start focusing with others'
              }
            </p>
          </div>

          {step === 'method' && (
            <>
              {/* OAuth Buttons */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-white text-stone-900 font-medium text-sm hover:bg-white/90 transition-colors"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={handleGitHubSignIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/15 transition-colors border border-white/10"
                >
                  <GitHubIcon />
                  Continue with GitHub
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-white/40">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Email Option */}
              <button
                type="button"
                onClick={() => setStep('email')}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-white/5 text-white font-medium text-sm hover:bg-white/10 transition-colors border border-white/10"
              >
                <MailIcon />
                Continue with Email
              </button>

              {/* Info */}
              <p className="text-xs text-white/40 text-center mt-6">
                No password needed - we'll send you a login code.
              </p>
            </>
          )}

          {step === 'email' && (
            <>
              <button
                type="button"
                onClick={() => setStep('method')}
                className="flex items-center gap-1 text-white/50 hover:text-white text-sm mb-6 transition-colors"
              >
                <ArrowLeftIcon />
                Back
              </button>

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all"
                    disabled={sendOTPMutation.isPending}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!email.trim() || sendOTPMutation.isPending}
                  className="w-full px-4 py-3 rounded-lg bg-white text-stone-900 font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendOTPMutation.isPending ? 'Sending...' : 'Send login code'}
                </button>
              </form>

              <p className="text-xs text-white/40 text-center mt-6">
                We'll send you a 6-digit code to sign in.
              </p>
            </>
          )}

          {step === 'otp' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setOtp(['', '', '', '', '', '']);
                }}
                className="flex items-center gap-1 text-white/50 hover:text-white text-sm mb-6 transition-colors"
              >
                <ArrowLeftIcon />
                Change email
              </button>

              <div className="space-y-6">
                <div className="flex justify-center gap-2">
                  {[0, 1, 2, 3, 4, 5].map((position) => (
                    <input
                      key={position}
                      ref={(el) => {otpInputRefs.current[position] = el}}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={otp[position]}
                      onChange={(e) => handleOTPChange(position, e.target.value)}
                      onKeyDown={(e) => handleOTPKeyDown(position, e)}
                      onPaste={position === 0 ? handleOTPPaste : undefined}
                      disabled={verifyOTPMutation.isPending}
                      className="w-12 h-14 text-center text-xl font-semibold rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent transition-all disabled:opacity-50"
                      aria-label={`Digit ${position + 1} of 6`}
                    />
                  ))}
                </div>

                {verifyOTPMutation.isPending && (
                  <p className="text-white/50 text-sm text-center">Verifying...</p>
                )}

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={sendOTPMutation.isPending || resendCooldown > 0}
                    className="text-white/50 hover:text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendOTPMutation.isPending 
                      ? 'Sending...' 
                      : resendCooldown > 0 
                        ? `Resend code in ${resendCooldown}s`
                        : "Didn't receive the code? Resend"}
                  </button>
                </div>
              </div>

              <p className="text-xs text-white/40 text-center mt-6">
                Code expires in 10 minutes.
              </p>
            </>
          )}

          <p className="text-xs text-white/40 text-center mt-6">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="text-white/60 hover:text-white underline">
              Terms and Conditions
            </Link>
          </p>
        </div>
      </div>
    </Page>
  );
}
