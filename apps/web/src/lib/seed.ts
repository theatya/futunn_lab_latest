import {
  BOARD_CONFIG_DEFAULT,
  initialLangCopy,
  type Content,
  type LangCopy,
  type Project,
  type TargetBoard,
} from "@futu/domain";
import { slotByKey, slotTarget } from "@futu/specs";

const EN: LangCopy = {
  sub: "Transfer to Earn",
  title: "3% Match Cash Coupon +8.1% APY",
  titleBreaks: [2, 4],
  ctaLong: "Download  →",
  ctaShort: "Download",
  badge: "Welcome bonus",
  disclaimer: [
    "*New user promo subject to terms & conditions. After the promo, the rate is ",
    { nb: "0.03%" },
    " without a paid subscription. Click the ad for ",
    { nb: "Bank Deposit List" },
    ", ",
    { nb: "Cash Sweep" },
    " and Promo details. ",
    { nb: "Moomoo Financial Inc." },
    ", ",
    { nb: "Member FINRA/SIPC" },
    ".",
  ],
};

const SC: LangCopy = {
  sub: "转入即享收益",
  title: "3% 匹配现金券 + 8.1% 年化",
  titleBreaks: [6],
  ctaLong: "立即下载  →",
  ctaShort: "下载",
  badge: "迎新福利",
  disclaimer: [
    "*新用户优惠受条款约束。优惠结束后，未开通付费订阅的利率为 ",
    { nb: "0.03%" },
    "。详情见广告内 ",
    { nb: "银行存款清单" },
    "、",
    { nb: "现金理财" },
    " 与活动说明。",
  ],
};

const TC: LangCopy = {
  sub: "轉入即享收益",
  title: "3% 匹配現金券 + 8.1% 年化",
  titleBreaks: [6],
  ctaLong: "立即下載  →",
  ctaShort: "下載",
  badge: "迎新福利",
  disclaimer: [
    "*新用戶優惠受條款約束。優惠結束後，未開通付費訂閱的利率為 ",
    { nb: "0.03%" },
    "。詳情見廣告內 ",
    { nb: "銀行存款清單" },
    "、",
    { nb: "現金理財" },
    " 與活動說明。",
  ],
};

const DEFAULT_CONTENT: Content = {
  brand: "moomoo",
  langs: ["en"],
  copy: { en: EN, sc: SC, tc: TC, ja: initialLangCopy("ja"), th: initialLangCopy("th") },
  kv: { id: "kv-tte", name: "KV / Transfer-to-Earn", source: "library", kind: "component" },
  logo: { id: "logo-moomoo", name: "moomoo", source: "library", kind: "component" },
  logoPreset: "moomoo",
};

const DEFAULT_KEYS = ["1200×628", "1080×1080", "1080×225", "1080×1920"];

function targetFromKey(key: string): TargetBoard | null {
  const item = slotByKey(key);
  return item ? slotTarget(item) : null;
}

export function createDefaultProject(): Project {
  return {
    id: "demo-26q3-tte",
    name: "Transfer-to-Earn / 26Q3",
    createdAt: "2026-09-04T00:00:00.000Z",
    updatedAt: "2026-09-04T00:00:00.000Z",
    content: DEFAULT_CONTENT,
    targets: DEFAULT_KEYS.map(targetFromKey).filter((t): t is TargetBoard => t !== null),
    shared: structuredClone(BOARD_CONFIG_DEFAULT),
    overrides: {},
  };
}
