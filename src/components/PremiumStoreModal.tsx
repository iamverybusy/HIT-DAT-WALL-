import { CheckCircle2, Lock, ShoppingBag, Sparkles, X } from 'lucide-react';
import { PREMIUM_PRODUCTS } from '../constants/gameData';
import type { PlayerProgression } from '../types/game';

interface PremiumStoreModalProps {
  progression: PlayerProgression;
  onClose: () => void;
}

export function PremiumStoreModal({ progression, onClose }: PremiumStoreModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="supporter-store-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-purple-500/40 bg-[#14131C] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-purple-900/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-400/45 bg-purple-950/60 text-purple-300">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="supporter-store-title"
                className="font-display text-2xl font-bold text-zinc-100"
              >
                Supporter Store &amp; Permanent Perks
              </h2>
              <p className="text-xs text-purple-200/80">
                IRL Currency entitlements are saved to your account and NEVER wiped on reset or Boss
                failure.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Supporter Store"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-[#1D2027] text-zinc-300 hover:border-purple-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Coming Soon Notice */}
        <div className="border-b border-purple-900/40 bg-[#1B1729] px-6 py-3 text-xs text-purple-200">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <Sparkles className="h-4 w-4" />
            Early Development Storefront Preview (Payments Not Yet Active)
          </div>
          <p className="mt-1 text-zinc-300">
            IRL checkout is currently disabled during active development. Any permanent items
            recorded on your account automatically carry over across every Start Game reset and Boss
            wipe.
          </p>
        </div>

        {/* Product Grid */}
        <div className="grid flex-1 gap-3.5 overflow-y-auto p-6 sm:grid-cols-2">
          {PREMIUM_PRODUCTS.map((product) => {
            const owned = progression.ownedPremiumItems.includes(product.id);
            return (
              <div
                key={product.id}
                className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#1A1B24] p-4 shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className="inline-block rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-950"
                        style={{ backgroundColor: product.badgeColor }}
                      >
                        {product.tagline}
                      </span>
                      <h3 className="font-display mt-1.5 text-lg font-bold text-zinc-100">
                        {product.name}
                      </h3>
                    </div>
                    {owned && (
                      <span className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Owned
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                    {product.description}
                  </p>

                  <ul className="mt-3 space-y-1 text-xs text-zinc-200">
                    {product.perks.map((perk) => (
                      <li key={perk} className="flex items-center gap-1.5">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: product.badgeColor }}
                          aria-hidden="true"
                        />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-[#12131A] px-4 py-2 text-xs font-bold text-zinc-400 opacity-80 cursor-not-allowed"
                >
                  <Lock className="h-3.5 w-3.5 text-purple-400" />
                  {owned ? 'Active Forever on Account' : product.priceLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
