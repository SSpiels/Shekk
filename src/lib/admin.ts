/**
 * Shekk Admin — the operator console behind the consumer app.
 *
 * Everything the admin changes lives in one localStorage document
 * (`shekk.admin.v1`). The consumer app reads that document through the
 * selectors at the bottom of this file, so the two sides stay in sync
 * without the admin UI ever being part of the app shell.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { SERVICE_CATEGORIES, type Service, type ServiceStatus } from "./services";
import { BENEFITS, type Benefit } from "./benefits";
import type { CurrencyCode } from "./currencies";

/* --------------------------------------------------------------- config --- */

export type Promotion = {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
  /** Where the promo surfaces in the consumer app. */
  placement: "home" | "explore" | "benefits";
  ctaLabel: string;
  ctaHref: string;
  active: boolean;
  createdISO: string;
};

export type CustomService = {
  id: string;
  categoryId: string;
  name: string;
  partner?: string;
  emoji: string;
  domain?: string;
  blurb: string;
  status: ServiceStatus;
};

export type AdminConfig = {
  hiddenServices: string[];
  serviceStatus: Record<string, ServiceStatus>;
  customServices: CustomService[];
  hiddenBenefits: string[];
  promotions: Promotion[];
  premiumPriceGbp: number;
  fxMarginFree: number;
  fxMarginPremium: number;
  signupsOpen: boolean;
  cardIssuingOpen: boolean;
  maintenanceNote: string;
};

export const defaultAdminConfig: AdminConfig = {
  hiddenServices: [],
  serviceStatus: {},
  customServices: [],
  hiddenBenefits: [],
  promotions: [],
  premiumPriceGbp: 9.99,
  fxMarginFree: 3,
  fxMarginPremium: 1.2,
  signupsOpen: true,
  cardIssuingOpen: true,
  maintenanceNote: "",
};

const CONFIG_KEY = "shekk.admin.v2";
const EVENT = "shekk-admin-config";

function readConfig(): AdminConfig {
  if (typeof window === "undefined") return defaultAdminConfig;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return defaultAdminConfig;
    return { ...defaultAdminConfig, ...(JSON.parse(raw) as Partial<AdminConfig>) };
  } catch {
    return defaultAdminConfig;
  }
}

function writeConfig(next: AdminConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Read + write the admin document. Any component using it stays in sync. */
export function useAdminConfig() {
  const [config, setConfig] = useState<AdminConfig>(defaultAdminConfig);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConfig(readConfig());
    setHydrated(true);
    const sync = () => setConfig(readConfig());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<AdminConfig> | ((c: AdminConfig) => AdminConfig)) => {
    const current = readConfig();
    const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
    writeConfig(next);
    setConfig(next);
  }, []);

  const resetConfig = useCallback(() => {
    writeConfig(defaultAdminConfig);
    setConfig(defaultAdminConfig);
  }, []);

  return { config, hydrated, update, resetConfig };
}

/* ---------------------------------------------- consumer-app selectors --- */

/** The service catalogue as the consumer app should see it right now. */
export function applyCatalogue(config: AdminConfig) {
  return SERVICE_CATEGORIES.map((cat) => {
    const custom: Service[] = config.customServices
      .filter((c) => c.categoryId === cat.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        partner: c.partner,
        emoji: c.emoji || "✨",
        domain: c.domain,
        blurb: c.blurb,
        status: c.status,
      }));
    return {
      ...cat,
      services: [...cat.services, ...custom]
        .filter((s) => !config.hiddenServices.includes(s.id))
        .map((s) => ({ ...s, status: config.serviceStatus[s.id] ?? s.status })),
    };
  }).filter((c) => c.services.length > 0);
}

export function useCatalogue() {
  const { config } = useAdminConfig();
  return useMemo(() => applyCatalogue(config), [config]);
}

export function useVisibleBenefits(): Benefit[] {
  const { config } = useAdminConfig();
  return useMemo(() => BENEFITS.filter((b) => !config.hiddenBenefits.includes(b.id)), [config]);
}

export function usePromotions(placement: Promotion["placement"]) {
  const { config } = useAdminConfig();
  return useMemo(
    () => config.promotions.filter((p) => p.active && p.placement === placement),
    [config, placement],
  );
}

/* ------------------------------------------------------------ analytics --- */

/**
 * Console analytics are no longer mocked here — every figure comes from the
 * backend through `admin.functions.ts` / `admin-data.ts`.
 */

