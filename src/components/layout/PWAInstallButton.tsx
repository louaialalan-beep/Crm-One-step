import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true)
    ) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleInstallClick()}
        title="تثبيت تطبيق Crm-One-step على الجوال أو سطح المكتب (PWA)"
        aria-label="تثبيت تطبيق Crm-One-step"
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#BFDBFE] bg-[#EFF6FF] px-2.5 text-[11px] font-bold text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors shrink-0 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden xl:inline">تثبيت التطبيق</span>
        <span className="xl:hidden">PWA</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/60 p-4 backdrop-blur-xs"
          dir="rtl"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-white">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#0F172A]">
                    تثبيت تطبيق Crm-One-step (PWA)
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    يعمل كتطبيق مستقل على الجوال والحاسوب
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-[#334155] leading-relaxed">
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="font-bold text-[#0F172A] mb-1">1. على متصفح Chrome أو Edge:</p>
                <p>
                  افتح التطبيق في تبويب مستقل ثم اضغط على أيقونة <strong>تثبيت التطبيق (Install App)</strong> في شريط العنوان العلوي.
                </p>
              </div>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                <p className="font-bold text-[#0F172A] mb-1">2. على أجهزة iPhone / iPad (Safari):</p>
                <p>
                  اضغط على زر <strong>المشاركة (Share)</strong> ثم اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D4ED8]"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
