import 'server-only';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const endpoint = () => `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
async function generate(parts: GeminiPart[]) {
  if (!process.env.GEMINI_API_KEY) throw new Error('Gemini is not configured. Add GEMINI_API_KEY.');
  const response = await fetch(endpoint(), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
    cache: 'no-store', signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Gemini request failed (${response.status}).`);
  const payload = await response.json();
  const raw = payload.candidates?.[0]?.content?.parts?.map((p: {text?: string}) => p.text || '').join('');
  if (!raw) throw new Error('Gemini returned no analysis.');
  return JSON.parse(raw);
}

export type ProductImageCheck = { imageMatches: boolean; containsContact: boolean; containsWatermark: boolean; containsPromotion: boolean; confidence: number; reasons: string[] };
export async function inspectProductImage(bytes: Buffer, mimeType: string, title: string, description: string): Promise<ProductImageCheck> {
  return generate([
    { text: `Inspect this marketplace product photo. Product title: ${title}. Description: ${description}. Return JSON only with keys imageMatches(boolean), containsContact(boolean), containsWatermark(boolean), containsPromotion(boolean), confidence(number 0-1), reasons(string array). Contact includes phone numbers, email, social handles, URLs, QR codes intended for contact, or messaging IDs visible in the image. Watermark includes seller/brand overlay added on top of photo, not a genuine product label. Promotion includes banners, discount ads, price stickers or marketing graphics. Decide whether the photo genuinely depicts the described item. Be conservative: if uncertain, set confidence below 0.8. Do not infer authenticity or ownership.` },
    { inline_data: { mime_type: mimeType, data: bytes.toString('base64') } },
  ]);
}
export async function inspectStudentId(bytes: Buffer, mimeType: string, enteredId: string) {
  return generate([
    { text: `You are checking a Woldia University student ID layout. IMPORTANT: The student ID number is handwritten beside the student's photograph, not necessarily printed. Inspect the area immediately to the right of the photo and read the complete handwritten ID number. Ignore unrelated handwriting, stamps, registrar signatures, academic-year renewal table, and other numbers. Return JSON only: layoutRecognized(boolean), extractedStudentId(string or empty), numberReadable(boolean), matchesEnteredNumber(boolean), confidence(number 0-1), reasons(string array). Compare extractedStudentId to the supplied registration number exactly after trimming spaces and normalizing only obvious separators; do not guess unclear characters. Entered registration number: ${enteredId}. This is a consistency check, not proof of document authenticity. If unclear, set numberReadable false and confidence below 0.8.` },
    { inline_data: { mime_type: mimeType, data: bytes.toString('base64') } },
  ]);
}
export async function inspectDescription(title: string, description: string) {
  return generate([{ text: `Review this campus marketplace product description. Title: ${title}. Description: ${description}. Return JSON only: cleanedDescription(string), removedContact(boolean), removedItems(string array), hasEnoughProductInformation(boolean). Remove contact details such as phone numbers, emails, URLs, Telegram/WhatsApp/social handles and requests to contact externally. Preserve product facts. Do not invent missing details.` }]);
}
