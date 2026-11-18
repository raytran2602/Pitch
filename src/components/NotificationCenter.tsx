import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  Briefcase,
  CheckCheck,
  FileWarning,
  HeartPulse,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  IncomingTransferBid,
  Language,
  ManagerNotification,
  NavSection,
  NotificationType,
} from '../types/game';
import { t } from '../utils/i18n';
import { useIsMobileLandscape } from '../utils/useMobileLandscape';

interface NotificationCenterProps {
  notifications: ManagerNotification[];
  incomingBids: IncomingTransferBid[];
  language: Language;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onOpenBid: (bidId: string) => void;
  onNavigate: (nav: NavSection) => void;
}

function getTypeMeta(type: NotificationType, lang: Language) {
  switch (type) {
    case 'TRANSFER_BID':
      return {
        label: t(lang, 'incomingOffer'),
        icon: <ArrowLeftRight className="w-4 h-4 text-[#00FF85]" />,
        badgeCls: 'text-[#00FF85] border-[#00FF85]/35 bg-[#00FF85]/10',
      };
    case 'LOAN_BID':
      return {
        label: t(lang, 'loanBidAlert'),
        icon: <ArrowLeftRight className="w-4 h-4 text-sky-300" />,
        badgeCls: 'text-sky-300 border-sky-400/35 bg-sky-500/15',
      };
    case 'INJURY':
      return {
        label: t(lang, 'injuryAlert'),
        icon: <HeartPulse className="w-4 h-4 text-rose-400" />,
        badgeCls: 'text-rose-300 border-rose-400/35 bg-rose-500/15',
      };
    case 'SUSPENSION':
      return {
        label: t(lang, 'suspensionAlert'),
        icon: <ShieldAlert className="w-4 h-4 text-amber-300" />,
        badgeCls: 'text-amber-300 border-amber-400/35 bg-amber-500/15',
      };
    case 'CONTRACT':
      return {
        label: t(lang, 'contractAlert'),
        icon: <FileWarning className="w-4 h-4 text-sky-300" />,
        badgeCls: 'text-sky-300 border-sky-400/35 bg-sky-500/15',
      };
    case 'BOARD':
      return {
        label: t(lang, 'boardAlert'),
        icon: <Briefcase className="w-4 h-4 text-rose-400" />,
        badgeCls: 'text-rose-300 border-rose-400/35 bg-rose-500/15',
      };
  }
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  incomingBids,
  language,
  onMarkRead,
  onMarkAllRead,
  onOpenBid,
  onNavigate,
}) => {
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<ManagerNotification[]>([]);
  const isMobileLandscape = useIsMobileLandscape();
  const seenIdsRef = useRef<Set<string> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Detect newly arrived unread notifications to trigger quick toasts
  useEffect(() => {
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(notifications.map((n) => n.id));
      return;
    }
    const fresh: ManagerNotification[] = [];
    for (const n of notifications) {
      if (!seenIdsRef.current.has(n.id)) {
        seenIdsRef.current.add(n.id);
        if (!n.read) fresh.push(n);
      }
    }
    if (fresh.length > 0) {
      setToasts((prev) => [...fresh.slice(0, 3), ...prev].slice(0, 3));
    }
  }, [notifications]);

  // Auto-dismiss toasts after 6s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => {
      setToasts((prev) => prev.slice(0, -1));
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  // Close drawer on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleNotificationAction = (n: ManagerNotification) => {
    onMarkRead(n.id);
    setToasts((prev) => prev.filter((item) => item.id !== n.id));
    setOpen(false);
    if ((n.type === 'TRANSFER_BID' || n.type === 'LOAN_BID') && n.bidId) {
      onOpenBid(n.bidId);
    } else if (n.type === 'BOARD') {
      onNavigate('office');
    } else if (n.type === 'SUSPENSION') {
      onNavigate('lineup');
    } else {
      onNavigate('squad');
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t(language, 'notifications')}
        aria-expanded={open}
        className={`relative inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/8 hover:bg-white/15 text-white cursor-pointer transition-colors ${
          isMobileLandscape ? 'w-8 h-8' : 'w-9 h-9'
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[#00FF85] text-slate-950 font-mono text-[9px] font-extrabold tabular-nums flex items-center justify-center shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Notification Drawer */}
      {open && (
        <div
          role="region"
          aria-label={t(language, 'notifications')}
          className="animate-modal-pop absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-1rem)] sm:w-96 rounded-2xl pitch-modal-shell z-[100] overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/10 bg-black/50 flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <span>{t(language, 'notifications')}</span>
              {unreadCount > 0 && (
                <span className="text-xs font-mono text-[#00FF85] tabular-nums">
                  ({unreadCount})
                </span>
              )}
            </div>
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:text-white cursor-pointer whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t(language, 'markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-[min(380px,70dvh)] overflow-y-auto divide-y divide-white/8">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-400">
                {t(language, 'noNotifications')}
              </div>
            ) : (
              notifications.map((n) => {
                const meta = getTypeMeta(n.type, language);
                const linkedBid = n.bidId
                  ? incomingBids.find((b) => b.id === n.bidId)
                  : undefined;
                const isPendingBid = linkedBid?.status === 'PENDING';
                return (
                  <div
                    key={n.id}
                    className={`px-4 py-3 transition-colors ${
                      n.read ? 'bg-black/15 opacity-80' : 'bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5 shrink-0">{meta.icon}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className={`font-semibold px-1.5 py-0.2 rounded border text-[10px] ${meta.badgeCls}`}>
                              {meta.label}
                            </span>
                            <span className="font-mono tabular-nums">{n.dateIso}</span>
                            {!n.read && (
                              <span className="text-[10px] font-bold text-[#00FF85]">
                                · {language === 'vi' ? 'Mới' : 'New'}
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-white mt-1 truncate">
                            {n.title}
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleNotificationAction(n)}
                              className="text-[11px] font-bold text-[#00FF85] hover:underline cursor-pointer whitespace-nowrap"
                            >
                              {n.type === 'TRANSFER_BID' || n.type === 'LOAN_BID'
                                ? isPendingBid
                                  ? t(language, 'reviewBid')
                                  : linkedBid?.status ?? t(language, 'reviewBid')
                                : n.type === 'BOARD'
                                ? t(language, 'goToJobMarket')
                                : t(language, 'viewSquad')}
                            </button>
                            {!n.read && (
                              <button
                                type="button"
                                onClick={() => onMarkRead(n.id)}
                                className="text-[11px] text-slate-400 hover:text-white cursor-pointer whitespace-nowrap"
                              >
                                {language === 'vi' ? 'Đã đọc' : 'Dismiss'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Quick Alert Toasts */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className={`fixed z-[90] space-y-2 pointer-events-none ${
            isMobileLandscape
              ? 'bottom-2 right-12 w-72 max-w-[calc(100vw-4.5rem)]'
              : 'top-16 right-4 w-80 sm:w-96'
          }`}
        >
          {(isMobileLandscape ? toasts.slice(0, 1) : toasts).map((toast) => {
            const meta = getTypeMeta(toast.type, language);
            return (
              <div
                key={`toast_${toast.id}`}
                className={`pointer-events-auto rounded-xl border border-white/20 bg-[var(--pitch-modal-bg,#1B0721)]/95 backdrop-blur-md shadow-xl flex items-start gap-2.5 ${
                  isMobileLandscape ? 'p-2.5' : 'p-3.5 gap-3'
                }`}
              >
                <div className="mt-0.5 shrink-0">{meta.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-300">{meta.label}</span>
                    <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {toast.dateIso}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5 truncate">
                    {toast.title}
                  </div>
                  <p className={`text-[11px] text-slate-300 mt-0.5 ${isMobileLandscape ? 'line-clamp-1' : 'line-clamp-2'}`}>
                    {toast.message}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleNotificationAction(toast)}
                      className="text-[11px] font-bold text-[#00FF85] hover:underline cursor-pointer whitespace-nowrap py-0.5"
                    >
                      {toast.type === 'TRANSFER_BID' || toast.type === 'LOAN_BID'
                        ? t(language, 'reviewBid')
                        : toast.type === 'BOARD'
                        ? t(language, 'goToJobMarket')
                        : t(language, 'viewSquad')}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
                  aria-label="Dismiss notification"
                  className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
