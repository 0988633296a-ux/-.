"use client";
import { X } from "lucide-react";
import { useCallback, useEffect } from "react";
export default function Dialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", fn);
    };
  }, [onClose]);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (node) node.focus();
  }, []);
  return (
    <div
      className="dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`dialog ${wide ? "wide" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            const els = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
              ),
            );
            const first = els[0],
              last = els[els.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first ||
                document.activeElement === e.currentTarget)
            ) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="dialog-heading">
          <div>
            {subtitle && <small>{subtitle}</small>}
            <h2>{title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
          >
            <X size={23} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}
