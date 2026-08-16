import crypto from 'crypto';
import { PremiumCodeRepository } from '#dbRepo/premiumCodes';

const DURATION_UNITS = {
        day: 24 * 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        weeks: 7 * 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        months: 30 * 24 * 60 * 60 * 1000,
        mo: 30 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
        years: 365 * 24 * 60 * 60 * 1000,
        y: 365 * 24 * 60 * 60 * 1000,
};

const normaliseCode = (code) => String(code || '').trim().toUpperCase();
const CODE_TTL_MS = 24 * 60 * 60 * 1000;

export class PremiumCodeService {
        constructor() {
                this.repo = new PremiumCodeRepository();
        }

        parseDuration(input) {
                const raw = String(input || '').trim().toLowerCase();
                const match = raw.match(/^(\d+)\s*([a-z]+)$/);
                if (!match) return null;

                const amount = Number(match[1]);
                const unit = match[2];
                const unitMs = DURATION_UNITS[unit];

                if (!Number.isSafeInteger(amount) || amount <= 0 || !unitMs) return null;

                return {
                        durationMs: amount * unitMs,
                        durationLabel: `${amount}${unit}`,
                };
        }

        async create(durationInput, createdBy) {
                const duration = this.parseDuration(durationInput);
                if (!duration) return null;

                for (let i = 0; i < 5; i++) {
                        const code = `SAANVI-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
                        try {
                                return await this.repo.create({
                                        code,
                                        createdBy,
                                        expiresAt: new Date(Date.now() + CODE_TTL_MS),
                                        ...duration,
                                });
                        } catch (error) {
                                if (error?.code !== 11000) throw error;
                        }
                }

                throw new Error('Failed to generate a unique premium code.');
        }

        async redeem(code, userId) {
                return await this.repo.redeem(normaliseCode(code), userId);
        }

        async findByCode(code) {
                return await this.repo.findByCode(normaliseCode(code));
        }
}
