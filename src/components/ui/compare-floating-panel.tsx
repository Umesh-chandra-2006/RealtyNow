import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GitCompare, X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { getCompareIds, clearCompareList, fetchComparedProperties } from '../../lib/compare';
import { useAuth } from '../../lib/auth';
import { getPropertyPricingDisplay } from '../../lib/plot-pricing';
import { Button } from '../ui';
import type { Property } from '../../lib/types';
import { getPropertyCoverImage, handleImageError, DEFAULT_PROPERTY_IMAGE } from '../../lib/property-images';

const SESSION_DISMISSED_KEY = 'realtynow_compare_panel_dismissed';

function getSessionDismissed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}
function setSessionDismissed(val: boolean) {
  try {
    if (val) sessionStorage.setItem(SESSION_DISMISSED_KEY, '1');
    else sessionStorage.removeItem(SESSION_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}

export function CompareFloatingPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>(getCompareIds());
  const [properties, setProperties] = useState<Property[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  // Use sessionStorage so dismissed state survives ALL React re-renders
  const [isDismissed, setIsDismissedState] = useState<boolean>(getSessionDismissed);

  const prevIdsLengthRef = useRef(getCompareIds().length);
  // Guard against calling fetchComparedProperties concurrently
  const fetchingRef = useRef(false);

  const dismiss = () => {
    setSessionDismissed(true);
    setIsDismissedState(true);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearCompareList(user?.id);
    dismiss();
  };

  // Listen for compare list changes (add/remove from property cards)
  useEffect(() => {
    const handleUpdate = (e: CustomEvent) => {
      const newIds: string[] = e.detail.ids;
      const prevLen = prevIdsLengthRef.current;
      prevIdsLengthRef.current = newIds.length;
      setIds(newIds);

      // Only re-open if a NEW property was actually added
      if (newIds.length > prevLen) {
        setSessionDismissed(false);
        setIsDismissedState(false);
      }
    };
    window.addEventListener('realtynow-compare-updated', handleUpdate as EventListener);
    return () => window.removeEventListener('realtynow-compare-updated', handleUpdate as EventListener);
  }, []);

  // Fetch property details only when IDs change AND panel is visible
  useEffect(() => {
    if (ids.length === 0) {
      setProperties([]);
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    fetchComparedProperties(user?.id).then((data) => {
      setProperties(data);
      fetchingRef.current = false;
    });
  }, [ids.join(','), user?.id]);

  // Nothing to show
  if (ids.length === 0 || isDismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none flex justify-center px-3 sm:px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <AnimatePresence>
        <motion.div
          key="compare-panel"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="bg-white rounded-2xl border border-gray-200 pointer-events-auto overflow-hidden flex flex-col w-full max-w-4xl"
          style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.15)' }}
        >
          {/* Header */}
          <div
            className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between cursor-pointer select-none"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div className="flex items-center gap-2.5 font-semibold text-sm">
              <GitCompare className="h-4 w-4 text-red-400" />
              Compare Properties
              <span className="bg-red-600 text-[11px] px-2 py-0.5 rounded-full font-bold">{ids.length}/4</span>
            </div>

            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {/* Minimize/Expand */}
              <button
                className="p-1.5 hover:bg-white/15 rounded-lg transition-colors text-white/70 hover:text-white"
                onClick={() => setIsMinimized((v) => !v)}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {/* Clear All */}
              <button
                className="p-1.5 hover:bg-red-600/40 rounded-lg transition-colors text-white/70 hover:text-red-300"
                onClick={clearAll}
                title="Clear all & close"
              >
                <Trash2 className="h-4 w-4" />
              </button>

              {/* Close / Dismiss permanently for this session */}
              <button
                className="p-1.5 hover:bg-white/15 rounded-lg transition-colors text-white/70 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss();
                }}
                title="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <AnimatePresence>
            {!isMinimized && (
              <motion.div
                key="panel-body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between overflow-hidden"
              >
                {/* Property Mini Cards */}
                <div className="flex gap-3 overflow-x-auto pb-1 flex-1">
                  {properties.map((p) => (
                    <div
                      key={p.id}
                      className="flex gap-2.5 bg-gray-50 rounded-xl p-2 min-w-[190px] max-w-[220px] border border-gray-200 items-center shrink-0"
                    >
                      <img
                        src={getPropertyCoverImage(p)}
                        className="w-11 h-11 rounded-lg object-cover bg-gray-200 shrink-0"
                        alt=""
                        onError={(e) => handleImageError(e, DEFAULT_PROPERTY_IMAGE)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-900 truncate leading-tight" title={p.title}>
                          {p.title}
                        </p>
                        <p className="text-xs font-bold text-red-600 mt-0.5">
                          {getPropertyPricingDisplay(p, { compactConstructed: true }).primaryPrice}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Empty Slot placeholders */}
                  {Array.from({ length: Math.max(0, Math.min(2, 4 - properties.length)) }).map((_, i) => (
                    <div
                      key={`slot-${i}`}
                      className="flex bg-gray-50/50 rounded-xl p-2 min-w-[130px] border border-dashed border-gray-200 items-center justify-center shrink-0 opacity-60"
                    >
                      <p className="text-[11px] font-medium text-gray-400">+ Add property</p>
                    </div>
                  ))}
                </div>

                {/* Compare Button */}
                <div className="shrink-0 flex flex-col items-center gap-1">
                  <Button
                    onClick={() => {
                      navigate('/compare');
                    }}
                    disabled={properties.length < 2}
                    className="w-full md:w-auto font-bold"
                    icon={<GitCompare className="h-4 w-4" />}
                  >
                    Compare Now
                  </Button>
                  {properties.length < 2 && (
                    <p className="text-[10px] text-gray-400">Add {2 - properties.length} more to compare</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
