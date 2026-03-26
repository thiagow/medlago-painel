/**
 * Normaliza e formata qualquer formato de número de telefone brasileiro para
 * o padrão: +55 (61) 98688-9633
 *
 * Suporta entradas como:
 *  - "556198689633"            → "+55 (61) 9868-9633"
 *  - "+55 61 9868-9633"        → "+55 (61) 9868-9633"
 *  - "+55 (61) 9868-9633"      → "+55 (61) 9868-9633"
 *  - "5561986896338@s.whatsapp.net" → "+55 (61) 9868-9633"
 *  - "+55 (78) 8842-3501"      → "+55 (78) 8842-3501"
 */
export function formatPhone(phone: string | null | undefined): string {
    if (!phone) return "Desconhecido";

    // Remove sufixo de JID do WhatsApp (ex: @s.whatsapp.net)
    const cleaned = phone.split("@")[0];

    // Extrai somente os dígitos
    const digits = cleaned.replace(/\D/g, "");

    // Número brasileiro: espera 12 ou 13 dígitos (55 + DDD 2 + número 8 ou 9)
    // Ex: 556198689633 (12 dígitos) ou 55619868096338 (13 dígitos - raro)
    if (digits.length === 12) {
        // 55 + DDD(2) + número(8)  → celular sem 9 na frente ou fixo
        const country = digits.slice(0, 2);  // 55
        const ddd     = digits.slice(2, 4);  // 61
        const part1   = digits.slice(4, 8);  // 9868
        const part2   = digits.slice(8, 12); // 9633
        return `+${country} (${ddd}) ${part1}-${part2}`;
    }

    if (digits.length === 13) {
        // 55 + DDD(2) + número(9)  → celular com 9 na frente
        const country = digits.slice(0, 2);  // 55
        const ddd     = digits.slice(2, 4);  // 61
        const part1   = digits.slice(4, 9);  // 98689
        const part2   = digits.slice(9, 13); // 9633
        return `+${country} (${ddd}) ${part1}-${part2}`;
    }

    // Fallback: retorna os dígitos sem formatação especial
    if (digits.length > 0) return `+${digits}`;

    // Se não há dígitos (número inválido), retorna o original truncado
    return phone.slice(0, 20);
}
