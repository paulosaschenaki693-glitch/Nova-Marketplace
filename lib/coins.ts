export type RoleType = 'STUDENT' | 'MERCHANT' | 'ADMIN';

export type CoinPackage = {
  id: string;
  coins: number;
  label: string;
  studentPrice: number;
  merchantPrice: number;
  isPopular?: boolean;
};

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pack-1', coins: 1, label: 'Single Post', studentPrice: 10, merchantPrice: 20 },
  { id: 'pack-5', coins: 5, label: 'Starter Pack', studentPrice: 50, merchantPrice: 90, isPopular: true },
  { id: 'pack-15', coins: 15, label: 'Pro Seller Pack', studentPrice: 130, merchantPrice: 250 },
];

export const CUSTOM_COIN_RATES = {
  STUDENT: 12, // Approved custom order rate: ETB per coin
  MERCHANT: 22, // Approved custom order rate: ETB per coin
};

export const WELCOME_COINS = 3;

/**
 * Calculates the required coin cost to list a product based on its price.
 * - Up to 500 ETB: 1 Coin
 * - 501 – 2,500 ETB: 2 Coins
 * - 2,501 – 10,000 ETB: 3 Coins
 * - Above 10,000 ETB: 5 Coins
 */
export function getRequiredCoinsForPrice(price: number): number {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 500) {
    return 1;
  }
  if (numericPrice <= 2500) {
    return 2;
  }
  if (numericPrice <= 10000) {
    return 3;
  }
  return 5;
}

/**
 * Calculates the cost in ETB for a given number of coins and user role.
 */
export function calculateCoinsCost(coins: number, role: RoleType): number {
  if (coins <= 0) return 0;
  const isStudent = role === 'STUDENT';
  
  const standardPack = COIN_PACKAGES.find(p => p.coins === coins);
  if (standardPack) {
    return isStudent ? standardPack.studentPrice : standardPack.merchantPrice;
  }
  
  const rate = isStudent ? CUSTOM_COIN_RATES.STUDENT : CUSTOM_COIN_RATES.MERCHANT;
  return coins * rate;
}
