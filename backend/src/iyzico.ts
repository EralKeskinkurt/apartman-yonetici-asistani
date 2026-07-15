import Iyzipay from 'iyzipay';

const isSandbox = process.env.IYZICO_SANDBOX !== 'false';

export const iyzipay = new Iyzipay({
  apiKey: process.env.IYZICO_API_KEY || 'sandbox-...',
  secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-...',
  uri: isSandbox ? 'https://sandbox-api.iyzipay.com' : 'https://api.iyzipay.com',
});

export const MONTHLY_PRICE = 99;
export const CURRENCY = 'TRY';

export function getCallbackUrl(path: string): string {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  return `${base}/api/payment${path}`;
}
