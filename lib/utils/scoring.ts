import type { Project } from '@/types/project';

export interface ScoreResult {
  score: number;
  reasons: string[];
}

// Campfire category slugs that map to product/gadget
const PRODUCT_CATEGORIES = new Set([
  'product', 'technology', 'products', 'ガジェット', 'テクノロジー/iot',
]);
const FOOD_CATEGORIES = new Set(['food', 'フード']);

export function scoreProject(project: Project): ScoreResult {
  let score = 0;
  const reasons: string[] = [];

  // --- 達成額スコア（最大40点）---
  if (project.achieved_amount >= 30_000_000) {
    score += 40;
    reasons.push('達成額3000万円超 +40');
  } else if (project.achieved_amount >= 10_000_000) {
    score += 30;
    reasons.push('達成額1000万円超 +30');
  } else if (project.achieved_amount >= 3_000_000) {
    score += 20;
    reasons.push('達成額300万円超 +20');
  }

  // --- 達成日スコア（最大30点）---
  // 6〜18ヶ月前が狙い目
  if (project.end_date) {
    const endAt = new Date(project.end_date);
    const now = new Date();
    const monthsAgo = (now.getTime() - endAt.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsAgo >= 6 && monthsAgo <= 18) {
      score += 30;
      reasons.push(`終了${Math.round(monthsAgo)}ヶ月前（狙い目期間）+30`);
    }
  }

  // --- カテゴリスコア（最大20点）---
  const cat = (project.category ?? '').toLowerCase();
  if (PRODUCT_CATEGORIES.has(cat)) {
    score += 20;
    reasons.push('プロダクト・ガジェット系カテゴリ +20');
  } else if (FOOD_CATEGORIES.has(cat)) {
    score += 15;
    reasons.push('フード系カテゴリ +15');
  } else {
    score += 5;
    reasons.push('その他カテゴリ +5');
  }

  // --- 起案者が法人（最大10点）---
  if (project.owner_company) {
    score += 10;
    reasons.push('法人起案者 +10');
  }

  // --- 連絡可能性（最大10点）---
  if (project.owner_profile_url) {
    score += 10;
    reasons.push('プロフィールURL有り +10');
  }

  return { score, reasons };
}
