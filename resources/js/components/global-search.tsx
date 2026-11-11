import { router } from '@inertiajs/react';
import { Package, Search, ShoppingCart, Store, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAdminData } from '@/data/admin/store';
import { useAdmin } from '@/hooks/use-admin';
import { cn } from '@/lib/utils';

type Result = {
    key: string;
    icon: LucideIcon;
    group: string;
    title: string;
    sub: string;
    href: string;
};

/** Top-bar search across orders, shops, staff and products (company data). */
export function GlobalSearch() {
    const { t, f, name } = useAdmin();
    const { orders, shops, staff, products } = useAdminData();
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const box = useRef<HTMLDivElement>(null);
    const term = q.trim().toLowerCase();

    const results: Result[] =
        term.length < 2
            ? []
            : [
                  ...orders
                      .filter((o) => o.number.toLowerCase().includes(term))
                      .slice(0, 4)
                      .map((o) => ({
                          key: `o-${o.number}`,
                          icon: ShoppingCart,
                          group: t('nav.orders'),
                          title: o.number,
                          sub: `${name(shops.find((s) => s.id === o.shopId) ?? shops[0])} · ${f.taka(o.total)}`,
                          href: `/orders/${o.number}`,
                      })),
                  ...shops
                      .filter(
                          (s) =>
                              s.name.toLowerCase().includes(term) ||
                              s.name_bn.includes(q.trim()) ||
                              s.code.toLowerCase().includes(term) ||
                              s.phone.includes(term),
                      )
                      .slice(0, 4)
                      .map((s) => ({
                          key: `s-${s.id}`,
                          icon: Store,
                          group: t('nav.shops'),
                          title: name(s),
                          sub: `${s.code} · ${s.route}`,
                          href: `/shops?q=${encodeURIComponent(s.code)}`,
                      })),
                  ...staff
                      .filter(
                          (s) =>
                              s.name.toLowerCase().includes(term) ||
                              s.code.toLowerCase().includes(term) ||
                              s.phone.includes(term),
                      )
                      .slice(0, 3)
                      .map((s) => ({
                          key: `u-${s.code}`,
                          icon: User,
                          group: t('nav.staff'),
                          title: s.name,
                          sub: `${s.code} · ${s.roles.map((r) => t(`admin.role.${r}`)).join(', ')}`,
                          href: `/staff?q=${encodeURIComponent(s.code)}`,
                      })),
                  ...products
                      .filter(
                          (p) =>
                              p.name.toLowerCase().includes(term) ||
                              p.name_bn.includes(q.trim()) ||
                              p.sku.toLowerCase().includes(term),
                      )
                      .slice(0, 3)
                      .map((p) => ({
                          key: `p-${p.id}`,
                          icon: Package,
                          group: t('nav.products'),
                          title: name(p),
                          sub: p.sku,
                          href: `/products?q=${encodeURIComponent(p.sku)}`,
                      })),
              ];

    const go = (r: Result | undefined) => {
        if (!r) {
            return;
        }

        setOpen(false);
        setQ('');
        router.visit(r.href);
    };

    return (
        <div
            ref={box}
            className="relative ml-auto w-full max-w-sm min-w-0"
            onBlur={(e) => {
                if (!box.current?.contains(e.relatedTarget as Node | null)) {
                    setOpen(false);
                }
            }}
        >
            <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
            />
            <input
                type="search"
                role="combobox"
                aria-expanded={open && term.length >= 2}
                aria-controls="global-search-results"
                value={q}
                onChange={(e) => {
                    setQ(e.target.value);
                    setActive(0);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setActive((a) => Math.min(a + 1, results.length - 1));
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setActive((a) => Math.max(a - 1, 0));
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        go(results[active]);
                    } else if (e.key === 'Escape') {
                        setOpen(false);
                    }
                }}
                placeholder={t('header.search')}
                aria-label={t('header.search')}
                className="h-9 w-full rounded-md border bg-background pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
            />
            {open && term.length >= 2 && (
                <div
                    id="global-search-results"
                    role="listbox"
                    className="absolute top-full right-0 left-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-md border bg-popover py-1"
                >
                    {results.length === 0 ? (
                        <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                            {t('header.noResults', { q: q.trim() })}
                        </p>
                    ) : (
                        results.map((r, i) => (
                            <button
                                key={r.key}
                                type="button"
                                role="option"
                                aria-selected={i === active}
                                onMouseEnter={() => setActive(i)}
                                onClick={() => go(r)}
                                className={cn(
                                    'flex w-full items-center gap-3 px-3 py-2 text-left',
                                    i === active && 'bg-muted',
                                )}
                            >
                                <r.icon
                                    className="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                        {r.title}
                                    </span>
                                    <span className="block truncate text-xs text-muted-foreground">
                                        {r.sub}
                                    </span>
                                </span>
                                <span className="shrink-0 text-[11px] text-muted-foreground">
                                    {r.group}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
