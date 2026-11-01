export const money=(value:number|string)=>`ETB ${Number(value).toLocaleString('en-ET',{maximumFractionDigits:2})}`;
export const telegramUrl=process.env.NEXT_PUBLIC_TELEGRAM_SUPPORT_URL || 'https://t.me/your_support_account';
