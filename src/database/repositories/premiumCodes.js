import { PremiumCode } from '#dbSchema/premiumCodes';

export class PremiumCodeRepository {
        async create({ code, durationMs, durationLabel, createdBy }) {
                const doc = await PremiumCode.create({
                        _id: code,
                        durationMs,
                        durationLabel,
                        createdBy,
                });

                return this._normalise(doc.toObject());
        }

        async redeem(code, userId) {
                const doc = await PremiumCode.findOneAndUpdate(
                        { _id: code, redeemedBy: null },
                        { $set: { redeemedBy: userId, redeemedAt: new Date() } },
                        { new: true },
                ).lean();

                return this._normalise(doc);
        }

        async findByCode(code) {
                const doc = await PremiumCode.findById(code).lean();
                return this._normalise(doc);
        }

        _normalise(doc) {
                if (!doc) return null;
                const { _id, __v, ...rest } = doc;
                return { code: _id, ...rest };
        }
}
