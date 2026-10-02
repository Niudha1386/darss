import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const fallbackCopyText = (val: string) => {
      const textArea = document.createElement("textarea");
      textArea.value = val;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => {
          fallbackCopyText(text);
        });
    } else {
      fallbackCopyText(text);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`p-1 rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1 text-[10px] font-bold ${
        copied 
          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50' 
          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'
      } ${className}`}
      title={copied ? "کپی شد!" : "کپی متن"}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 animate-in zoom-in duration-150" />
          <span>کپی شد!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>کپی</span>
        </>
      )}
    </button>
  );
};
